import { useMutation } from '@tanstack/react-query';
import { requestTweetAssist } from './api';

/**
 * Plain mutation, no query cache: a suggestion is ephemeral content tied to the
 * current draft, not server state anyone else can invalidate.
 */
export function useTweetAssist() {
  return useMutation({ mutationFn: requestTweetAssist });
}
