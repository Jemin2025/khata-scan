module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY || '';

  if (!apiKey) {
    return res.status(503).json({
      error: 'ANTHROPIC_API_KEY not configured. Falling back to local OCR in browser.'
    });
  }

  try {
    const { contentBlock, prompt } = req.body || {};

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: [contentBlock, { type: 'text', text: prompt }]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Anthropic API error: ' + errText });
    }

    const data = await response.json();
    return res.json(data);

  } catch (err) {
    console.error('OCR API error:', err.message);
    return res.status(500).json({ error: 'Server OCR error: ' + err.message });
  }
};
