import { withCors, admin, OpenAI, crypto, extractJSON } from './_utils.js';

// Rate limiting storage (Note: in serverless, this is per-instance)
const rateLimitMap = new Map();

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

const handler = async (req, res) => {
  console.log('=== analyzeCode function called ===');

  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const { code, filename, uid } = req.body || {};
  let analysisId = null;

  // Validation
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid code parameter' });
  }

  // Input size limit: 60KB
  const maxBytes = 60 * 1024;
  if (Buffer.byteLength(code, 'utf8') > maxBytes) {
    return res.status(413).json({ error: 'Code too large. Maximum 60KB allowed.' });
  }

  // Rate limiting
  const clientId = uid || req.headers['x-forwarded-for'] || 'anonymous';
  if (!checkRateLimit(clientId, 10, 60000)) {
    return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
  }

  try {
    const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    const apiKey = groqKey || openaiKey;

    if (!apiKey) {
      return res.status(500).json({ error: 'AI service not configured.' });
    }

    const isGroq = !!groqKey;
    const openai = new OpenAI({ 
      apiKey,
      baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined
    });

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
  "summary": "Detailed 2-sentence overview of the code's health",
  "overallScore": 0-100,
  "counts": { "critical": 0, "high": 0, "medium": 0, "low": 0, "codeSmells": 0 },
  "metrics": { "complexity": 0-100, "performance": 0-100, "maintainability": 0-100, "security": 0-100 },
  "issues": [{
    "severity": "critical|high|medium|low",
    "category": "Security|Performance|Logic",
    "message": "Detailed description of the bug and its impact",
    "line": number,
    "suggestion": "Actionable fix with brief explanation",
    "code": "problematic line",
    "fixedCode": "corrected line"
  }],
  "recommendations": [
    "Specific, actionable improvement 1 based on the code structure",
    "Detailed recommendation 2 targeting the highest risk area",
    "Architectural or logic refinement suggestion 3"
  ],
  "technicalDebt": "Specific estimate (e.g. '4.5 hours to fix critical logical flaws')"
}

IMPORTANT: Recommendations must be SPECIFIC to the code provided, not generic advice. Focus on the most impactful logic and security refinements.`;

    const completion = await openai.chat.completions.create({
      model: process.env.GROQ_MODEL || (process.env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
      messages: [
        { role: 'system', content: 'You are an ultra-fast code reviewer. Output valid JSON only.' },
        { role: 'user', content: prompt + `\n\nCode:\n${code}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 1200
    });

    const analysisData = extractJSON(completion.choices[0].message.content);

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
        code: issue.code || '',
        suggestion: issue.suggestion || 'Review this code section',
        fixedCode: issue.fixedCode || '',
        confidence: 85,
        impact: issue.severity === 'critical' ? 'high' : 'low',
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
        linesOfCode: code.split('\n').length,
        duplicateLines: 0,
        testCoverage: 0
      },
      summary: {
        totalIssues: (analysisData.issues || []).length,
        criticalIssues: analysisData.counts?.critical || 0,
        highIssues: analysisData.counts?.high || 0,
        mediumIssues: analysisData.counts?.medium || 0,
        lowIssues: analysisData.counts?.low || 0,
        securityIssues: (analysisData.issues || []).filter(i => i.category === 'Security').length,
        performanceIssues: (analysisData.issues || []).filter(i => i.category === 'Performance').length,
        qualityIssues: (analysisData.issues || []).filter(i => i.category === 'Code Quality').length
      },
      recommendations: analysisData.recommendations || [],
      codeSmells: analysisData.counts?.codeSmells || 0,
      technicalDebt: analysisData.technicalDebt || 'Low priority',
      timestamp: new Date().toISOString()
    };

    const codeHash = crypto.createHash('sha256').update(code).digest('hex').substring(0, 16);
    
    try {
      const db = admin.firestore();
      const analysisDoc = await db.collection('analyses').add({
        codeHash,
        codeSnippet: code.length > 4000 ? code.substring(0, 4000) : code,
        language,
        filename: filename || 'untitled',
        uid: uid || null,
        analysis,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        model: process.env.GROQ_MODEL || (process.env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini')
      });
      analysisId = analysisDoc.id;
    } catch (firestoreError) {
      console.warn('Firestore storage failed:', firestoreError.message);
    }

    return res.status(200).json({ success: true, analysis, analysisId });

  } catch (error) {
    console.error('Code analysis error:', error);
    return res.status(500).json({ error: 'Failed to analyze code', details: error.message });
  }
};

export default withCors(handler);
