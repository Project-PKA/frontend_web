const MAX_DIGITS = 11;

/** Only the digits of what was typed. */
export const phoneDigits = (value: string): string => value.replace(/\D/g, '');

/**
 * Formats a Brazilian phone number as it is typed: `(11) 91234-5678`, or `(11) 1234-5678` for
 * a landline. More than 11 digits are dropped.
 */
export function maskBrazilPhone(value: string): string {
  const digits = phoneDigits(value).slice(0, MAX_DIGITS);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  const area = digits.slice(0, 2);
  const rest = digits.slice(2);
  if (rest.length <= 4) return `(${area}) ${rest}`;
  // With 11 digits the dash goes after the fifth digit of the number, otherwise after the fourth.
  const split = digits.length === MAX_DIGITS ? 5 : 4;
  return `(${area}) ${rest.slice(0, split)}-${rest.slice(split)}`;
}

/** A number with area code: 10 digits (landline) or 11 (mobile). */
export const isBrazilPhone = (value: string): boolean =>
  [10, 11].includes(phoneDigits(value).length);
