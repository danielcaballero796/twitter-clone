import {
  BadGatewayException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { TextGenerator } from './text-generator';

const DEFAULT_MODEL = 'gemini-2.5-flash-lite';
const REQUEST_TIMEOUT_MS = 10_000;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

/**
 * Thin REST wrapper over Gemini's generateContent — no SDK dependency, Node's
 * built-in fetch is enough for a single-turn text call. Thinking is disabled
 * (2.5 models reason by default) because tweet rewriting doesn't need it and
 * it would burn free-tier tokens.
 */
@Injectable()
export class GeminiClient implements TextGenerator {
  private readonly logger = new Logger(GeminiClient.name);

  async generate(prompt: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI assistance is not configured (missing GEMINI_API_KEY)',
      );
    }
    const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 200,
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
    } catch (error) {
      this.logger.warn(`Gemini request failed: ${(error as Error).message}`);
      throw new BadGatewayException('AI provider is unreachable, try again shortly');
    }

    if (!response.ok) {
      this.logger.warn(`Gemini responded ${response.status}`);
      // Free-tier quota exhaustion deserves its own status so the UI can tell
      // the user to come back later instead of suggesting a pointless retry.
      if (response.status === HttpStatus.TOO_MANY_REQUESTS) {
        throw new HttpException(
          'The AI assistant is out of free quota for now',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      throw new BadGatewayException('AI provider rejected the request, try again shortly');
    }

    const body = (await response.json()) as GeminiResponse;
    const text = body.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? '')
      .join('')
      .trim();

    if (!text) {
      throw new BadGatewayException('AI provider returned an empty suggestion');
    }
    return text;
  }
}
