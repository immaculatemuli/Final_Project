import { withCors, OpenAI } from './_utils.js';

const rateLimitMap = new Map();

function checkRateLimit(identifier, maxRequests = 5, windowMs = 60000) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(identifier) || [];
  const recentRequests = userRequests.filter(timestamp => now - timestamp < windowMs);
  if (recentRequests.length >= maxRequests) return false;
  recentRequests.push(now);
  rateLimitMap.set(identifier, recentRequests);
  return true;
}

const handler = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { code, issues, language, uid } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code parameter' });

  const clientId = uid || req.headers['x-forwarded-for'] || 'anonymous';
  if (!checkRateLimit(clientId + '_fix')) {
    return res.status(429).json({ error: 'Rate limit exceeded for fix requests.' });
  }

  try {
    const groqKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    const apiKey = groqKey || openaiKey;

    if (!apiKey) return res.status(500).json({ error: 'AI service not configured.' });

    const isGroq = !!groqKey;
    const openai = new OpenAI({ 
      apiKey,
      baseURL: isGroq ? 'https://api.groq.com/openai/v1' : undefined
    });

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
      model: process.env.GROQ_MODEL || (process.env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
      messages: [
        { role: 'system', content: 'You are an ultra-fast code fixing engine. Output strictly raw code.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      max_tokens: 2000
    });

    let fixedCode = completion.choices[0].message.content.trim();
    if (fixedCode.startsWith('```')) {
      fixedCode = fixedCode.replace(/^```[a-z]*\n/i, '').replace(/```$/, '').trim();
    }

    return res.status(200).json({ success: true, fixedCode });
  } catch (error) {
    console.error('Fix code error:', error);
    return res.status(500).json({ error: 'Failed to fix code', details: error.message });
  }
};

export default withCors(handler);
