import { withCors, OpenAI, extractJSON } from './_utils.js';

const handler = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const { code } = req.body || {};
  if (!code) return res.status(400).json({ error: 'Missing code parameter' });

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
}`;

    const completion = await openai.chat.completions.create({
      model: process.env.GROQ_MODEL || (process.env.GROQ_API_KEY ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
      messages: [
        { role: 'system', content: 'Expert code explainer. Output valid JSON only.' },
        { role: 'user', content: prompt + `\n\nCode:\n${numbered}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 1500
    });

    const d = extractJSON(completion.choices[0].message.content);
    const explanation = {
      language: String(d.language ?? 'Unknown'),
      purpose: String(d.purpose ?? ''),
      overview: String(d.overview ?? ''),
      complexity: d.complexity || 'Moderate',
      sections: (d.sections || []).map(s => ({
        title: String(s.title ?? ''), lines: String(s.lines ?? ''), explanation: String(s.explanation ?? ''),
      })),
      inputs: (d.inputs || []).map(String),
      outputs: String(d.outputs ?? ''),
      dependencies: (d.dependencies || []).map(String),
      audience: String(d.audience ?? ''),
      keyPoints: (d.keyPoints || []).map(String),
    };

    return res.status(200).json({ success: true, explanation });
  } catch (error) {
    console.error('Explain code error:', error);
    return res.status(500).json({ error: 'Failed to explain code', details: error.message });
  }
};

export default withCors(handler);
