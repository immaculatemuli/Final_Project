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
// Language detection (heuristic, 10 languages)
// --------------------------------------------------------------------------
export type SupportedLanguage =
  | 'TypeScript' | 'JavaScript' | 'Python' | 'Java' | 'C#'
  | 'C/C++' | 'Go' | 'Rust' | 'PHP' | 'Ruby' | 'Unknown';

export function detectLanguage(code: string): SupportedLanguage {
  if (!code.trim()) return 'Unknown';
  const c = code;
  const scores: Record<SupportedLanguage, number> = {
    TypeScript: 0, JavaScript: 0, Python: 0, Java: 0, 'C#': 0,
    'C/C++': 0, Go: 0, Rust: 0, PHP: 0, Ruby: 0, Unknown: 0,
  };

  // TypeScript
  if (/:\s*(string|number|boolean|void|never|any|unknown)\b/.test(c)) scores.TypeScript += 4;
  if (/\binterface\s+\w+/.test(c)) scores.TypeScript += 4;
  if (/\btype\s+\w+\s*=/.test(c)) scores.TypeScript += 4;
  if (/<[A-Z]\w*>/.test(c)) scores.TypeScript += 2;
  if (/\breadonly\b/.test(c)) scores.TypeScript += 2;
  if (/\benum\s+\w+/.test(c)) scores.TypeScript += 3;

  // JavaScript
  if (/\b(const|let|var)\s+\w+\s*=/.test(c)) scores.JavaScript += 3;
  if (/=>\s*[{(]/.test(c) || /=>\s*\w/.test(c)) scores.JavaScript += 2;
  if (/\brequire\s*\(/.test(c)) scores.JavaScript += 3;
  if (/module\.exports/.test(c)) scores.JavaScript += 4;
  if (/\bconsole\.(log|error|warn)\b/.test(c)) scores.JavaScript += 2;
  if (/\bdocument\.\w+/.test(c) || /\bwindow\.\w+/.test(c)) scores.JavaScript += 3;

  // Python
  if (/^\s*def\s+\w+\s*\(/m.test(c)) scores.Python += 5;
  if (/^\s*from\s+\w+\s+import|^\s*import\s+\w+/m.test(c)) scores.Python += 3;
  if (/\bself\.\w+/.test(c)) scores.Python += 4;
  if (/\belif\b/.test(c)) scores.Python += 5;
  if (/\blambda\s+\w+/.test(c)) scores.Python += 3;
  if (/__init__|__str__|__repr__/.test(c)) scores.Python += 4;

  // Java
  if (/\bpublic\s+(class|interface|enum)\s+\w+/.test(c)) scores.Java += 5;
  if (/\bSystem\.out\.print/.test(c)) scores.Java += 5;
  if (/@Override\b/.test(c)) scores.Java += 4;
  if (/\bimport\s+java\./.test(c)) scores.Java += 5;
  if (/\b(public|private|protected)\s+(static\s+)?(void|int|String)\b/.test(c)) scores.Java += 3;

  // C#
  if (/\busing\s+System/.test(c)) scores['C#'] += 5;
  if (/\bnamespace\s+\w+/.test(c)) scores['C#'] += 5;
  if (/\bConsole\.(Write|Read)/.test(c)) scores['C#'] += 5;
  if (/^\s*\[.*\]$/m.test(c)) scores['C#'] += 3;
  if (/\bstring\s+\w+\s*[=;]/.test(c)) scores['C#'] += 2;

  // C/C++
  if (/#include\s*[<"]/.test(c)) scores['C/C++'] += 6;
  if (/\bint\s+main\s*\(/.test(c)) scores['C/C++'] += 5;
  if (/\bprintf\s*\(/.test(c) || /\bscanf\s*\(/.test(c)) scores['C/C++'] += 4;
  if (/\bstd::\w+/.test(c)) scores['C/C++'] += 4;
  if (/\bcout\s*<</.test(c) || /\bcin\s*>>/.test(c)) scores['C/C++'] += 4;
  if (/\bnullptr\b/.test(c)) scores['C/C++'] += 3;

  // Go
  if (/^package\s+\w+/m.test(c)) scores.Go += 6;
  if (/\bfunc\s+\w+\s*\(/.test(c)) scores.Go += 4;
  if (/\bfmt\.\w+/.test(c)) scores.Go += 4;
  if (/:=/.test(c)) scores.Go += 3;
  if (/\bgo\s+func\b|\bgoroutine\b/.test(c)) scores.Go += 5;
  if (/\bchan\b/.test(c)) scores.Go += 4;

  // Rust
  if (/\bfn\s+\w+\s*\(/.test(c)) scores.Rust += 4;
  if (/\blet\s+mut\b/.test(c)) scores.Rust += 5;
  if (/\bimpl\s+\w+/.test(c)) scores.Rust += 4;
  if (/\buse\s+std::/.test(c)) scores.Rust += 5;
  if (/\bprintln!\s*\(/.test(c)) scores.Rust += 5;
  if (/\bResult<|Option</.test(c)) scores.Rust += 4;

  // PHP
  if (/<\?php/.test(c)) scores.PHP += 8;
  if (/\$\w+/.test(c)) scores.PHP += 3;
  if (/\becho\s+/.test(c)) scores.PHP += 3;
  if (/\b(isset|empty|unset)\s*\(/.test(c)) scores.PHP += 4;

  // Ruby
  if (/\bdo\s*\|.*\|/.test(c)) scores.Ruby += 4;
  if (/\b(puts|print)\s+/.test(c)) scores.Ruby += 3;
  if (/\battr_accessor\b|\battr_reader\b/.test(c)) scores.Ruby += 5;
  if (/^\s*end\s*$/m.test(c)) scores.Ruby += 3;
  if (/@\w+\s*=/.test(c)) scores.Ruby += 2;

  // TypeScript wins over JavaScript when both score high
  if (scores.TypeScript >= 4 && scores.JavaScript >= 3) return 'TypeScript';

  let best: SupportedLanguage = 'Unknown';
  let bestScore = 3;
  for (const [lang, score] of Object.entries(scores) as [SupportedLanguage, number][]) {
    if (lang !== 'Unknown' && score > bestScore) { bestScore = score; best = lang; }
  }
  return best;
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
