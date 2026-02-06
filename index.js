const {setGlobalOptions} = require("firebase-functions");
const {onRequest} = require("firebase-functions/https");
const logger = require("firebase-functions/logger");
const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
require("dotenv").config();

setGlobalOptions({ maxInstances: 10 });

// CORS helper
const withCors = (handler) => async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(204).send('');
  }
  return handler(req, res);
};

// Email transporter (Gmail or Ethereal fallback)
let cachedTransporter = null;
async function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    cachedTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
    });
    return cachedTransporter;
  }
  const test = await nodemailer.createTestAccount();
  cachedTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: test.user, pass: test.pass },
  });
  return cachedTransporter;
}

// Initialize OpenAI and required dependencies
const OpenAI = require('openai');
const crypto = require('crypto');
const axios = require('axios');

// Initialize Firebase Admin SDK
const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp();
}

// Import FieldValue from firestore module (required for Firebase Admin SDK v12+)
const { FieldValue } = require('firebase-admin/firestore');

exports.sendPasswordReset = onRequest(withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }
  try {
    const link = await admin.auth().generatePasswordResetLink(email);
    // Optionally, you could send this link via email, but for now just return it
    return res.status(200).json({ success: true, link });
  } catch (error) {
    logger.error('Error sending password reset email:', error);
    return res.status(500).json({ error: 'Failed to send password reset email' });
  }
}));

// New endpoint: send full analysis report via email
exports.sendAnalysisReport = onRequest(withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { email, subject, content, name } = req.body || {};

  if (!email || !content) {
    return res.status(400).json({ error: 'Missing required fields: email, content' });
  }

  const safeSubject = subject || 'Code Analysis Results';
  const recipientName = name || 'there';

  const html = `
    <div style="max-width:720px;margin:24px auto;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
      <h2 style="margin:0 0 12px 0;color:#111827;">${safeSubject}</h2>
      <p style="margin:0 0 16px 0;color:#374151;">Hello ${recipientName},</p>
      <p style="margin:0 0 16px 0;color:#374151;">Here are your code analysis results:</p>
      <pre style="white-space:pre-wrap;background:#0b1220;color:#e5e7eb;padding:16px;border-radius:8px;border:1px solid #1f2937;font-size:14px;">${content}
      </pre>
      <p style="margin:16px 0 0 0;color:#6b7280;font-size:13px;">This email was sent automatically by AI Code Review Assistant.</p>
    </div>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: safeSubject,
    text: `Hello ${recipientName},\n\nHere are your code analysis results:\n\n${content}\n\n— AI Code Review Assistant`,
    html,
  };

  try {
    const transporter = await getTransporter();
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl ? nodemailer.getTestMessageUrl(info) : null;
    return res.status(200).json({ success: true, previewUrl });
  } catch (error) {
    logger.error('Error sending analysis report email:', error);
    return res.status(500).json({ error: 'Failed to send analysis report' });
  }
}));

// Rate limiting storage (in production, use Redis or Firestore)
const rateLimitMap = new Map();

// Rate limiter helper
function checkRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(identifier) || [];
  const recentRequests = userRequests.filter(timestamp => now - timestamp < windowMs);

  if (recentRequests.length >= maxRequests) {
    return false;
  }

  recentRequests.push(now);
  rateLimitMap.set(identifier, recentRequests);
  return true;
}

// Helper function to extract JSON from OpenAI response
function extractJSON(responseText) {
  try {
    // First, try parsing as-is
    return JSON.parse(responseText);
  } catch (e) {
    // Remove markdown code blocks if present
    let cleaned = responseText.trim();

    // Remove ```json ... ``` or ``` ... ```
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');

    // Remove any leading/trailing whitespace again
    cleaned = cleaned.trim();

    // Try parsing the cleaned version
    try {
      return JSON.parse(cleaned);
    } catch (e2) {
      // Look for JSON object between first { and last }
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');

      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
        return JSON.parse(jsonStr);
      }

      throw new Error('Unable to extract valid JSON from response');
    }
  }
}

// OpenAI Code Analysis with structured output
exports.analyzeCode = onRequest(withCors(async (req, res) => {
  logger.info('=== analyzeCode function called ===');

  if (req.method !== 'POST') {
    logger.warn('Invalid method:', req.method);
    return res.status(405).send('Method Not Allowed');
  }

  logger.info('Request body received:', {
    hasCode: !!req.body?.code,
    codeLength: req.body?.code?.length,
    filename: req.body?.filename,
    uid: req.body?.uid
  });

  const { code, filename, uid } = req.body || {};

  // Validation
  if (!code || typeof code !== 'string') {
    logger.error('Validation failed: Missing or invalid code parameter');
    return res.status(400).json({ error: 'Missing or invalid code parameter' });
  }

  // Input size limit: 60KB as per requirements
  const maxBytes = 60 * 1024;
  if (Buffer.byteLength(code, 'utf8') > maxBytes) {
    logger.error('Validation failed: Code too large');
    return res.status(413).json({ error: 'Code too large. Maximum 60KB allowed.' });
  }

  // Rate limiting
  const clientId = uid || req.ip || 'anonymous';
  if (!checkRateLimit(clientId, 10, 60000)) {
    logger.warn('Rate limit exceeded for client:', clientId);
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
  }

  try {
    // Get OpenAI API key from environment or Firebase config
    const apiKey = process.env.OPENAI_API_KEY || (functions.config().openai && functions.config().openai.key);
    logger.info('API key check:', { hasApiKey: !!apiKey, keyLength: apiKey?.length });

    if (!apiKey) {
      logger.error('OpenAI API key not configured');
      return res.status(500).json({
        error: 'AI service not configured. Please set OpenAI API key.',
        hint: 'Check functions/.env file'
      });
    }

    // Initialize OpenAI client
    logger.info('Initializing OpenAI client...');
    const openai = new OpenAI({
      apiKey: apiKey
    });

    logger.info('OpenAI client initialized successfully');

    // Detect language
    const detectLanguage = (codeStr) => {
      if (/\bimport\s+.*\bfrom\b|require\(|console\.|function\s+\w+|const\s+\w+\s*=/.test(codeStr)) return 'javascript';
      if (/\bimport\s+.*:.*\bfrom\b|interface\s+|type\s+\w+\s*=/.test(codeStr)) return 'typescript';
      if (/\b(def|import)\b.*:|print\(|if\s+.*:/.test(codeStr)) return 'python';
      if (/\b(public|private|class)\s+\w+|System\.out\./.test(codeStr)) return 'java';
      if (/<\?php|namespace\s+|function\s+\w+\s*\(/.test(codeStr)) return 'php';
      return 'unknown';
    };

    const language = detectLanguage(code);

    // Call OpenAI with structured prompt for JSON response
    const prompt = `You are an expert code reviewer. Analyze the following ${language} code and provide a comprehensive review in strict JSON format.

Code to analyze:
\`\`\`${language}
${code}
\`\`\`

Return a JSON object with this exact structure:
{
  "summary": "Brief 2-3 sentence overview of the code",
  "overallScore": <number 0-100>,
  "counts": {
    "critical": <number>,
    "high": <number>,
    "medium": <number>,
    "low": <number>,
    "codeSmells": <number>
  },
  "metrics": {
    "complexity": <number 0-100>,
    "performance": <number 0-100>,
    "maintainability": <number 0-100>,
    "documentation": <number 0-100>,
    "security": <number 0-100>,
    "readability": <number 0-100>
  },
  "issues": [
    {
      "severity": "critical|high|medium|low",
      "category": "Security|Performance|Best Practices|Style|Documentation",
      "message": "Clear description of the issue",
      "line": <line number or 0>,
      "suggestion": "How to fix it"
    }
  ],
  "recommendations": [
    "Actionable recommendation 1",
    "Actionable recommendation 2",
    "Actionable recommendation 3"
  ],
  "technicalDebt": "Estimate of time/effort to address all issues"
}

Be thorough but concise. Provide actionable insights.`;

    // Call OpenAI API (separate from JSON parsing for better error handling)
    logger.info('Calling OpenAI API...');
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are an expert code reviewer. You MUST respond with valid JSON only. Do not include any markdown formatting, code blocks, or explanatory text. Return only the raw JSON object.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });
      logger.info('OpenAI API call successful');
    } catch (apiError) {
      logger.error('OpenAI API error:', {
        message: apiError.message,
        status: apiError.status,
        type: apiError.type,
        code: apiError.code
      });
      throw new Error(`OpenAI API failed: ${apiError.message}`);
    }

    // Parse JSON response with retry logic
    let analysisData;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount < maxRetries) {
      try {
        const responseText = completion.choices[0].message.content.trim();
        logger.info('Parsing OpenAI response (attempt ' + (retryCount + 1) + ')');
        logger.info('Response preview:', responseText.substring(0, 200));

        analysisData = extractJSON(responseText);
        logger.info('Successfully parsed JSON response');
        break;
      } catch (parseError) {
        retryCount++;
        logger.error('JSON parse error:', {
          message: parseError.message,
          attempt: retryCount
        });

        if (retryCount >= maxRetries) {
          throw new Error(`Failed to parse JSON after ${maxRetries} attempts: ${parseError.message}`);
        }
        logger.warn(`Retrying JSON parse... (${retryCount}/${maxRetries})`);
      }
    }

    // Validate and structure the response
    const analysis = {
      language: language,
      summary: analysisData.summary || 'Code analysis completed',
      overallScore: analysisData.overallScore || 75,
      issues: (analysisData.issues || []).map((issue, idx) => ({
        id: `issue-${idx}`,
        type: issue.category?.toLowerCase() || 'general',
        severity: issue.severity || 'medium',
        category: issue.category || 'Code Quality',
        message: issue.message || 'Issue detected',
        line: issue.line || 0,
        column: 1,
        code: '',
        suggestion: issue.suggestion || 'Review this code section',
        fixedCode: '',
        confidence: 85,
        impact: issue.severity === 'critical' ? 'high' : issue.severity === 'high' ? 'medium' : 'low',
        effort: issue.severity === 'critical' ? 'high' : 'medium'
      })),
      metrics: {
        complexity: analysisData.metrics?.complexity || 50,
        maintainability: analysisData.metrics?.maintainability || 75,
        readability: analysisData.metrics?.readability || 75,
        performance: analysisData.metrics?.performance || 75,
        security: analysisData.metrics?.security || 75,
        documentation: analysisData.metrics?.documentation || 50,
        cyclomaticComplexity: Math.floor((analysisData.metrics?.complexity || 50) / 5),
        cognitiveComplexity: Math.floor((analysisData.metrics?.complexity || 50) / 6),
        linesOfCode: code.split('\n').length,
        duplicateLines: 0,
        testCoverage: 0
      },
      summary: {
        totalIssues: analysisData.issues?.length || 0,
        criticalIssues: analysisData.counts?.critical || 0,
        highIssues: analysisData.counts?.high || 0,
        mediumIssues: analysisData.counts?.medium || 0,
        lowIssues: analysisData.counts?.low || 0,
        securityIssues: (analysisData.issues || []).filter(i => i.category === 'Security').length,
        performanceIssues: (analysisData.issues || []).filter(i => i.category === 'Performance').length,
        qualityIssues: (analysisData.issues || []).filter(i => i.category === 'Code Quality').length
      },
      recommendations: analysisData.recommendations || ['Add comprehensive unit tests', 'Review code for best practices'],
      codeSmells: analysisData.counts?.codeSmells || 0,
      technicalDebt: analysisData.technicalDebt || 'Low priority',
      timestamp: new Date().toISOString()
    };

    // Store in Firestore (optional - won't fail if Firestore is unavailable)
    let analysisId = null;
    try {
      const codeHash = crypto.createHash('sha256').update(code).digest('hex').substring(0, 16);
      const db = admin.firestore();
      const analysisDoc = await db.collection('analyses').add({
        codeHash,
        language,
        filename: filename || 'untitled',
        uid: uid || null,
        analysis,
        createdAt: FieldValue.serverTimestamp(),
        model: 'gpt-3.5-turbo'
      });
      analysisId = analysisDoc.id;
      logger.info(`Analysis completed and stored: ${analysisDoc.id}`);
    } catch (firestoreError) {
      logger.warn('Firestore storage failed (analysis still successful):', firestoreError.message);
    }

    return res.status(200).json({
      success: true,
      analysis,
      analysisId
    });

  } catch (error) {
    logger.error('=== Code analysis fatal error ===');
    logger.error('Error type:', error.constructor.name);
    logger.error('Error message:', error.message);
    logger.error('Error stack:', error.stack);

    return res.status(500).json({
      error: 'Failed to analyze code',
      details: error.message,
      type: error.constructor.name
    });
  }
}));

// GitHub Repository Analysis

exports.analyzeGithubRepo = onRequest(withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { repoUrl, uid } = req.body || {};

  // Validation
  if (!repoUrl || typeof repoUrl !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid repoUrl parameter' });
  }

  // Parse GitHub URL
  const githubRegex = /github\.com\/([^\/]+)\/([^\/]+)/;
  const match = repoUrl.match(githubRegex);

  if (!match) {
    return res.status(400).json({ error: 'Invalid GitHub repository URL' });
  }

  const [, owner, repo] = match;
  const repoName = repo.replace(/\.git$/, '');

  // Rate limiting
  const clientId = uid || req.ip || 'anonymous';
  if (!checkRateLimit(clientId, 5, 60000)) {
    return res.status(429).json({ error: 'Rate limit exceeded for GitHub analysis. Please try again later.' });
  }

  try {
    // Fetch repository information
    const repoInfoResponse = await axios.get(`https://api.github.com/repos/${owner}/${repoName}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Code-Review-App'
      }
    });

    const repoInfo = repoInfoResponse.data;

    // Check if repo is public
    if (repoInfo.private) {
      return res.status(403).json({ error: 'Cannot analyze private repositories' });
    }

    // Fetch main files from the repository
    const contentsResponse = await axios.get(`https://api.github.com/repos/${owner}/${repoName}/contents`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Code-Review-App'
      }
    });

    const files = contentsResponse.data;

    // Find code files (limit to first 5 for analysis)
    const codeExtensions = ['.js', '.ts', '.py', '.java', '.jsx', '.tsx', '.php', '.rb', '.go'];
    const codeFiles = files.filter(file =>
      file.type === 'file' && codeExtensions.some(ext => file.name.endsWith(ext))
    ).slice(0, 5);

    if (codeFiles.length === 0) {
      return res.status(400).json({ error: 'No code files found in repository root' });
    }

    // Fetch content of the first code file
    const firstFile = codeFiles[0];
    const fileContentResponse = await axios.get(firstFile.download_url);
    const codeContent = fileContentResponse.data;

    // Limit code size
    const maxBytes = 60 * 1024;
    if (Buffer.byteLength(codeContent, 'utf8') > maxBytes) {
      return res.status(413).json({ error: `File ${firstFile.name} is too large. Maximum 60KB allowed.` });
    }

    // Get OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY || (functions.config().openai && functions.config().openai.key);

    if (!apiKey) {
      logger.error('OpenAI API key not configured');
      return res.status(500).json({
        error: 'AI service not configured',
        hint: 'Run: firebase functions:config:set openai.key="YOUR_KEY"'
      });
    }

    // Initialize OpenAI for analysis
    const openai = new OpenAI({
      apiKey: apiKey
    });

    const language = firstFile.name.split('.').pop();

    // Analyze with OpenAI
    const prompt = `You are an expert code reviewer analyzing a GitHub repository.

Repository: ${owner}/${repoName}
File: ${firstFile.name}
Language: ${language}

Code to analyze:
\`\`\`${language}
${codeContent}
\`\`\`

Repository Info:
- Stars: ${repoInfo.stargazers_count}
- Forks: ${repoInfo.forks_count}
- Description: ${repoInfo.description || 'N/A'}
- Language: ${repoInfo.language || 'N/A'}

Return a JSON object with this exact structure:
{
  "summary": "Brief overview of the repository and file analyzed",
  "overallScore": <number 0-100>,
  "counts": {
    "critical": <number>,
    "high": <number>,
    "medium": <number>,
    "low": <number>,
    "codeSmells": <number>
  },
  "metrics": {
    "complexity": <number 0-100>,
    "performance": <number 0-100>,
    "maintainability": <number 0-100>,
    "documentation": <number 0-100>,
    "security": <number 0-100>,
    "readability": <number 0-100>
  },
  "issues": [
    {
      "severity": "critical|high|medium|low",
      "category": "Security|Performance|Best Practices|Style|Documentation",
      "message": "Clear description of the issue",
      "line": <line number or 0>,
      "suggestion": "How to fix it"
    }
  ],
  "recommendations": [
    "Repository-level recommendation 1",
    "Code-level recommendation 2",
    "Best practices recommendation 3"
  ],
  "technicalDebt": "Estimate of time/effort to improve this codebase"
}`;

    let analysisData;
    let retryCount = 0;

    while (retryCount < 2) {
      try {
        const completion = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are an expert code reviewer. You MUST respond with valid JSON only. Do not include any markdown formatting, code blocks, or explanatory text. Return only the raw JSON object.'
            },
            { role: 'user', content: prompt }
          ],
          temperature: 0.3,
          max_tokens: 2000
        });

        const responseText = completion.choices[0].message.content.trim();
        logger.info('Received OpenAI response for GitHub analysis, attempting to parse JSON');
        analysisData = extractJSON(responseText);
        logger.info('Successfully parsed JSON response for GitHub analysis');
        break;
      } catch (parseError) {
        retryCount++;
        logger.error('JSON parse error in GitHub analysis:', parseError.message);
        if (retryCount >= 2) {
          throw new Error(`Failed to get valid JSON from AI: ${parseError.message}`);
        }
        logger.warn(`JSON parse failed for GitHub analysis, retrying... (${retryCount}/2)`);
      }
    }

    // Structure response
    const analysis = {
      language: language,
      summary: analysisData.summary || `Analysis of ${firstFile.name} from ${owner}/${repoName}`,
      overallScore: analysisData.overallScore || 75,
      repository: {
        owner,
        name: repoName,
        url: repoUrl,
        stars: repoInfo.stargazers_count,
        forks: repoInfo.forks_count,
        description: repoInfo.description,
        language: repoInfo.language,
        analyzedFile: firstFile.name,
        totalFilesFound: codeFiles.length
      },
      issues: (analysisData.issues || []).map((issue, idx) => ({
        id: `issue-${idx}`,
        type: issue.category?.toLowerCase() || 'general',
        severity: issue.severity || 'medium',
        category: issue.category || 'Code Quality',
        message: issue.message || 'Issue detected',
        line: issue.line || 0,
        column: 1,
        code: '',
        suggestion: issue.suggestion || 'Review this code section',
        fixedCode: '',
        confidence: 85,
        impact: issue.severity === 'critical' ? 'high' : 'medium',
        effort: 'medium'
      })),
      metrics: {
        complexity: analysisData.metrics?.complexity || 50,
        maintainability: analysisData.metrics?.maintainability || 75,
        readability: analysisData.metrics?.readability || 75,
        performance: analysisData.metrics?.performance || 75,
        security: analysisData.metrics?.security || 75,
        documentation: analysisData.metrics?.documentation || 50,
        cyclomaticComplexity: Math.floor((analysisData.metrics?.complexity || 50) / 5),
        cognitiveComplexity: Math.floor((analysisData.metrics?.complexity || 50) / 6),
        linesOfCode: codeContent.split('\n').length,
        duplicateLines: 0,
        testCoverage: 0
      },
      summary: {
        totalIssues: analysisData.issues?.length || 0,
        criticalIssues: analysisData.counts?.critical || 0,
        highIssues: analysisData.counts?.high || 0,
        mediumIssues: analysisData.counts?.medium || 0,
        lowIssues: analysisData.counts?.low || 0,
        securityIssues: (analysisData.issues || []).filter(i => i.category === 'Security').length,
        performanceIssues: (analysisData.issues || []).filter(i => i.category === 'Performance').length,
        qualityIssues: (analysisData.issues || []).filter(i => i.category === 'Code Quality').length
      },
      recommendations: analysisData.recommendations || ['Review repository structure', 'Add comprehensive tests'],
      codeSmells: analysisData.counts?.codeSmells || 0,
      technicalDebt: analysisData.technicalDebt || 'Low priority',
      timestamp: new Date().toISOString()
    };

    // Store in Firestore (optional - won't fail if Firestore is unavailable)
    let analysisId = null;
    try {
      const db = admin.firestore();
      const analysisDoc = await db.collection('analyses').add({
        type: 'github',
        repository: {
          owner,
          name: repoName,
          url: repoUrl
        },
        filename: firstFile.name,
        language,
        uid: uid || null,
        analysis,
        createdAt: FieldValue.serverTimestamp(),
        model: 'gpt-3.5-turbo'
      });
      analysisId = analysisDoc.id;
      logger.info(`GitHub analysis completed: ${analysisDoc.id}`);
    } catch (firestoreError) {
      logger.warn('Firestore storage failed (analysis still successful):', firestoreError.message);
    }

    return res.status(200).json({
      success: true,
      analysis,
      analysisId
    });

  } catch (error) {
    logger.error('GitHub analysis error:', error);

    if (error.response?.status === 404) {
      return res.status(404).json({ error: 'Repository not found' });
    }

    if (error.response?.status === 403) {
      return res.status(403).json({ error: 'GitHub API rate limit exceeded or access denied' });
    }

    return res.status(500).json({
      error: 'Failed to analyze GitHub repository',
      details: error.message
    });
  }
}));

// List Recent Analyses
exports.listRecentAnalyses = onRequest(withCors(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { uid, limit = 10 } = req.method === 'GET' ? req.query : req.body || {};

  try {
    const db = admin.firestore();
    let query = db.collection('analyses')
      .orderBy('createdAt', 'desc')
      .limit(parseInt(limit));

    // Filter by user if uid provided
    if (uid) {
      query = query.where('uid', '==', uid);
    }

    const snapshot = await query.get();
    const analyses = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      analyses.push({
        id: doc.id,
        language: data.language,
        filename: data.filename,
        type: data.type || 'code',
        overallScore: data.analysis?.overallScore || 0,
        totalIssues: data.analysis?.summary?.totalIssues || 0,
        createdAt: data.createdAt?.toDate().toISOString() || null,
        repository: data.repository || null
      });
    });

    return res.status(200).json({
      success: true,
      analyses,
      count: analyses.length
    });

  } catch (error) {
    logger.error('List analyses error:', error);
    return res.status(500).json({
      error: 'Failed to retrieve analyses',
      details: error.message
    });
  }
}));

// Updated Send Recommendation Email - Fetch from Firestore
exports.sendRecommendationEmailV2 = onRequest(withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { analysisId, to, subject } = req.body;

  if (!analysisId || !to) {
    return res.status(400).json({ error: 'Missing required fields: analysisId and to' });
  }

  try {
    // Fetch analysis from Firestore
    const db = admin.firestore();
    const analysisDoc = await db.collection('analyses').doc(analysisId).get();

    if (!analysisDoc.exists) {
      return res.status(404).json({ error: 'Analysis not found' });
    }

    const data = analysisDoc.data();
    const analysis = data.analysis;

    if (!analysis) {
      return res.status(400).json({ error: 'Invalid analysis data' });
    }

    // Extract recommendations and summary
    const summary = analysis.summary || 'Code analysis completed';
    const overallScore = analysis.overallScore || 0;
    const recommendations = analysis.recommendations || [];

    // Compose email
    const mailSubject = subject || 'AI Code Review - Recommendations';
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: mailSubject,
      text: `Code Review Summary\n\nScore: ${overallScore}%\n\nSummary:\n${summary}\n\nRecommendations:\n${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nBest regards,\nAI Code Review Assistant`,
      html: `
        <div style="max-width:600px;margin:24px auto;font-family:'Segoe UI',Arial,sans-serif;background:#fff;border-radius:12px;box-shadow:0 4px 20px #e3e8f0;border:1px solid #e5e7eb;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#2563eb,#7c3aed);padding:32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:1.8rem;font-weight:700;">Code Review Recommendations</h1>
          </div>
          <div style="padding:32px;">
            <div style="background:#f3f4f6;padding:16px;border-radius:8px;margin-bottom:24px;">
              <p style="margin:0 0 8px 0;font-size:14px;color:#6b7280;">Overall Score</p>
              <p style="margin:0;font-size:2rem;font-weight:700;color:#2563eb;">${overallScore}%</p>
            </div>
            <p style="font-size:15px;color:#374155;margin:0 0 20px 0;line-height:1.6;">${summary}</p>
            <h3 style="color:#111827;margin:24px 0 16px 0;font-size:1.2rem;">Recommendations:</h3>
            <ul style="padding-left:0;list-style:none;margin:0;">
              ${recommendations.map(r => `
                <li style="display:flex;align-items:flex-start;margin-bottom:12px;font-size:15px;line-height:1.6;">
                  <span style="display:inline-block;color:#2563eb;font-size:1.2em;margin-right:10px;">✓</span>
                  <span style="display:inline-block;color:#1f2937;">${r}</span>
                </li>
              `).join('')}
            </ul>
            <div style="margin-top:32px;padding-top:24px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;color:#6b7280;font-size:13px;">Generated by AI Code Review Assistant</p>
            </div>
          </div>
        </div>
      `
    };

    const transporter = await getTransporter();
    const info = await transporter.sendMail(mailOptions);
    const previewUrl = nodemailer.getTestMessageUrl(info);

    return res.status(200).json({
      ok: true,
      message: 'Email sent successfully',
      previewUrl
    });

  } catch (error) {
    logger.error('Error sending recommendation email:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}));
