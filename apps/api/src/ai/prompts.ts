import type { TweetAssistAction } from '@twitterclone/shared';

/**
 * Prompt building is pure data + one function so behavior is deterministic and
 * testable without touching any provider. The base rules apply to every action.
 */
const BASE_RULES = [
  'You rewrite tweets.',
  'Preserve the original meaning and intent.',
  'Write in the same language as the original tweet.',
  'Keep the result under 280 characters.',
  'Return ONLY the rewritten tweet text — no quotes, no explanations, no preamble.',
].join(' ');

const ACTION_INSTRUCTIONS: Record<TweetAssistAction, string> = {
  improve: 'Improve the tweet: better clarity and flow, natural tone.',
  shorten: 'Rewrite the tweet using significantly fewer characters.',
  'fix-grammar': 'Correct grammar, spelling and punctuation only. Change nothing else.',
  'more-engaging': 'Rewrite the tweet to be more engaging and social-media friendly.',
};

export function buildPrompt(action: TweetAssistAction, text: string): string {
  return `${BASE_RULES}\n\nTask: ${ACTION_INSTRUCTIONS[action]}\n\nTweet:\n${text}`;
}
