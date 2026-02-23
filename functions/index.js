const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/https");
const logger = require("firebase-functions/logger");

// Move heavy dependencies inside handlers or fetch them on demand
let nodemailer;
let OpenAI;
let crypto;
let axios;
let admin;

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
  if (!nodemailer) nodemailer = require('nodemailer');

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

// Initializers for heavy libraries
function getAdmin() {
  if (!admin) {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp();
    }
  }
  return admin;
}

function getOpenAI() {
  if (!OpenAI) OpenAI = require('openai');
  return OpenAI;
}

function getAxios() {
  if (!axios) axios = require('axios');
  return axios;
}

function getCrypto() {
  if (!crypto) crypto = require('crypto');
  return crypto;
}

exports.sendPasswordReset = onRequest(withCors(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Missing email' });
  }
  try {
    const admin = getAdmin();
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

  const { email, subject, content, name, score, language } = req.body || {};

  if (!email || !content) {
    return res.status(400).json({ error: 'Missing required fields: email, content' });
  }

  const safeSubject = subject || 'Code Analysis Results';
  const recipientName = name || 'there';
  const displayScore = score !== undefined ? `${score}%` : 'A+';
  const scoreMsg = score !== undefined
    ? (score >= 80 ? 'Optimized for Performance' : score >= 60 ? 'Good Stability' : 'Needs Optimization')
    : 'AI Evaluated';

  const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; background-color: #f1f5f9; color: #1e293b; }
        .wrapper { background-color: #f1f5f9; padding: 40px 20px; }
        .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); }
        .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); padding: 40px; text-align: center; color: white; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; }
        .header p { margin: 8px 0 0; opacity: 0.9; font-size: 16px; }
        .content { padding: 40px; }
        .intro { margin-bottom: 30px; font-size: 16px; line-height: 1.6; color: #475569; }
        .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
        .card-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 16px; }
        .score-box { background: #1e293b; color: white; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 24px; }
        .score-value { font-size: 48px; font-weight: 800; color: #3b82f6; }
        .recommendation-list { margin: 0; padding: 0; list-style: none; }
        .recommendation-item { padding: 12px 16px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 8px; font-size: 14px; display: flex; align-items: flex-start; gap: 12px; }
        .recommendation-list .recommendation-item::before { content: "→"; color: #3b82f6; font-weight: bold; }
        .footer { padding: 40px; text-align: center; background: #f8fafc; border-top: 1px solid #e2e8f0; }
        .footer p { margin: 0; color: #94a3b8; font-size: 12px; }
        .btn { display: inline-block; background: #3b82f6; color: white !important; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="wrapper">
        <div class="container">
            <div class="header">
                <h1>AI Code Intelligence</h1>
                <p>${language ? `${language} ` : ''}Analysis Report</p>
            </div>
            <div class="content">
                <div class="intro">
                    Hello <strong>${recipientName}</strong>,<br><br>
                    Our AI has completed the analysis of your code. Below is a summary of the findings and actionable insights to improve your software quality.
                </div>
                
                <div class="score-box" style="background: #1e293b;">
                    <div class="card-title" style="color: #94a3b8;">Health Score</div>
                    <div class="score-value">${displayScore}</div>
                    <div style="font-size: 14px; opacity: 0.7;">${scoreMsg}</div>
                </div>

                <div class="card">
                    <div class="card-title">Analysis Results</div>
                    <div class="recommendation-list">
                        ${content.split('\n').filter(line => line.trim().length > 0).map(rec => `
                            <div class="recommendation-item">${rec}</div>
                        `).join('')}
                    </div>
                </div>
            </div>
            <div class="footer">
                <p>Sent via AI Code Review Assistant • MKU Final Project</p>
                <p style="margin-top: 8px;">© 2026 CodeIntel Inc. All rights reserved.</p>
            </div>
        </div>
    </div>
</body>
</html>`;

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
    const nodemailerLib = require('nodemailer');
    const previewUrl = nodemailerLib.getTestMessageUrl ? nodemailerLib.getTestMessageUrl(info) : null;
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
  let analysisId = null;

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
    // Get OpenAI API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    logger.info('API key check:', { hasApiKey: !!apiKey, keyLength: apiKey?.length });

    if (!apiKey) {
      logger.error('OpenAI API key not configured');
      return res.status(500).json({
        error: 'AI service not configured. Please set OPENAI_API_KEY.',
        hint: 'Check functions/.env file'
      });
    }

    // Initialize OpenAI client
    logger.info('Initializing OpenAI client...');
    const OpenAI = getOpenAI();
    const openai = new OpenAI({ apiKey });
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

    const prompt = `Analyze the following ${language} code. 
Focus ONLY on high-impact issues: Security, Performance, and Critical Logic Bugs. 
Ignore style, documentation, and minor best practices.

Return JSON:
{
  "summary": "2-sentence overview",
  "overallScore": 0-100,
  "counts": { "critical": 0, "high": 0, "medium": 0, "low": 0, "codeSmells": 0 },
  "metrics": { "complexity": 0-100, "performance": 0-100, "maintainability": 0-100, "security": 0-100 },
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "Security|Performance|Logic",
    "message": "Concise description",
    "line": number,
    "suggestion": "1-sentence fix"
  }],
  "recommendations": ["Highest impact fix 1", "rec 2"],
  "technicalDebt": "Effort"
}

Code:
${code}`;

    // Call OpenAI API
    logger.info('Calling OpenAI API...');
    let openaiResponseText;
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an ultra-fast code reviewer. Output valid JSON only. Prioritize speed and brevity.'
          },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 800
      });
      openaiResponseText = completion.choices[0].message.content;
      logger.info('OpenAI API call successful');
    } catch (apiError) {
      logger.error('OpenAI API error:', { message: apiError.message });
      throw new Error(`OpenAI API failed: ${apiError.message} `);
    }

    // Parse JSON response with retry logic
    let analysisData;
    let retryCount = 0;
    const maxRetries = 2;

    while (retryCount < maxRetries) {
      try {
        logger.info('Parsing OpenAI response (attempt ' + (retryCount + 1) + ')');
        logger.info('Response preview:', openaiResponseText.substring(0, 200));

        analysisData = extractJSON(openaiResponseText);
        logger.info('Successfully parsed JSON response');
        break;
      } catch (parseError) {
        retryCount++;
        logger.error('JSON parse error:', {
          message: parseError.message,
          attempt: retryCount
        });

        if (retryCount >= maxRetries) {
          throw new Error(`Failed to parse JSON after ${maxRetries} attempts: ${parseError.message} `);
        }
        logger.warn(`Retrying JSON parse... (${retryCount} / ${maxRetries})`);
      }
    }

    // Validate and structure the response
    const analysis = {
      language: language,
      summary: analysisData.summary || 'Code analysis completed',
      overallScore: analysisData.overallScore || 75,
      issues: (analysisData.issues || []).map((issue, idx) => ({
        id: `issue - ${idx}`,
        type: issue.category?.toLowerCase() || 'general',
        severity: issue.severity || 'medium',
        category: issue.category || 'Code Quality',
        message: issue.message || 'Issue detected',
        line: issue.line || 0,
        column: 1,
        code: issue.code || '',
        suggestion: issue.suggestion || 'Review this code section',
        fixedCode: issue.fixedCode || '',
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

    const crypto = getCrypto();
    const codeHash = crypto.createHash('sha256').update(code).digest('hex').substring(0, 16);
    const admin = getAdmin();
    const { FieldValue } = require('firebase-admin/firestore');
    const db = admin.firestore();
    try {
      const analysisDoc = await db.collection('analyses').add({
        codeHash,
        // Store a truncated version of the analyzed code so the UI can show history
        codeSnippet: code.length > 4000 ? code.substring(0, 4000) : code,
        language,
        filename: filename || 'untitled',
        uid: uid || null,
        analysis,
        createdAt: FieldValue.serverTimestamp(),
        model: 'gpt-4o-mini'
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

  if (!repoUrl || typeof repoUrl !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid repoUrl parameter' });
  }

  const githubRegex = /github\.com\/([^\/]+)\/([^\/]+)/;
  const match = repoUrl.match(githubRegex);

  if (!match) {
    return res.status(400).json({ error: 'Invalid GitHub repository URL' });
  }

  const [, owner, repo] = match;
  const repoName = repo.replace(/\.git$/, '');

  const clientId = uid || req.ip || 'anonymous';
  if (!checkRateLimit(clientId, 5, 60000)) {
    return res.status(429).json({ error: 'Rate limit exceeded for GitHub analysis. Please try again later.' });
  }

  try {
    const axios = getAxios();
    const repoInfoResponse = await axios.get(`https://api.github.com/repos/${owner}/${repoName}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Code-Review-App'
      }
    });

    const repoInfo = repoInfoResponse.data;

    if (repoInfo.private) {
      return res.status(403).json({ error: 'Cannot analyze private repositories' });
    }

    const contentsResponse = await axios.get(`https://api.github.com/repos/${owner}/${repoName}/contents`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'AI-Code-Review-App'
      }
    });

    const files = contentsResponse.data;
    const codeExtensions = ['.js', '.ts', '.py', '.java', '.jsx', '.tsx', '.php', '.rb', '.go'];
    const codeFiles = files.filter(file =>
      file.type === 'file' && codeExtensions.some(ext => file.name.endsWith(ext))
    ).slice(0, 5);

    if (codeFiles.length === 0) {
      return res.status(400).json({ error: 'No code files found in repository root' });
    }

    const firstFile = codeFiles[0];
    const fileContentResponse = await axios.get(firstFile.download_url);
    const codeContent = fileContentResponse.data;

    const maxBytes = 60 * 1024;
    if (Buffer.byteLength(codeContent, 'utf8') > maxBytes) {
      return res.status(413).json({ error: `File ${firstFile.name} is too large. Maximum 60KB allowed.` });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'AI service not configured' });
    }

    getOpenAI();
    const openai = new OpenAI({ apiKey });
    const language = firstFile.name.split('.').pop();

    const prompt = `Analyze this GitHub repository file: ${owner}/${repoName}/${firstFile.name} (${language}).
Strictly prioritize High-Impact issues: Security, Performance, and Major Logic Bugs.

Return a JSON object:
{
  "summary": "Brief overview",
  "overallScore": 0-100,
  "counts": { "critical": 0, "high": 0, "medium": 0, "low": 0, "codeSmells": 0 },
  "metrics": { "complexity": 0-100, "performance": 0-100, "maintainability": 0-100, "documentation": 0-100, "security": 0-100, "readability": 0-100 },
  "issues": [{ "severity": "...", "category": "...", "message": "...", "line": 0, "suggestion": "..." }],
  "recommendations": ["...", "...", "..."],
  "technicalDebt": "estimate"
}
Code:
${codeContent}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert code reviewer. Respond in JSON.' },
        { role: 'user', content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1200
    });

    const analysisData = extractJSON(completion.choices[0].message.content);

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
      sourceCode: codeContent,
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

    let analysisId = null;
    try {
      const admin = getAdmin();
      const db = admin.firestore();
      const analysisDoc = await db.collection('analyses').add({
        codeHash: 'github-import',
        codeSnippet: codeContent.substring(0, 4000),
        language,
        uid: uid || null,
        analysis,
        createdAt: require('firebase-admin').firestore.FieldValue.serverTimestamp(),
        model: 'gpt-4o-mini'
      });
      analysisId = analysisDoc.id;
    } catch (firestoreError) {
      logger.warn('Firestore storage failed:', firestoreError.message);
    }

    return res.status(200).json({ success: true, analysis, analysisId });
  } catch (error) {
    logger.error('GitHub analysis error:', error);
    return res.status(error.response?.status || 500).json({
      error: 'Failed to analyze GitHub repository',
      details: error.message
    });
  }
}));

// Fix Code Endpoint
exports.fixCode = onRequest(withCors(async (req, res) => {
  logger.info('=== fixCode function called ===');
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { code, issues, language, uid } = req.body || {};

  if (!code) {
    return res.status(400).json({ error: 'Missing code parameter' });
  }

  // Rate limiting
  const clientId = uid || req.ip || 'anonymous';
  if (!checkRateLimit(clientId + '_fix', 5, 60000)) {
    return res.status(429).json({ error: 'Rate limit exceeded for fix requests.' });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'AI service not configured.' });
    }

    const OpenAI = getOpenAI();
    const openai = new OpenAI({ apiKey });

    // Construct a focused prompt
    const issueDescriptions = issues && issues.length > 0
      ? issues.map(i => `- [${i.severity}] ${i.message} (Line ${i.line})`).join('\n')
      : "General code improvements and syntax cleanup.";

    const prompt = `FIX the following ${language || 'source'} code.
Address only these issues:
${issueDescriptions}

Return ONLY the raw fixed code. No markdown, no text, no explanations.

Code to fix:
${code}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are an ultra-fast code fixing engine. Output strictly raw code. No explanations. Prioritize speed.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 1500
    });
    let fixedCode = completion.choices[0].message.content.trim();

    // Cleanup potential markdown if the model ignores instructions
    if (fixedCode.startsWith('```')) {
      fixedCode = fixedCode.replace(/^```[a-z]*\n/i, '').replace(/```$/, '');
    }

    return res.status(200).json({ success: true, fixedCode });

  } catch (error) {
    logger.error('Fix code error:', error);
    return res.status(500).json({ error: 'Failed to fix code', details: error.message });
  }
}));

// List Recent Analyses
exports.listRecentAnalyses = onRequest(withCors(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { uid, limit = 10 } = req.method === 'GET' ? req.query : req.body || {};

  try {
    const admin = getAdmin();
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
    const admin = getAdmin();
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

    // Build score color based on score value
    const getScoreColor = (score) => {
      if (score >= 80) return '#10b981';
      if (score >= 60) return '#f59e0b';
      return '#ef4444';
    };

    const scoreColor = getScoreColor(overallScore);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: mailSubject,
      text: `Code Review Summary\n\nScore: ${overallScore}%\n\nSummary:\n${summary}\n\nRecommendations:\n${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\nBest regards,\nAI Code Review Assistant`,
      html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                      body {margin: 0; padding: 0; font-family: 'Segoe UI', 'Roboto', Arial, sans-serif; background: #f8fafc; }
                      .container {max - width: 700px; margin: 0 auto; background: #ffffff; }
                      .header {background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 50px 30px; text-align: center; color: #ffffff; }
                      .header h1 {margin: 0; font-size: 32px; font-weight: 700; }
                      .header p {margin: 10px 0 0 0; font-size: 16px; opacity: 0.95; }
                      .content {padding: 40px 30px; }
                      .score-card {background: linear-gradient(135deg, ${scoreColor}15 0%, ${scoreColor}05 100%); border: 2px solid ${scoreColor}; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
                      .score-card .label {font - size: 14px; color: #64748b; font-weight: 600; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
                      .score-card .score {font - size: 48px; font-weight: 700; color: ${scoreColor}; margin: 0; }
                      .summary-box {background: #f0f4ff; border-left: 4px solid #667eea; padding: 20px; border-radius: 8px; margin: 25px 0; }
                      .summary-box p {margin: 0; color: #1e293b; font-size: 15px; line-height: 1.6; }
                      .rec-section {margin - top: 30px; }
                      .rec-title {font - size: 20px; font-weight: 700; color: #1e293b; margin-bottom: 20px; }
                      .rec-title::before {content: "💡"; margin-right: 10px; }
                      .recommendation-card {background: linear-gradient(135deg, #f0f4ff 0%, #f8f5ff 100%); border-left: 4px solid #667eea; padding: 18px; margin-bottom: 15px; border-radius: 8px; transition: transform 0.2s; }
                      .recommendation-card:hover {transform: translateX(4px); }
                      .recommendation-card p {margin: 0; color: #1e293b; font-size: 15px; line-height: 1.6; }
                      .footer {background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: #ffffff; }
                      .footer p {margin: 0; font-size: 13px; opacity: 0.95; }
                      .divider {height: 3px; background: linear-gradient(90deg, #667eea, #764ba2, #667eea); margin: 30px 0; border-radius: 2px; }
                      .star {color: #fbbf24; margin: 0 3px; }
                    </style>
                  </head>
                  <body>
                    <div class="container">
                      <div class="header">
                        <h1>🚀 Code Review Results</h1>
                        <p>AI-Powered Analysis & Recommendations</p>
                      </div>

                      <div class="content">
                        <div class="score-card">
                          <div class="label">Your Code Quality Score</div>
                          <p class="score">${overallScore}%</p>
                        </div>

                        <div class="summary-box">
                          <p>${summary}</p>
                        </div>

                        <div class="divider"></div>

                        <div class="rec-section">
                          <h2 class="rec-title">Key Recommendations</h2>
                          ${recommendations.map((r, i) => `
                  <div class="recommendation-card">
                    <p><span class="star">★</span> <strong>${i + 1}.</strong> ${r}</p>
                  </div>
                `).join('')}
                        </div>

                        <div class="divider"></div>

                        <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 20px; border-radius: 8px; margin: 25px 0;">
                          <p style="margin: 0; color: #92400e; font-size: 14px; line-height: 1.6;">
                            <strong>✨ Next Steps:</strong> Review these recommendations carefully and implement them to significantly enhance your code quality. Each suggestion is prioritized based on impact and ease of implementation.
                          </p>
                        </div>
                      </div>

                      <div class="footer">
                        <p style="font-size: 16px; margin-bottom: 8px;">✨ AI Code Review Assistant</p>
                        <p style="font-size: 12px; margin: 0;">Powered by Advanced Code Analysis Technology</p>
                      </div>
                    </div>
                  </body>
                </html>
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
