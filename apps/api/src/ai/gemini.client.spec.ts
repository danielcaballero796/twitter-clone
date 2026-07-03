import { BadGatewayException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import { GeminiClient } from './gemini.client';

describe('GeminiClient', () => {
  const client = new GeminiClient();
  const originalKey = process.env.GEMINI_API_KEY;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    if (originalKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalKey;
    }
  });

  const geminiJson = (text: string) =>
    new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), {
      status: 200,
    });

  it('returns the generated text from a successful response', async () => {
    fetchSpy.mockResolvedValue(geminiJson('A rewritten tweet'));

    await expect(client.generate('prompt')).resolves.toBe('A rewritten tweet');

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(':generateContent');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(init.body as string) as {
      generationConfig: { thinkingConfig: { thinkingBudget: number } };
    };
    expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(0);
  });

  it('fails with 503 when no API key is configured', async () => {
    delete process.env.GEMINI_API_KEY;

    await expect(client.generate('prompt')).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('maps a non-200 provider response to BadGateway', async () => {
    fetchSpy.mockResolvedValue(new Response('boom', { status: 500 }));

    await expect(client.generate('prompt')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('maps provider quota exhaustion (429) to its own 429 with a friendly message', async () => {
    fetchSpy.mockResolvedValue(new Response('quota', { status: 429 }));

    const failure = client.generate('prompt');
    await expect(failure).rejects.toBeInstanceOf(HttpException);
    await failure.catch((error: HttpException) => {
      expect(error.getStatus()).toBe(429);
      expect(error.message).toContain('out of free quota');
    });
  });

  it('maps network failures to BadGateway', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(client.generate('prompt')).rejects.toBeInstanceOf(BadGatewayException);
  });

  it('rejects an empty suggestion payload', async () => {
    fetchSpy.mockResolvedValue(new Response(JSON.stringify({ candidates: [] }), { status: 200 }));

    await expect(client.generate('prompt')).rejects.toBeInstanceOf(BadGatewayException);
  });
});
