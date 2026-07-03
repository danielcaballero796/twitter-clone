import { Inject, Injectable } from '@nestjs/common';
import type { TweetAssistAction, TweetAssistResponse } from '@twitterclone/shared';
import { buildPrompt } from './prompts';
import { TEXT_GENERATOR, type TextGenerator } from './text-generator';

@Injectable()
export class AiService {
  constructor(@Inject(TEXT_GENERATOR) private readonly generator: TextGenerator) {}

  async tweetAssist(action: TweetAssistAction, text: string): Promise<TweetAssistResponse> {
    const raw = await this.generator.generate(buildPrompt(action, text.trim()));
    return { suggestion: this.sanitize(raw) };
  }

  /** Models occasionally wrap output in quotes despite instructions — strip them, never trust raw output. */
  private sanitize(raw: string): string {
    let suggestion = raw.trim();
    const wrapped =
      (suggestion.startsWith('"') && suggestion.endsWith('"')) ||
      (suggestion.startsWith('“') && suggestion.endsWith('”'));
    if (wrapped && suggestion.length > 1) {
      suggestion = suggestion.slice(1, -1).trim();
    }
    return suggestion;
  }
}
