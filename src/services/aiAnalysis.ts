/**
 * Direct OpenAI analysis service.
 * Calls GPT-4o-mini from the browser using the VITE_OPENAI_API_KEY env var.
 */

const API_KEY = import.meta.env.VITE_OPENAI_API_KEY as string;
const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------
export interface AIIssue {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  line: number;
  column: number;
  code: string;
  suggestion: string;
  fixedCode: string;
  confidence: number;
  impact: string;
  effort: string;
  references?: string[];
}

export interface AIAnalysisResult {
  language: string;
  overallScore: number;
  issues: AIIssue[];
  summary: {
    totalIssues: number;
    criticalIssues: number;
    highIssues: number;
    mediumIssues: number;
    lowIssues: number;
    securityIssues: number;
    performanceIssues: number;
    qualityIssues: number;
  };
  metrics: {
    complexity: number;
    maintainability: number;
    readability: number;
    performance: number;
    security: number;
    documentation: number;
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    linesOfCode: number;
    duplicateLines: number;
    testCoverage: number;
  };
  recommendations: string[];
  codeSmells: number;
  technicalDebt: string;
  timestamp: string;
}

// --------------------------------------------------------------------------
// Core OpenAI helper
// --------------------------------------------------------------------------
async function chat(
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  jsonMode = false,
): Promise<string> {
  if (!API_KEY) throw new Error('VITE_OPENAI_API_KEY is not set in .env.local');

  const body: Record<string, unknown> = {
    model: 'gpt-4o-mini',
    messages,
    temperature: 0.1,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error ${resp.status}: ${err.slice(0, 300)}`);
  }

  const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

function extractJSON(text: string): Record<string, unknown> {
  try { return JSON.parse(text) as Record<string, unknown>; }
  catch {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(cleaned) as Record<string, unknown>; }
    catch {
      const first = cleaned.indexOf('{');
      const last = cleaned.lastIndexOf('}');
      if (first !== -1 && last > first) return JSON.parse(cleaned.slice(first, last + 1)) as Record<string, unknown>;
      throw new Error('Could not extract JSON from OpenAI response');
    }
  }
}

// --------------------------------------------------------------------------
// analyzeCodeWithAI
// --------------------------------------------------------------------------
export async function analyzeCodeWithAI(code: string): Promise<AIAnalysisResult> {
  const numbered = code
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(4)}: ${line}`)
    .join('\n');

  const prompt = `You are a senior software engineer performing a thorough code review.

Analyze the code below and return a JSON object. Be ACCURATE and REALISTIC:
- Give low scores to genuinely bad code, high scores to clean code
- Find EVERY real bug, security vulnerability, performance issue, logic error, anti-pattern, and style problem
- For each issue provide the EXACT line number (use the numbers prepended to each line) and a corrected version of that specific line

IMPORTANT — for the "recommendations" array:
- Each recommendation MUST be specific to THIS code only
- Name the actual functions, variables, classes, or patterns found in this code
- Reference specific line numbers where relevant
- Do NOT write generic advice like "add unit tests" or "use TypeScript" unless the code actually needs that
- Example of BAD recommendation: "Improve error handling"
- Example of GOOD recommendation: "The \`fetchUserData\` function (line 12) swallows errors silently — wrap the fetch call in try/catch and surface failures to the caller"

JSON schema — return ONLY this, no markdown, no extra text:
{
  "language": "<detected language>",
  "overallScore": <integer 0-100, realistic>,
  "issues": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "category": "Security" | "Performance" | "Logic" | "Code Quality" | "Best Practices",
      "message": "<clear description of exactly what is wrong>",
      "line": <exact 1-based line number from the prepended numbers>,
      "code": "<the exact problematic line, trimmed>",
      "suggestion": "<one-sentence fix referencing the specific code>",
      "fixedCode": "<the corrected version of that line, trimmed>"
    }
  ],
  "metrics": {
    "complexity": <0-100, 100=most complex>,
    "maintainability": <0-100>,
    "readability": <0-100>,
    "performance": <0-100>,
    "security": <0-100>,
    "documentation": <0-100>
  },
  "recommendations": [
    "<specific recommendation naming actual code elements from THIS file>",
    "<specific recommendation naming actual code elements from THIS file>",
    "<specific recommendation naming actual code elements from THIS file>",
    "<specific recommendation naming actual code elements from THIS file>",
    "<specific recommendation naming actual code elements from THIS file>"
  ],
  "technicalDebt": "<e.g. '~4 hours to fully resolve'>",
  "codeSmells": <integer count of code smells>
}

Code to analyze:
\`\`\`
${numbered}
\`\`\``;

  const raw = await chat(
    [
      { role: 'system', content: 'You are an expert code reviewer. Output valid JSON only. Be thorough, accurate, and realistic in your scoring.' },
      { role: 'user', content: prompt },
    ],
    2500,
    true,
  );

  const d = extractJSON(raw);
  const rawIssues = (d.issues as unknown[] ?? []) as Array<Record<string, unknown>>;
  const rawMetrics = (d.metrics as Record<string, number> | undefined) ?? {};

  const issues: AIIssue[] = rawIssues.map((issue, idx) => ({
    id: `ai-issue-${idx}`,
    type: String(issue.category ?? 'general').toLowerCase().replace(/\s+/g, '-'),
    severity: (['critical', 'high', 'medium', 'low'].includes(String(issue.severity)) ? issue.severity : 'medium') as AIIssue['severity'],
    category: String(issue.category ?? 'Code Quality'),
    message: String(issue.message ?? 'Issue detected'),
    line: Number(issue.line) || 0,
    column: 1,
    code: String(issue.code ?? ''),
    suggestion: String(issue.suggestion ?? ''),
    fixedCode: String(issue.fixedCode ?? ''),
    confidence: 92,
    impact: issue.severity === 'critical' ? 'high' : issue.severity === 'high' ? 'medium' : 'low',
    effort: issue.severity === 'critical' ? 'high' : 'medium',
  }));

  const score = (key: string, fallback = 75) => Math.max(0, Math.min(100, Number(rawMetrics[key] ?? fallback)));

  return {
    language: String(d.language ?? 'unknown'),
    overallScore: Math.max(0, Math.min(100, Number(d.overallScore) || 75)),
    issues,
    summary: {
      totalIssues: issues.length,
      criticalIssues: issues.filter(i => i.severity === 'critical').length,
      highIssues: issues.filter(i => i.severity === 'high').length,
      mediumIssues: issues.filter(i => i.severity === 'medium').length,
      lowIssues: issues.filter(i => i.severity === 'low').length,
      securityIssues: issues.filter(i => i.category === 'Security').length,
      performanceIssues: issues.filter(i => i.category === 'Performance').length,
      qualityIssues: issues.filter(i => i.category === 'Code Quality').length,
    },
    metrics: {
      complexity: score('complexity', 50),
      maintainability: score('maintainability'),
      readability: score('readability'),
      performance: score('performance'),
      security: score('security'),
      documentation: score('documentation', 40),
      cyclomaticComplexity: Math.max(1, Math.round(score('complexity', 50) / 10)),
      cognitiveComplexity: Math.max(1, Math.round(score('complexity', 50) / 12)),
      linesOfCode: code.split('\n').length,
      duplicateLines: 0,
      testCoverage: 0,
    },
    recommendations: ((d.recommendations as string[] | undefined) ?? []).slice(0, 5),
    codeSmells: Number(d.codeSmells) || 0,
    technicalDebt: String(d.technicalDebt ?? 'Unknown'),
    timestamp: new Date().toISOString(),
  };
}

// --------------------------------------------------------------------------
// explainCodeWithAI
// --------------------------------------------------------------------------
export interface CodeExplanation {
  language: string;
  purpose: string;
  overview: string;
  complexity: 'Simple' | 'Moderate' | 'Complex';
  sections: Array<{ title: string; lines: string; explanation: string }>;
  inputs: string[];
  outputs: string;
  dependencies: string[];
  audience: string;
  keyPoints: string[];
}

export async function explainCodeWithAI(code: string): Promise<CodeExplanation> {
  const numbered = code
    .split('\n')
    .map((line, i) => `${String(i + 1).padStart(4)}: ${line}`)
    .join('\n');

  const prompt = `You are an expert software engineer and technical writer. Explain the following code in clear, plain English so that it can be understood by a junior developer or non-technical stakeholder.

Return ONLY a valid JSON object matching this exact schema — no markdown, no extra text:
{
  "language": "<detected programming language>",
  "purpose": "<one clear sentence: what does this code do overall?>",
  "overview": "<2-3 sentence paragraph giving a high-level explanation of the code's logic and flow>",
  "complexity": "Simple" | "Moderate" | "Complex",
  "sections": [
    {
      "title": "<short name for this logical section>",
      "lines": "<e.g. '1-5' or '12-20'>",
      "explanation": "<plain English explanation of what this block does and why>"
    }
  ],
  "inputs": ["<param or input: description>"],
  "outputs": "<what does the code return, emit, or produce? Be specific>",
  "dependencies": ["<library or framework name>"],
  "audience": "<who would typically write or use this code? e.g. 'Backend developers working with REST APIs'>",
  "keyPoints": [
    "<important thing to know about this code>",
    "<another key insight, gotcha, or notable pattern>"
  ]
}

Code to explain (line numbers prepended):
\`\`\`
${numbered}
\`\`\``;

  const raw = await chat(
    [
      { role: 'system', content: 'You are an expert at explaining code clearly. Output valid JSON only. Be specific to the actual code provided — never give generic descriptions.' },
      { role: 'user', content: prompt },
    ],
    1500,
    true,
  );

  const d = extractJSON(raw) as Record<string, unknown>;

  return {
    language: String(d.language ?? 'Unknown'),
    purpose: String(d.purpose ?? 'Purpose not determined'),
    overview: String(d.overview ?? ''),
    complexity: (['Simple', 'Moderate', 'Complex'].includes(String(d.complexity)) ? d.complexity : 'Moderate') as CodeExplanation['complexity'],
    sections: ((d.sections as Array<Record<string, string>> | undefined) ?? []).map(s => ({
      title: String(s.title ?? ''),
      lines: String(s.lines ?? ''),
      explanation: String(s.explanation ?? ''),
    })),
    inputs: ((d.inputs as string[] | undefined) ?? []).map(String),
    outputs: String(d.outputs ?? ''),
    dependencies: ((d.dependencies as string[] | undefined) ?? []).map(String),
    audience: String(d.audience ?? ''),
    keyPoints: ((d.keyPoints as string[] | undefined) ?? []).map(String),
  };
}

// --------------------------------------------------------------------------
// chatWithAI
// --------------------------------------------------------------------------
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function chatWithAI(
  code: string,
  analysis: AIAnalysisResult | null,
  history: ChatMessage[],
  userMessage: string,
): Promise<string> {
  const analysisCtx = analysis
    ? `Analysis results:
- Language: ${analysis.language}
- Overall Score: ${analysis.overallScore}/100
- Total Issues: ${analysis.summary.totalIssues} (${analysis.summary.criticalIssues} critical, ${analysis.summary.highIssues} high, ${analysis.summary.mediumIssues} medium, ${analysis.summary.lowIssues} low)
- Technical Debt: ${analysis.technicalDebt}
- Code Smells: ${analysis.codeSmells}
- Issues:
${analysis.issues.slice(0, 8).map(i => `  [${i.severity.toUpperCase()}] Line ${i.line}: ${i.message} → ${i.suggestion}`).join('\n')}
- Recommendations:
${analysis.recommendations.map(r => `  • ${r}`).join('\n')}`
    : 'No analysis has been run yet on this code.';

  const systemPrompt = `You are an expert code assistant. The user is asking about the following code:

\`\`\`
${code}
\`\`\`

${analysisCtx}

Rules:
- Answer questions specifically about THIS code
- Reference exact line numbers when relevant
- Keep answers concise and actionable
- When providing fixed code, use code blocks
- If no code is pasted yet, politely ask the user to paste code first`;

  const raw = await chat(
    [
      { role: 'system', content: systemPrompt },
      ...history,
      { role: 'user', content: userMessage },
    ],
    1000,
  );
  return raw.trim();
}

// --------------------------------------------------------------------------
// fixCodeWithAI
// --------------------------------------------------------------------------
export async function fixCodeWithAI(
  code: string,
  issues: Array<{ line?: number; severity?: string; message?: string; suggestion?: string }>,
  language: string,
): Promise<string> {
  const issueList = issues.length
    ? issues
        .map(i => `  Line ${i.line ?? '?'}: [${i.severity ?? 'medium'}] ${i.message}${i.suggestion ? ' → Fix: ' + i.suggestion : ''}`)
        .join('\n')
    : '  Improve overall code quality, fix all bugs, security issues, and bad practices.';

  const prompt = `Fix ALL the listed issues in the following ${language || 'code'}.

Issues to fix:
${issueList}

RULES — strictly follow:
1. Return ONLY the complete corrected source code
2. No markdown fences, no backticks, no explanations, no comments about changes
3. Fix every listed issue precisely
4. Preserve the original code structure, logic, and indentation
5. Do not introduce new issues

Code to fix:
${code}`;

  const raw = await chat(
    [
      {
        role: 'system',
        content: 'You are a precise code repair engine. Return only the corrected source code. No markdown, no backticks, no explanations whatsoever.',
      },
      { role: 'user', content: prompt },
    ],
    4000,
  );

  let fixed = raw.trim();
  // Strip markdown if the model ignores instructions
  if (fixed.startsWith('```')) {
    fixed = fixed.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
  }
  return fixed;
}
