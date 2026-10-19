/** The API accepts tokens between these lengths (`minLength: 20`, `maxLength: 200`). */
const MIN_LENGTH = 20;
const MAX_LENGTH = 200;

/**
 * The token of a link that carries it in the fragment (`/invite#token=...`). The fragment never
 * goes to a server, a log or a `Referer`, which is why links of this kind keep the token there
 * and not in the path or the query. Returns null when there is no usable token.
 */
export function tokenFromFragment(hash: string): string | null {
  const token = new URLSearchParams(hash.replace(/^#/, '')).get('token');
  if (token === null) return null;
  if (token.length < MIN_LENGTH || token.length > MAX_LENGTH) return null;
  return token;
}
