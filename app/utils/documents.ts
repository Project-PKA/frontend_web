import { phoneDigits } from './phone';

const CPF_DIGITS = 11;
const CEP_DIGITS = 8;

/** A CPF as it is typed: `000.000.000-00`. More than 11 digits are dropped. */
export function maskCpf(value: string): string {
  const digits = phoneDigits(value).slice(0, CPF_DIGITS);
  const parts = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)];
  const rest = digits.slice(9);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${parts[0]}.${parts[1]}`;
  if (digits.length <= 9) return `${parts[0]}.${parts[1]}.${parts[2]}`;
  return `${parts[0]}.${parts[1]}.${parts[2]}-${rest}`;
}

/** A postal code (CEP) as it is typed: `00000-000`. More than 8 digits are dropped. */
export function maskCep(value: string): string {
  const digits = phoneDigits(value).slice(0, CEP_DIGITS);
  return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

/** The CPF has its 11 digits (the API checks the check digits). */
export const isCompleteCpf = (value: string): boolean => phoneDigits(value).length === CPF_DIGITS;

/** The CEP has its 8 digits. */
export const isCompleteCep = (value: string): boolean => phoneDigits(value).length === CEP_DIGITS;
