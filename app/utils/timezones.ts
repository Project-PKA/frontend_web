const FALLBACK = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Fortaleza',
  'America/Bahia',
  'America/Cuiaba',
  'America/Rio_Branco',
  'America/Noronha',
  'Europe/Lisbon',
  'UTC',
];

/**
 * The time zones to offer, always including the current one (a saved value that this browser
 * does not list would otherwise vanish from the select and be lost on the next save).
 */
export function timeZoneOptions(current: string): string[] {
  const supported = (Intl as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
  const all = supported ? supported('timeZone') : FALLBACK;
  return all.includes(current) ? all : [current, ...all];
}
