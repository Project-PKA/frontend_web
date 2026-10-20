/**
 * The API speaks UTC; the person speaks in the time zone of their profile. The field
 * `datetime-local` gives and takes a text without a zone ("2026-10-18T21:30"), so these two
 * functions translate between that text (read in the profile's zone) and an instant in UTC.
 */

const LOCAL_INPUT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** The offset of a zone from UTC at an instant, in milliseconds (positive east of Greenwich). */
function offsetAt(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    value('year'),
    value('month') - 1,
    value('day'),
    value('hour'),
    value('minute'),
    value('second'),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * "2026-10-18T21:30" read as that time in `timeZone`, as an ISO instant in UTC. `null` when the
 * text is not a date and time. (A time that does not exist or happens twice because of a change
 * of clock resolves to the first valid instant.)
 */
export function localInputToUtc(value: string, timeZone: string): string | null {
  const match = LOCAL_INPUT.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
  ];
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  if (Number.isNaN(wall) || new Date(wall).getUTCMonth() !== month - 1) return null;
  // The offset depends on the instant, which depends on the offset: two passes settle it.
  let instant = wall - offsetAt(wall, timeZone);
  instant = wall - offsetAt(instant, timeZone);
  return new Date(instant).toISOString();
}

/** An instant in UTC as the text a `datetime-local` field takes, in `timeZone`. */
export function utcToLocalInput(iso: string, timeZone: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '';
  const shifted = new Date(time + offsetAt(time, timeZone));
  return shifted.toISOString().slice(0, 16);
}
