import type { TweetAssistRequest, TweetAssistResponse } from '@twitterclone/shared';
import { request } from '../../lib/api';

export function requestTweetAssist(payload: TweetAssistRequest): Promise<TweetAssistResponse> {
  return request('/ai/tweet-assist', { method: 'POST', body: JSON.stringify(payload) });
}
