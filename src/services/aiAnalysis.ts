/**
 * AI analysis service — routes all AI calls through the Vite dev-server
 * proxy (/api/*) so the API key stays server-side and browser CORS never
 * becomes an issue.
 */

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
// Internal proxy helper
// --------------------------------------------------------------------------
async function proxyPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  let resp: Response;
  try {
    resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Network error: could not reach the dev server. Make sure `npm run dev` is running.');
  }

  const data = await resp.json() as Record<string, unknown>;
  if (!resp.ok || data.error) {
    throw new Error(String(data.error ?? `Server error ${resp.status}`));
  }
  return data as T;
}

// --------------------------------------------------------------------------
// analyzeCodeWithAI
// --------------------------------------------------------------------------
export async function analyzeCodeWithAI(code: string): Promise<AIAnalysisResult> {
  const result = await proxyPost<{ analysis: AIAnalysisResult }>('/api/analyzeCode', { code });
  return result.analysis;
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
  const result = await proxyPost<{ explanation: CodeExplanation }>('/api/explainCode', { code });
  return result.explanation;
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
  const result = await proxyPost<{ reply: string }>('/api/chat', {
    code,
    analysis,
    history,
    userMessage,
  });
  return result.reply;
}

// --------------------------------------------------------------------------
// fixCodeWithAI
// --------------------------------------------------------------------------
export async function fixCodeWithAI(
  code: string,
  issues: Array<{ line?: number; severity?: string; message?: string; suggestion?: string }>,
  language: string,
): Promise<string> {
  const result = await proxyPost<{ fixedCode: string }>('/api/fixCode', { code, issues, language });
  return result.fixedCode;
}
