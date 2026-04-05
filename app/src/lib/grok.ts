import { grok } from './config';

export async function generateLogo(domainName: string, customPrompt?: string): Promise<Buffer> {
  let prompt = grok.logoPromptTemplate(domainName);
  if (customPrompt) {
    prompt += ' ' + customPrompt;
  }

  const response = await fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${grok.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: grok.imageModel,
      prompt,
      n: 1,
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Grok image generation failed: ${err}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;

  if (!b64) {
    throw new Error('No image returned from Grok');
  }

  return Buffer.from(b64, 'base64');
}
