import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import nodemailer from 'nodemailer';

// ---------------------------------------------------------------------------
// Helpers for the dev-server OpenAI proxy plugin
// ---------------------------------------------------------------------------

function readFunctionsEnv(): Record<string, string> {
  const env: Record<string, string> = {};

  // Parse any .env-style file, handling both LF and CRLF line endings
  const parseEnvFile = (filePath: string) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) continue;
        const key = line.slice(0, eqIdx).trim();
        const value = line.slice(eqIdx + 1).trim();
        if (key) env[key] = value;
      }
    } catch {
      // file not found — skip silently
    }
  };

  // Primary: functions/.env (OPENAI_API_KEY)
  parseEnvFile(path.resolve('functions/.env'));

  // Fallback: .env.local (VITE_OPENAI_API_KEY → exposed as OPENAI_API_KEY)
  if (!env.OPENAI_API_KEY) {
    parseEnvFile(path.resolve('.env.local'));
    if (env.VITE_OPENAI_API_KEY) {
      env.OPENAI_API_KEY = env.VITE_OPENAI_API_KEY;
    }
  }

  return env;
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

async function callOpenAI(
  apiKey: string,
  baseUrl: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
  jsonMode = false,
): Promise<string> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: 0.1,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const resp = await fetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`AI API error ${resp.status}: ${text.slice(0, 300)}`);
  }
  const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0].message.content;
}

function parseJSON(text: string): unknown {
  try { return JSON.parse(text); }
  catch {
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    try { return JSON.parse(cleaned); }
    catch {
      const first = cleaned.indexOf('{');
      const last = cleaned.lastIndexOf('}');
      if (first !== -1 && last > first) return JSON.parse(cleaned.slice(first, last + 1));
      throw new Error('Could not extract JSON from response');
    }
  }
}

function sendJSON(res: ServerResponse, status: number, data: unknown) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.writeHead(status);
  res.end(JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// Vite config
// ---------------------------------------------------------------------------
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Read .env.local directly so the key is always picked up regardless of Vite prefix rules
  const directEnv = readFunctionsEnv();
  // Also parse .env.local itself
  (() => {
    try {
      const content = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) continue;
        const key = line.slice(0, eqIdx).trim();
        const value = line.slice(eqIdx + 1).trim();
        if (key && !directEnv[key]) directEnv[key] = value;
      }
    } catch { /* ignore */ }
  })();

  const GROQ_KEY = directEnv.VITE_GROQ_API_KEY || directEnv.GROQ_API_KEY || env.VITE_GROQ_API_KEY || '';
  const OPENAI_KEY = directEnv.OPENAI_API_KEY || directEnv.VITE_OPENAI_API_KEY || env.OPENAI_API_KEY || '';
  const AI_KEY = GROQ_KEY || OPENAI_KEY;
  const AI_BASE_URL = GROQ_KEY
    ? 'https://api.groq.com/openai/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';
  const AI_MODEL = GROQ_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';

  console.log(`[AI Proxy] Using: ${GROQ_KEY ? `Groq ✓ (key: ${GROQ_KEY.slice(0, 8)}...)` : OPENAI_KEY ? `OpenAI (key: ${OPENAI_KEY.slice(0, 8)}...)` : '⚠ NO API KEY FOUND'}`);

  return {
    plugins: [
    react(),
    // ---- OpenAI proxy (dev only) ----------------------------------------
    // Intercepts /api/analyzeCode, /api/fixCode, /api/analyzeGithubRepo
    // and calls OpenAI server-side so the API key never reaches the browser.
    {
      name: 'openai-proxy',
      configureServer(server) {
        server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
          const url = req.url ?? '';

          // ------------------------------------------------------------------
          // /api/ping — key diagnostic
          // ------------------------------------------------------------------
          if (url.startsWith('/api/ping')) {
            sendJSON(res, 200, {
              keyFound: !!OPENAI_KEY,
              keyPrefix: OPENAI_KEY ? OPENAI_KEY.slice(0, 12) + '...' : null,
            });
            return;
          }

          // ------------------------------------------------------------------
          // /mailer — Gmail SMTP email sender (bypasses the /api proxy)
          // ------------------------------------------------------------------
          if (url.startsWith('/mailer')) {
            if (req.method === 'OPTIONS') {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.writeHead(204); res.end(); return;
            }
            if (req.method !== 'POST') {
              sendJSON(res, 405, { error: 'Method Not Allowed' }); return;
            }
            try {
              const body = await readBody(req);
              const { to, toName, subject, html } = body as Record<string, string>;
              if (!to || !html) { sendJSON(res, 400, { error: 'Missing to or html' }); return; }

              const GMAIL_USER = 'muliimaculate@gmail.com';
              const GMAIL_PASS = 'yajaeijnwxbstnsw';

              const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: { user: GMAIL_USER, pass: GMAIL_PASS },
              });

              await transporter.sendMail({
                from: `"AI Code Intelligence" <${GMAIL_USER}>`,
                to: toName ? `"${toName}" <${to}>` : to,
                subject: subject || 'Code Analysis Report',
                html,
              });

              sendJSON(res, 200, { success: true });
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error('[mailer]', msg);
              sendJSON(res, 500, { error: msg });
            }
            return;
          }

          const isAnalyze = url.startsWith('/api/analyzeCode');
          const isFix = url.startsWith('/api/fixCode');
          const isGithub = url.startsWith('/api/analyzeGithubRepo');
          const isExplain = url.startsWith('/api/explainCode');
          const isChat = url.startsWith('/api/chat');

          if (!isAnalyze && !isFix && !isGithub && !isExplain && !isChat) return next();

          // Handle CORS preflight
          if (req.method === 'OPTIONS') {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.writeHead(204);
            res.end();
            return;
          }

          const apiKey = AI_KEY;
          if (!apiKey) {
            sendJSON(res, 500, { error: 'No API key found. Set VITE_GROQ_API_KEY (free) or VITE_OPENAI_API_KEY in .env.local' });
            return;
          }

          try {
            const body = await readBody(req);

            // ----------------------------------------------------------------
            // /api/analyzeCode
            // ----------------------------------------------------------------
            if (isAnalyze) {
              const code = body.code as string | undefined;
              const langHint = (body.language as string | undefined) || 'unknown';
              if (!code) { sendJSON(res, 400, { error: 'Missing code parameter' }); return; }

              const numbered = code.split('\n')
                .map((l, i) => `${String(i + 1).padStart(4, ' ')}: ${l}`)
                .join('\n');

              const prompt = `You are a senior code reviewer. Analyze the code below and return a JSON object.

Be THOROUGH and REALISTIC:
- Find every bug, security hole, performance issue, logic error, anti-pattern, and bad practice
- Assign realistic scores (bad code should score low, good code should score high)
- For every issue give the EXACT line number and a corrected version of that specific line

Return ONLY this JSON (no markdown, no extra text):
{
  "overallScore": <integer 0-100>,
  "language": "<detected language>",
  "issues": [
    {
      "severity": "critical" | "high" | "medium" | "low",
      "category": "Security" | "Performance" | "Logic" | "Code Quality" | "Best Practices",
      "message": "<clear description of what is wrong>",
      "line": <exact 1-based line number>,
      "code": "<the exact problematic line, trimmed>",
      "suggestion": "<how to fix it in one sentence>",
      "fixedCode": "<the corrected line, trimmed>"
    }
  ],
  "metrics": {
    "complexity": <0-100>,
    "maintainability": <0-100>,
    "readability": <0-100>,
    "performance": <0-100>,
    "security": <0-100>,
    "documentation": <0-100>
  },
  "recommendations": ["<top actionable recommendation>", "<rec 2>", "<rec 3>"],
  "technicalDebt": "<estimated fix effort e.g. '3 hours'>",
  "codeSmells": <integer count>
}

Code (line numbers prepended):
\`\`\`
${numbered}
\`\`\``;

              const raw = await callOpenAI(apiKey, AI_BASE_URL, AI_MODEL, [
                { role: 'system', content: 'You are an expert code reviewer. Output valid JSON only. Be accurate and thorough.' },
                { role: 'user', content: prompt },
              ], 2500, true);

              const d = parseJSON(raw) as Record<string, unknown>;
              const issues = (d.issues as unknown[] || []) as Array<Record<string, unknown>>;
              const metrics = (d.metrics as Record<string, number> | undefined) ?? {};

              const analysis = {
                language: (d.language as string) || langHint,
                overallScore: Math.max(0, Math.min(100, Number(d.overallScore) || 75)),
                issues: issues.map((issue, idx) => ({
                  id: `issue-${idx}`,
                  type: String(issue.category ?? 'general').toLowerCase().replace(/\s+/g, '-'),
                  severity: issue.severity || 'medium',
                  category: issue.category || 'Code Quality',
                  message: issue.message || 'Issue detected',
                  line: Number(issue.line) || 0,
                  column: 1,
                  code: issue.code || '',
                  suggestion: issue.suggestion || '',
                  fixedCode: issue.fixedCode || '',
                  confidence: 92,
                  impact: issue.severity === 'critical' ? 'high' : issue.severity === 'high' ? 'medium' : 'low',
                  effort: issue.severity === 'critical' ? 'high' : 'medium',
                })),
                metrics: {
                  complexity: metrics.complexity ?? 50,
                  maintainability: metrics.maintainability ?? 75,
                  readability: metrics.readability ?? 75,
                  performance: metrics.performance ?? 75,
                  security: metrics.security ?? 75,
                  documentation: metrics.documentation ?? 50,
                  cyclomaticComplexity: Math.max(1, Math.floor((metrics.complexity ?? 50) / 10)),
                  cognitiveComplexity: Math.max(1, Math.floor((metrics.complexity ?? 50) / 12)),
                  linesOfCode: code.split('\n').length,
                  duplicateLines: 0,
                  testCoverage: 0,
                },
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
                recommendations: (d.recommendations as string[]) || [],
                codeSmells: Number(d.codeSmells) || 0,
                technicalDebt: String(d.technicalDebt || 'Unknown'),
                timestamp: new Date().toISOString(),
              };

              sendJSON(res, 200, { success: true, analysis });
              return;
            }

            // ----------------------------------------------------------------
            // /api/fixCode
            // ----------------------------------------------------------------
            if (isFix) {
              const code = body.code as string | undefined;
              const issues = (body.issues as Array<Record<string, unknown>> | undefined) || [];
              const lang = (body.language as string | undefined) || 'code';
              if (!code) { sendJSON(res, 400, { error: 'Missing code parameter' }); return; }

              const issueList = issues.length
                ? issues.map(i => `  Line ${i.line}: [${i.severity}] ${i.message} → ${i.suggestion || 'Fix this'}`).join('\n')
                : '  Improve overall code quality, fix all bugs and security issues.';

              const prompt = `Fix ALL the listed issues in this ${lang} code.

Issues to fix:
${issueList}

Rules:
- Return ONLY the complete corrected source code
- Do NOT include markdown fences, backticks, or any explanation
- Fix every listed issue precisely
- Preserve the original structure, logic, and indentation style
- Do not add unnecessary changes

Code to fix:
${code}`;

              const rawFixed = await callOpenAI(apiKey, AI_BASE_URL, AI_MODEL, [
                { role: 'system', content: 'You are a precise code repair engine. Return only the fixed source code. Absolutely no markdown, no backticks, no explanations.' },
                { role: 'user', content: prompt },
              ], 4000);

              let fixedCode = rawFixed.trim();
              if (fixedCode.startsWith('```')) {
                fixedCode = fixedCode.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '').trim();
              }

              sendJSON(res, 200, { success: true, fixedCode });
              return;
            }

            // ----------------------------------------------------------------
            // /api/analyzeGithubRepo
            // ----------------------------------------------------------------
            if (isGithub) {
              const repoUrl = body.repoUrl as string | undefined;
              const uid = body.uid;
              if (!repoUrl) { sendJSON(res, 400, { error: 'Missing repoUrl parameter' }); return; }

              const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
              if (!match) { sendJSON(res, 400, { error: 'Invalid GitHub repository URL' }); return; }

              const [, owner, repo] = match;
              const repoName = repo.replace(/\.git$/, '');

              // Fetch repo info
              const repoResp = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
                headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'Intellicode-App' },
              });
              if (!repoResp.ok) {
                sendJSON(res, repoResp.status, { error: `GitHub API error: ${repoResp.status}` });
                return;
              }
              const repoInfo = await repoResp.json() as Record<string, unknown>;
              if (repoInfo.private) { sendJSON(res, 403, { error: 'Cannot analyze private repositories' }); return; }

              // Fetch file list
              const contentsResp = await fetch(`https://api.github.com/repos/${owner}/${repoName}/contents`, {
                headers: { Accept: 'application/vnd.github.v3+json', 'User-Agent': 'Intellicode-App' },
              });
              if (!contentsResp.ok) { sendJSON(res, 500, { error: 'Failed to fetch repository contents' }); return; }
              const files = await contentsResp.json() as Array<Record<string, unknown>>;

              const codeExts = ['.js', '.ts', '.py', '.java', '.jsx', '.tsx', '.php', '.rb', '.go', '.cpp', '.c'];
              const codeFiles = files.filter(f =>
                f.type === 'file' && codeExts.some(ext => (f.name as string).endsWith(ext))
              ).slice(0, 5);
              if (!codeFiles.length) { sendJSON(res, 400, { error: 'No code files found in repository root' }); return; }

              const firstFile = codeFiles[0];
              const fileResp = await fetch(firstFile.download_url as string);
              const codeContent = await fileResp.text();

              if (codeContent.length > 60 * 1024) {
                sendJSON(res, 413, { error: `File ${firstFile.name} is too large (> 60 KB)` });
                return;
              }

              const language = (firstFile.name as string).split('.').pop() || 'unknown';
              const numbered = codeContent.split('\n')
                .map((l, i) => `${String(i + 1).padStart(4, ' ')}: ${l}`)
                .join('\n');

              const prompt = `Analyze this ${language} file from GitHub (${owner}/${repoName}/${firstFile.name}).
Find ALL issues: bugs, security holes, performance problems, bad practices.
For each issue give the EXACT line number and corrected line.

Return ONLY valid JSON:
{
  "overallScore": <0-100>,
  "language": "${language}",
  "issues": [{"severity":"...","category":"...","message":"...","line":<n>,"code":"...","suggestion":"...","fixedCode":"..."}],
  "metrics": {"complexity":0,"maintainability":0,"readability":0,"performance":0,"security":0,"documentation":0},
  "recommendations": ["..."],
  "technicalDebt": "...",
  "codeSmells": 0
}

Code:
\`\`\`
${numbered}
\`\`\``;

              const raw = await callOpenAI(apiKey, AI_BASE_URL, AI_MODEL, [
                { role: 'system', content: 'Expert code reviewer. JSON output only.' },
                { role: 'user', content: prompt },
              ], 2500, true);

              const d = parseJSON(raw) as Record<string, unknown>;
              const issues = (d.issues as unknown[] || []) as Array<Record<string, unknown>>;
              const metrics = (d.metrics as Record<string, number> | undefined) ?? {};

              const analysis = {
                language,
                overallScore: Math.max(0, Math.min(100, Number(d.overallScore) || 75)),
                repository: {
                  owner, name: repoName, url: repoUrl,
                  stars: repoInfo.stargazers_count,
                  forks: repoInfo.forks_count,
                  description: repoInfo.description,
                  language: repoInfo.language,
                  analyzedFile: firstFile.name,
                  totalFilesFound: codeFiles.length,
                  analyzedFileContent: codeContent,
                },
                sourceCode: codeContent,
                issues: issues.map((issue, idx) => ({
                  id: `issue-${idx}`,
                  type: String(issue.category ?? 'general').toLowerCase().replace(/\s+/g, '-'),
                  severity: issue.severity || 'medium',
                  category: issue.category || 'Code Quality',
                  message: issue.message || 'Issue detected',
                  line: Number(issue.line) || 0,
                  column: 1,
                  code: issue.code || '',
                  suggestion: issue.suggestion || '',
                  fixedCode: issue.fixedCode || '',
                  confidence: 90,
                  impact: issue.severity === 'critical' ? 'high' : 'medium',
                  effort: 'medium',
                })),
                metrics: {
                  complexity: metrics.complexity ?? 50,
                  maintainability: metrics.maintainability ?? 75,
                  readability: metrics.readability ?? 75,
                  performance: metrics.performance ?? 75,
                  security: metrics.security ?? 75,
                  documentation: metrics.documentation ?? 50,
                  cyclomaticComplexity: Math.max(1, Math.floor((metrics.complexity ?? 50) / 10)),
                  cognitiveComplexity: Math.max(1, Math.floor((metrics.complexity ?? 50) / 12)),
                  linesOfCode: codeContent.split('\n').length,
                  duplicateLines: 0,
                  testCoverage: 0,
                },
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
                recommendations: (d.recommendations as string[]) || [],
                codeSmells: Number(d.codeSmells) || 0,
                technicalDebt: String(d.technicalDebt || 'Unknown'),
                timestamp: new Date().toISOString(),
              };

              sendJSON(res, 200, { success: true, analysis, analysisId: null });
              return;
            }

            // ----------------------------------------------------------------
            // /api/explainCode
            // ----------------------------------------------------------------
            if (isExplain) {
              const code = body.code as string | undefined;
              if (!code) { sendJSON(res, 400, { error: 'Missing code parameter' }); return; }

              const numbered = code.split('\n')
                .map((l, i) => `${String(i + 1).padStart(4, ' ')}: ${l}`)
                .join('\n');

              const prompt = `You are an expert software engineer. Explain the following code in plain English for a junior developer.

Return ONLY valid JSON — no markdown, no extra text:
{
  "language": "<detected language>",
  "purpose": "<one sentence: what the code does>",
  "overview": "<2-3 sentence high-level explanation>",
  "complexity": "Simple" | "Moderate" | "Complex",
  "sections": [{"title":"<name>","lines":"<e.g. 1-5>","explanation":"<plain English>"}],
  "inputs": ["<param: description>"],
  "outputs": "<what it returns or produces>",
  "dependencies": ["<library>"],
  "audience": "<who would use this>",
  "keyPoints": ["<key insight>", "<another insight>"]
}

Code (line numbers prepended):
\`\`\`
${numbered}
\`\`\``;

              const raw = await callOpenAI(apiKey, AI_BASE_URL, AI_MODEL, [
                { role: 'system', content: 'Expert code explainer. Output valid JSON only.' },
                { role: 'user', content: prompt },
              ], 1500, true);

              const d = parseJSON(raw) as Record<string, unknown>;
              const explanation = {
                language: String(d.language ?? 'Unknown'),
                purpose: String(d.purpose ?? ''),
                overview: String(d.overview ?? ''),
                complexity: (['Simple', 'Moderate', 'Complex'].includes(String(d.complexity)) ? d.complexity : 'Moderate') as string,
                sections: ((d.sections as Array<Record<string, string>> | undefined) ?? []).map(s => ({
                  title: String(s.title ?? ''), lines: String(s.lines ?? ''), explanation: String(s.explanation ?? ''),
                })),
                inputs: ((d.inputs as string[] | undefined) ?? []).map(String),
                outputs: String(d.outputs ?? ''),
                dependencies: ((d.dependencies as string[] | undefined) ?? []).map(String),
                audience: String(d.audience ?? ''),
                keyPoints: ((d.keyPoints as string[] | undefined) ?? []).map(String),
              };
              sendJSON(res, 200, { success: true, explanation });
              return;
            }

            // ----------------------------------------------------------------
            // /api/chat
            // ----------------------------------------------------------------
            if (isChat) {
              const code = (body.code as string | undefined) ?? '';
              const analysis = body.analysis as Record<string, unknown> | null | undefined;
              const history = (body.history as Array<{ role: string; content: string }> | undefined) ?? [];
              const userMessage = body.userMessage as string | undefined;
              if (!userMessage) { sendJSON(res, 400, { error: 'Missing userMessage' }); return; }

              const analysisCtx = analysis
                ? `Analysis: score=${analysis.overallScore}/100, issues=${(analysis.summary as any)?.totalIssues ?? 0}, debt=${analysis.technicalDebt}`
                : 'No analysis has been run yet.';

              const systemPrompt = `You are an expert code assistant. The user is asking about this code:\n\`\`\`\n${code}\n\`\`\`\n${analysisCtx}\nAnswer specifically about THIS code. Reference exact line numbers. Be concise and actionable.`;

              const raw = await callOpenAI(apiKey, AI_BASE_URL, AI_MODEL, [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: userMessage },
              ], 1000);

              sendJSON(res, 200, { success: true, reply: raw.trim() });
              return;
            }

          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error('[openai-proxy]', msg);
            sendJSON(res, 500, { error: msg });
          }
        });
      },
    },
  ],
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
    server: {
      port: 3001,
    },
  };
});
