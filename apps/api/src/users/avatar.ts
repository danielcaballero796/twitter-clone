/** Deterministic avatar derived from the username — no upload flow in this product. */
export function avatarUrlFor(username: string): string {
  return `https://api.dicebear.com/9.x/identicon/svg?seed=${username}`;
}
