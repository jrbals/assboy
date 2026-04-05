import { grok, pricing } from './config';

export async function priceDomain(domainName: string): Promise<{ price: number; reasoning: string }> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${grok.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: grok.textModel,
      messages: [
        { role: 'system', content: pricing.systemPrompt },
        { role: 'user', content: pricing.promptTemplate(domainName) },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`Pricing failed: ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';

  try {
    const parsed = JSON.parse(text);
    return {
      price: Math.round(parsed.price || 0),
      reasoning: parsed.reasoning || '',
    };
  } catch {
    const match = text.match(/(\d[\d,]*)/);
    return {
      price: match ? parseInt(match[1].replace(/,/g, '')) : 0,
      reasoning: text,
    };
  }
}
