import { Test } from '@nestjs/testing';
import { AiService } from './ai.service';
import { TEXT_GENERATOR } from './text-generator';

describe('AiService', () => {
  let service: AiService;
  const generate = jest.fn<Promise<string>, [string]>();

  beforeEach(async () => {
    generate.mockReset();
    const moduleRef = await Test.createTestingModule({
      providers: [AiService, { provide: TEXT_GENERATOR, useValue: { generate } }],
    }).compile();

    service = moduleRef.get(AiService);
  });

  it('builds an action-specific prompt containing the base rules and the draft', async () => {
    generate.mockResolvedValue('Better tweet');

    await service.tweetAssist('improve', '  launched my app today finally  ');

    const prompt = generate.mock.calls[0][0];
    expect(prompt).toContain('Improve the tweet');
    expect(prompt).toContain('launched my app today finally');
    expect(prompt).toContain('under 280 characters');
    expect(prompt).toContain('Return ONLY the rewritten tweet text');
    // The draft reaches the prompt trimmed.
    expect(prompt).not.toContain('  launched');
  });

  it.each([
    ['shorten', 'significantly fewer characters'],
    ['fix-grammar', 'Correct grammar'],
    ['more-engaging', 'more engaging'],
  ] as const)('the %s action gets its own instruction', async (action, expected) => {
    generate.mockResolvedValue('x');

    await service.tweetAssist(action, 'a draft tweet long enough');

    expect(generate.mock.calls[0][0]).toContain(expected);
  });

  it('returns the suggestion trimmed', async () => {
    generate.mockResolvedValue('  A polished tweet 🚀  ');

    await expect(service.tweetAssist('improve', 'some draft text here')).resolves.toEqual({
      suggestion: 'A polished tweet 🚀',
    });
  });

  it('strips wrapping quotes the model adds despite instructions', async () => {
    generate.mockResolvedValue('"A quoted suggestion"');

    await expect(service.tweetAssist('improve', 'some draft text here')).resolves.toEqual({
      suggestion: 'A quoted suggestion',
    });
  });

  it('propagates generator failures untouched', async () => {
    generate.mockRejectedValue(new Error('provider down'));

    await expect(service.tweetAssist('improve', 'some draft text here')).rejects.toThrow(
      'provider down',
    );
  });
});
