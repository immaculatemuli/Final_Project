import { withCors, OpenAI } from './_utils.js';

const handler = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { code, analysis, history, userMessage } = req.body || {};
  if (!userMessage) return res.status(400).json({ error: 'Missing userMessage' });

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

    const numberedCode = code 
      ? code.split('\n').map((l, i) => `${String(i + 1).padStart(4, ' ')}: ${l}`).join('\n')
      : '';

    let analysisCtx = 'No analysis has been run yet.';
    if (analysis) {
      const issues = analysis.issues || [];
      const issueLines = issues.map(iss => 
        `  - Line ${iss.line ?? '?'} [${iss.severity}] ${iss.category}: ${iss.message}` +
        (iss.suggestion ? ` → Fix: ${iss.suggestion}` : '')
      ).join('\n');
      analysisCtx = [
        `Overall score: ${analysis.overallScore}/100`,
        `Language: ${analysis.language ?? 'unknown'}`,
        `Technical debt: ${analysis.technicalDebt ?? 'unknown'}`,
        issues.length > 0 ? `\nKnown issues (${issues.length} total):\n${issueLines}` : 'No issues found.'
      ].join('\n');
    }

    const systemPrompt = [
      'You are an expert code assistant. The user is asking about the code shown below.',
      'The code is provided WITH line numbers on the left (format: "   1: <code>").',
      'IMPORTANT RULES:',
      '- When you mention a line, use the exact number shown on the left of that line.',
      '- Before citing a line number, look at the numbered code and confirm the line exists.',
      '- Quote the actual code from that line when referencing it.',
      '- Be specific and accurate.',
      '',
      `CODE:\n\`\`\`\n${numberedCode}\n\`\`\``,
      '',
      `ANALYSIS RESULTS:\n${analysisCtx}`,
    ].join('\n');

    const completion = await openai.chat.completions.create({
      model: process.env.GROQ_MODEL || (process.env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
      messages: [
        { role: 'system', content: systemPrompt },
        ...(history || []),
        { role: 'user', content: userMessage }
      ],
      temperature: 0.2,
      max_tokens: 1500
    });

    return res.status(200).json({ success: true, reply: completion.choices[0].message.content.trim() });
  } catch (error) {
    console.error('Chat error:', error);
    return res.status(500).json({ error: 'Failed to get AI reply', details: error.message });
  }
};

export default withCors(handler);
