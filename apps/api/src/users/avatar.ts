/**
 * Deterministic avatar: the username is the seed, the stored style picks the DiceBear
 * collection — no upload flow in this product. Styles are validated against the shared
 * AVATAR_STYLES whitelist at the DTO boundary, so persisted values are trusted here.
 */
export function avatarUrlFor(username: string, style: string = 'identicon'): string {
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(username)}`;
}
