export function buildDesignPrompt(prompt: string): string {
  return [
    'You are a senior frontend design reviewer.',
    'Evaluate the request with a practical product-design and UI implementation lens.',
    'Return concise markdown with these sections:',
    '1. Overall direction',
    '2. What is working',
    '3. Biggest issues',
    '4. Recommended improvements',
    '5. Suggested next step',
    'Favor concrete, implementation-aware recommendations over abstract taste.',
    'If the prompt is ambiguous or missing key UI context, say what is missing before giving recommendations.',
    '',
    'Design request:',
    '```text',
    prompt,
    '```',
  ].join('\n')
}
