import { withCors, OpenAI, axios, extractJSON, admin } from './_utils.js';

const handler = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { repoUrl, uid } = req.body || {};
  if (!repoUrl || typeof repoUrl !== 'string') return res.status(400).json({ error: 'Missing or invalid repoUrl' });

  const githubRegex = /github\.com\/([^\/]+)\/([^\/]+)/;
  const match = repoUrl.match(githubRegex);
  if (!match) return res.status(400).json({ error: 'Invalid GitHub repository URL' });

  const [, owner, repo] = match;
  const repoName = repo.replace(/\.git$/, '');

  try {
    const ghHeaders = { 
      'Accept': 'application/vnd.github.v3+json', 
      'User-Agent': 'Intellicode-App' 
    };

    // 1. Fetch repo info
    const repoInfoResp = await axios.get(`https://api.github.com/repos/${owner}/${repoName}`, { headers: ghHeaders });
    const repoInfo = repoInfoResp.data;

    if (repoInfo.private) return res.status(403).json({ error: 'Cannot analyze private repositories' });

    // 2. Fetch repo contents
    const contentsResp = await axios.get(`https://api.github.com/repos/${owner}/${repoName}/contents`, { headers: ghHeaders });
    const files = contentsResp.data;

    const codeExtensions = ['.js', '.ts', '.py', '.java', '.jsx', '.tsx', '.php', '.rb', '.go'];
    const codeFiles = files.filter(file => 
      file.type === 'file' && codeExtensions.some(ext => file.name.endsWith(ext))
    ).slice(0, 5);

    if (codeFiles.length === 0) return res.status(400).json({ error: 'No code files found in repository root' });

    // 3. Analyze the first code file
    const firstFile = codeFiles[0];
    const fileContentResp = await axios.get(firstFile.download_url);
    const codeContent = fileContentResp.data;

    const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    const apiKey = groqKey || openaiKey;

    if (!apiKey) return res.status(500).json({ error: 'AI service not configured.' });

    const isGroq = !!groqKey;
    const openai = new OpenAI({ 
      apiKey,
      baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined
    });
    const language = firstFile.name.split('.').pop();

    const prompt = `Analyze this GitHub repository file: ${owner}/${repoName}/${firstFile.name} (${language}).
Strictly prioritize High-Impact issues: Security, Performance, and Major Logic Bugs.

Return ONLY a JSON object:
{
  "summary": "Brief overview",
  "overallScore": 0-100,
  "counts": { "critical": 0, "high": 0, "medium": 0, "low": 0, "codeSmells": 0 },
  "metrics": { "complexity": 0-100, "performance": 0-100, "maintainability": 0-100, "security": 0-100 },
  "issues": [{ "severity": "...", "category": "...", "message": "...", "line": 0, "suggestion": "..." }],
  "recommendations": ["...", "...", "..."],
  "technicalDebt": "estimate"
}`;

    const completion = await openai.chat.completions.create({
      model: process.env.GROQ_MODEL || (process.env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
      messages: [
        { role: 'system', content: 'Expert code reviewer. JSON output only.' },
        { role: 'user', content: prompt + `\n\nCode:\n${codeContent}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1500
    });

    const analysisData = extractJSON(completion.choices[0].message.content);

    const analysis = {
      language,
      summary: analysisData.summary || `Analysis of ${firstFile.name}`,
      overallScore: analysisData.overallScore || 75,
      repository: {
        owner, name: repoName, url: repoUrl,
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
        suggestion: issue.suggestion || 'Review this section',
        fixedCode: '',
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
        documentation: 50,
        cyclomaticComplexity: Math.floor((analysisData.metrics?.complexity || 50) / 5),
        cognitiveComplexity: Math.floor((analysisData.metrics?.complexity || 50) / 6),
        linesOfCode: codeContent.split('\n').length
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

    let analysisId = null;
    try {
      const db = admin.firestore();
      const analysisDoc = await db.collection('analyses').add({
        codeHash: 'github-import',
        codeSnippet: codeContent.substring(0, 4000),
        language,
        uid: uid || null,
        analysis,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        model: process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : 'llama3-70b-8192'
      });
      analysisId = analysisDoc.id;
    } catch (firestoreError) {
      console.warn('Firestore storage failed:', firestoreError.message);
    }

    return res.status(200).json({ success: true, analysis, analysisId });
  } catch (error) {
    console.error('GitHub analysis error:', error);
    const status = error.response ? error.response.status : 500;
    return res.status(status).json({ 
      error: 'Failed to analyze GitHub repository', 
      details: error.response?.data?.message || error.message 
    });
  }
};

export default withCors(handler);
