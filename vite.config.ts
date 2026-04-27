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
    } catch { }
  };
  parseEnvFile(path.resolve('functions/.env'));
  // Always read root .env.local so non-functions variables (e.g. GitHub token)
  // are available in the dev proxy.
  parseEnvFile(path.resolve('.env.local'));
  if (!env.OPENAI_API_KEY && env.VITE_OPENAI_API_KEY) env.OPENAI_API_KEY = env.VITE_OPENAI_API_KEY;
  if (!env.GITHUB_TOKEN && env.VITE_GITHUB_TOKEN) env.GITHUB_TOKEN = env.VITE_GITHUB_TOKEN;
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

async function callOpenAI(apiKey: string, baseUrl: string, model: string, messages: any[], maxTokens: number, jsonMode = false) {
  const body: any = { model, messages, temperature: 0.1, max_tokens: maxTokens };
  if (jsonMode) body.response_format = { type: 'json_object' };
  
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45s timeout

      const resp = await fetch(baseUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'Intellicode-Analysis-Engine/1.0'
        },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (resp.ok) {
        const data = await resp.json() as any;
        return data.choices[0].message.content;
      }
      
      const text = await resp.text();
      throw new Error(`AI API error ${resp.status}: ${text}`);
    } catch (err: any) {
      lastErr = err;
      if (err.name === 'AbortError') throw new Error('AI analysis timed out after 45 seconds. The code might be too complex or the service is slow.');
      console.error(`AI call attempt ${attempt} failed:`, err.message);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1000)); // wait 1s before retry
    }
  }
  throw lastErr || new Error('AI connection failed after retries');
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const directEnv = readFunctionsEnv();
  const GROQ_KEY = directEnv.VITE_GROQ_API_KEY || directEnv.GROQ_API_KEY || env.VITE_GROQ_API_KEY || '';
  const GROQ_FALLBACK_KEY = directEnv.VITE_GROQ_FALLBACK_API_KEY || env.VITE_GROQ_FALLBACK_API_KEY || '';
  const AI_KEY = GROQ_KEY || GROQ_FALLBACK_KEY;
  const GITHUB_TOKEN = directEnv.GITHUB_TOKEN || directEnv.VITE_GITHUB_TOKEN || env.GITHUB_TOKEN || env.VITE_GITHUB_TOKEN || '';
  const AI_BASE_URL = GROQ_KEY ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
  const AI_MODEL = GROQ_KEY ? (directEnv.VITE_GROQ_MODEL || env.VITE_GROQ_MODEL || 'llama-3.1-8b-instant') : 'gpt-4o-mini';

  return {
    plugins: [
      react(),
      {
        name: 'openai-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = req.url ?? '';
            if (url.startsWith('/api/ping')) { 
              let internetOk = false;
              try {
                const test = await fetch('https://api.github.com/zen', { signal: AbortSignal.timeout(2000) });
                internetOk = test.ok;
              } catch { internetOk = false; }
              sendJSON(res, 200, { keyFound: !!AI_KEY, internetOk }); 
              return; 
            }

            if (url.startsWith('/mailer')) {
              try {
                const body = await readBody(req);
                const { to, toName, subject, html } = body as any;
                const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: 'muliimaculate@gmail.com', pass: 'yajaeijnwxbstnsw' } });
                await transporter.sendMail({ from: '"Intellicode" <muliimaculate@gmail.com>', to: toName ? `"${toName}" <${to}>` : to, subject, html });
                sendJSON(res, 200, { success: true });
              } catch (err: any) { sendJSON(res, 500, { error: err.message }); }
              return;
            }

            const isAnalyze = url.startsWith('/api/analyzeCode');
            const isFix = url.startsWith('/api/fixCode');
            const isGithub = url.startsWith('/api/analyzeGithubRepo');
            const isExplain = url.startsWith('/api/explainCode');
            const isChat = url.startsWith('/api/chat');
            const isRepoTree = url.startsWith('/api/repoTree');

            if (!isAnalyze && !isFix && !isGithub && !isExplain && !isChat && !isRepoTree) return next();

            if (req.method === 'OPTIONS') {
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
              res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
              res.writeHead(204); res.end(); return;
            }

            // GitHub tree browser does NOT need AI key
            if (isRepoTree) {
              try {
                const body = await readBody(req);
                const { owner, repo } = body as any;
                const h: Record<string, string> = {
                  Accept: 'application/vnd.github.v3+json',
                  'User-Agent': 'Intellicode-App',
                };
                if (GITHUB_TOKEN) {
                  h.Authorization = `Bearer ${GITHUB_TOKEN}`;
                }
                const rResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers: h });
                if (!rResp.ok) {
                  const errText = await rResp.text();
                  let details = `GitHub API ${rResp.status}`;
                  try {
                    const parsed = JSON.parse(errText) as { message?: string };
                    if (parsed?.message) details = parsed.message;
                  } catch {
                    if (errText) details = errText.slice(0, 200);
                  }
                  sendJSON(res, rResp.status, { error: `Could not load ${owner}/${repo}: ${details}` });
                  return;
                }
                const rData = await rResp.json() as any;
                const tResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${rData.default_branch}?recursive=1`, { headers: h });
                if (!tResp.ok) {
                  const errText = await tResp.text();
                  let details = `GitHub tree API ${tResp.status}`;
                  try {
                    const parsed = JSON.parse(errText) as { message?: string };
                    if (parsed?.message) details = parsed.message;
                  } catch {
                    if (errText) details = errText.slice(0, 200);
                  }
                  sendJSON(res, tResp.status, { error: `Could not load repository tree: ${details}` });
                  return;
                }
                const tData = await tResp.json() as any;
                const root: any[] = [];
                const dirMap: any = {};
                const getDir = (p: string) => {
                  if (dirMap[p]) return dirMap[p];
                  const pts = p.split('/');
                  const n = pts.pop();
                  const pp = pts.join('/');
                  const node = { name: n, path: p, type: 'dir', children: [] };
                  dirMap[p] = node;
                  if (pp) getDir(pp).children.push(node);
                  else root.push(node);
                  return node;
                };
                for (const i of tData.tree || []) {
                  if (i.path.includes('node_modules') || i.path.startsWith('.')) continue;
                  const pts = i.path.split('/');
                  const n = pts.pop();
                  const pp = pts.join('/');
                  if (i.type === 'tree') getDir(i.path);
                  else {
                    const f = { name: n, path: i.path, type: 'file', size: i.size, download_url: `https://raw.githubusercontent.com/${owner}/${repo}/${rData.default_branch}/${i.path}` };
                    if (pp) getDir(pp).children.push(f);
                    else root.push(f);
                  }
                }
                sendJSON(res, 200, { tree: root, repoInfo: { fullName: rData.full_name, stars: rData.stargazers_count, forks: rData.forks_count, language: rData.language, description: rData.description } });
              } catch (e: any) { sendJSON(res, 500, { error: e.message }); }
              return;
            }

            if (!AI_KEY) { sendJSON(res, 500, { error: 'AI key missing in .env.local' }); return; }

            // Helper to call AI with optional secondary Groq fallback for Rate Limits (429)
            const callAIWithFallback = async (messages: any[], maxTokens: number, jsonMode = false) => {
              try {
                // Try primary first
                return await callOpenAI(AI_KEY, AI_BASE_URL, AI_MODEL, messages, maxTokens, jsonMode);
              } catch (err: any) {
                // If primary is Groq and it failed with 429...
                if (GROQ_KEY && err.message.includes('429')) {
                  // Fallback: Secondary Groq Key
                  if (GROQ_FALLBACK_KEY) {
                    try {
                      console.warn('Groq Rate Limit hit. Falling back to secondary Groq key...');
                      return await callOpenAI(GROQ_FALLBACK_KEY, AI_BASE_URL, AI_MODEL, messages, maxTokens, jsonMode);
                    } catch (fallbackErr: any) {
                      if (fallbackErr.message.includes('429')) {
                        console.warn('Secondary Groq key also hit Rate Limit.');
                      } else {
                        throw fallbackErr;
                      }
                    }
                  }
                  
                  throw new Error('Groq quota/rate limit reached on all keys. Wait for reset or upgrade your Groq billing tier. You can also lower prompt size and retry.');
                }
                throw err;
              }
            };

              const truncateCode = (c: string, maxLen = 12000) => {
                if (c && c.length > maxLen) {
                  return c.substring(0, maxLen) + '\n\n// [Code truncated due to AI token limits (6000 TPM limit). Please analyze smaller snippets.]';
                }
                return c;
              };

              try {
                const body = await readBody(req);
                if (isAnalyze) {
                  const code = truncateCode(body.code as string);
                  const prompt = `Review this code and return JSON: { "overallScore": 0-100, "language": "...", "issues": [{ "severity": "...", "category": "...", "message": "...", "line": 0, "code": "...", "suggestion": "...", "fixedCode": "..." }], "metrics": { "complexity": 0, "maintainability": 0, "readability": 0, "performance": 0, "security": 0, "documentation": 0 }, "recommendations": [], "technicalDebt": "...", "codeSmells": 0 }\n\nCode:\n${code}`;
                  const raw = await callAIWithFallback([{ role: 'user', content: prompt }], 1200, true);
                const d = parseJSON(raw) as any;
                const analysis = {
                  language: d.language || 'unknown',
                  overallScore: d.overallScore || 70,
                  issues: (d.issues || []).map((i: any, idx: number) => ({ id: `i${idx}`, ...i, confidence: 90 })),
                  metrics: { ...d.metrics, linesOfCode: code.split('\n').length },
                  summary: { totalIssues: (d.issues || []).length },
                  recommendations: (d.recommendations || []).map((r: any) => typeof r === 'string' ? r : (r.title ? `${r.title}: ${r.description || ''}` : JSON.stringify(r))),
                  codeSmells: d.codeSmells || 0,
                  technicalDebt: d.technicalDebt || 'Low',
                  timestamp: new Date().toISOString()
                };
                sendJSON(res, 200, { success: true, analysis });
              } else if (isFix) {
                const { issues, language } = body as any;
                const code = truncateCode(body.code as string);
                const prompt = `Fix these issues in the ${language} code:\n${JSON.stringify(issues)}\n\nReturn ONLY the fixed code:\n${code}`;
                const fixed = await callAIWithFallback([{ role: 'user', content: prompt }], 2200);
                sendJSON(res, 200, { success: true, fixedCode: fixed.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '').trim() });
              } else if (isExplain) {
                const code = truncateCode(body.code as string);
                const prompt = `Explain this code in JSON: { "language": "...", "purpose": "...", "overview": "...", "complexity": "Moderate", "sections": [{ "title": "...", "lines": "...", "explanation": "..." }], "inputs": [], "outputs": "...", "dependencies": [], "audience": "...", "keyPoints": [] }\n\nCode:\n${code}`;
                const raw = await callAIWithFallback([{ role: 'user', content: prompt }], 1100, true);
                sendJSON(res, 200, { success: true, explanation: parseJSON(raw) });
              } else if (isChat) {
                const { history, userMessage, analysis } = body as any;
                const code = truncateCode(body.code as string);
                
                // Add line numbers to the code so the AI can answer "what does line X do?" accurately
                const lines = (code || '').split('\n').map((l: string, i: number) => `${i + 1}: ${l}`).join('\n');
                
                const sys = `You are a Senior AI Code Assistant. You have access to the code and its recent analysis.
Current Code (with line numbers):
${lines}

Current Analysis Summary:
${JSON.stringify(analysis)}

Instructions:
1. Be concise and technical.
2. If the user asks about a specific line, refer to the numbered code above.
3. Help the user understand the code logic, fix bugs, or improve performance.
4. If a line was fixed by "Auto-Fix", explain WHY it was changed based on the analysis.`;

                const reply = await callAIWithFallback([{ role: 'system', content: sys }, ...history, { role: 'user', content: userMessage }], 900);
                sendJSON(res, 200, { success: true, reply });
              }
            } catch (err: any) { sendJSON(res, 500, { error: err.message }); }
          });
        }
      }
    ],
    server: { port: 3001 }
  };
});
