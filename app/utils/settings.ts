/** The longest PIX key we accept: a random key has 36 characters, an e-mail up to 77. */
export const PIX_MAX = 140;
/** The longest text of a message: the group shows short messages, and the API has its own limit. */
export const TEMPLATE_MAX = 1000;

/** The invitation link of a WhatsApp group: `https://chat.whatsapp.com/<code>`. */
export function isGroupInviteUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === 'https:' &&
      url.hostname === 'chat.whatsapp.com' &&
      url.username === '' &&
      url.password === '' &&
      /^\/[A-Za-z0-9]{10,40}\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

/** An empty field means "none": the API takes `null` to clear it. */
export function emptyToNull(value: string): string | null {
  const text = value.trim();
  return text === '' ? null : text;
}

/** How a placeholder is written in a message: `card` is `{card}`. */
export const placeholderToken = (name: string): string => `{${name}}`;

/** The placeholders that appear in a text, written between braces. */
export function placeholdersIn(text: string): string[] {
  return [...text.matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1]!);
}

/** The ones of the text that the message does not accept (the API answers 422 for them). */
export function unknownPlaceholders(text: string, allowed: readonly string[]): string[] {
  return [...new Set(placeholdersIn(text).filter((name) => !allowed.includes(name)))];
}
