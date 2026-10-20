import type { FinanceOverview } from '../api/finance';

/** The periods the finance asks for: today, or the last 7, 15 or 30 days. */
export const PERIODS = ['today', '7', '15', '30'] as const;
export type Period = (typeof PERIODS)[number];

/** The period of the address (`/finance?period=7`); anything else is "today", like the design. */
export function parsePeriod(query: Record<string, unknown>): Period {
  const raw = Array.isArray(query.period) ? query.period[0] : query.period;
  return typeof raw === 'string' && (PERIODS as readonly string[]).includes(raw)
    ? (raw as Period)
    : 'today';
}

// ---- Money: the API sends decimal strings. Sums and shares are done in whole cents, and the
// ---- text that is shown comes from the string, never from a floating point number.

/** "820.50" to 82050 cents. A malformed amount counts as zero. */
export function toCents(amount: string): number {
  const match = /^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(amount.trim());
  if (!match) return 0;
  const cents = Number(match[2]) * 100 + Number((match[3] ?? '').padEnd(2, '0'));
  return match[1] ? -cents : cents;
}

/** 82050 cents to "820.50", the text the formatter takes. */
export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const whole = Math.abs(Math.trunc(cents));
  return `${sign}${Math.trunc(whole / 100)}.${String(whole % 100).padStart(2, '0')}`;
}

/** The sum of decimal amounts, as a decimal string. */
export function sumMoney(amounts: readonly string[]): string {
  return fromCents(amounts.reduce((total, amount) => total + toCents(amount), 0));
}

/** The share of each value in the whole, in whole percent (zero when there is nothing). */
export function shares(values: readonly number[]): number[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.map((value) => (total > 0 ? Math.round((value / total) * 100) : 0));
}

// ---- Geometry of the charts (drawn by us, in SVG: no chart library)

/** A round value above the maximum for the axis: 1, 2 or 5 times a power of ten. */
export function niceMax(max: number): number {
  if (max <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(max));
  const unit = max / power;
  const step = [1, 2, 5, 10].find((candidate) => unit <= candidate) ?? 10;
  return step * power;
}

/** The values of the horizontal lines of the axis, from 0 up to `max`. */
export function ticks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, index) => (max / count) * index);
}

export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const fixed = (value: number) => value.toFixed(1);

/** The `x,y` points of a line over equally spaced values. */
export function linePoints(values: readonly number[], max: number, box: Box): string {
  const span = box.right - box.left;
  const height = box.bottom - box.top;
  return values
    .map((value, index) => {
      const x =
        values.length === 1 ? box.left + span / 2 : box.left + (span * index) / (values.length - 1);
      const y = box.bottom - (max > 0 ? (value / max) * height : 0);
      return `${fixed(x)},${fixed(y)}`;
    })
    .join(' ');
}

/** The same line closed down to the axis, to fill the area under it. */
export function areaPoints(values: readonly number[], max: number, box: Box): string {
  if (values.length === 0) return '';
  const line = linePoints(values, max, box);
  const first = line.split(' ')[0]!.split(',')[0]!;
  const last = line.split(' ').at(-1)!.split(',')[0]!;
  return `${first},${fixed(box.bottom)} ${line} ${last},${fixed(box.bottom)}`;
}

export interface Slice {
  /** The path of the wedge; a single wedge that fills the circle has none. */
  path: string | null;
  value: number;
  share: number;
}

/** The wedges of a pie of radius `radius` centered at `center`. Values at zero are left out. */
export function pieSlices(values: readonly number[], radius: number, center: number): Slice[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  const percents = shares(values);
  if (total <= 0) return [];
  let angle = -Math.PI / 2;
  const point = (turn: number) =>
    `${fixed(center + radius * Math.cos(turn))},${fixed(center + radius * Math.sin(turn))}`;
  const slices: Slice[] = [];
  values.forEach((value, index) => {
    if (value <= 0) return;
    const sweep = (value / total) * Math.PI * 2;
    if (sweep >= Math.PI * 2 - 1e-9) {
      slices.push({ path: null, value, share: percents[index]! });
      return;
    }
    const start = angle;
    angle += sweep;
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M${center},${center} L${point(start)} A${radius},${radius} 0 ${large} 1 ${point(angle)} Z`;
    slices.push({ path, value, share: percents[index]! });
  });
  return slices;
}

// ---- The overview, as the API sends it: the contract leaves the inner fields optional.

export interface DayPoint {
  /** The day of the month (`2030-03-07` to `7`). */
  label: string;
  revenue: number;
  profit: number;
}

export function dayPoints(daily: FinanceOverview['daily']): DayPoint[] {
  return daily
    .filter((row) => row.day)
    .map((row) => ({
      label: String(Number((row.day ?? '').slice(8, 10)) || row.day),
      revenue: toCents(row.revenue ?? '0'),
      profit: toCents(row.profit ?? '0'),
    }));
}

export interface Bar {
  label: string;
  value: number;
}

export function priceBands(rows: FinanceOverview['sales_by_price']): Bar[] {
  return rows
    .filter((row) => row.band)
    .map((row) => ({ label: row.band ?? '', value: row.count ?? 0 }));
}

/** The bids of the 24 hours of the day, with zero for the hours the API left out. */
export function hourBars(rows: FinanceOverview['bids_by_hour']): Bar[] {
  const counts = new Array<number>(24).fill(0);
  for (const row of rows) {
    if (typeof row.hour === 'number' && row.hour >= 0 && row.hour < 24)
      counts[row.hour] = row.count ?? 0;
  }
  return counts.map((value, hour) => ({ label: `${hour}h`, value }));
}
