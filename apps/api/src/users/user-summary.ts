import type { UserSummary } from '@twitterclone/shared';
import { avatarUrlFor } from './avatar';

/**
 * Single source of truth for the Prisma projection backing UserSummary — shared by
 * tweets.service (author), follows.service (followers/following), and users.service
 * (search) so the fields required by `toUserSummary` never drift across call sites.
 */
export const USER_SUMMARY_SELECT = {
  id: true,
  username: true,
  displayName: true,
  avatarStyle: true,
} as const;

export interface UserSummaryRow {
  id: string;
  username: string;
  displayName: string;
  avatarStyle: string;
}

/** Maps a USER_SUMMARY_SELECT row to the API's UserSummary shape, session-relative on isFollowing. */
export function toUserSummary(row: UserSummaryRow, followingSet: Set<string>): UserSummary {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    avatarUrl: avatarUrlFor(row.username, row.avatarStyle),
    isFollowing: followingSet.has(row.id),
  };
}
