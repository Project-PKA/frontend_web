import { describe, expect, it } from 'vitest';
import {
  areaPoints,
  dayPoints,
  fromCents,
  hourBars,
  linePoints,
  niceMax,
  parsePeriod,
  pieSlices,
  priceBands,
  shares,
  sumMoney,
  ticks,
  toCents,
} from './finance';

describe('parsePeriod', () => {
  it('keeps a period the API knows', () => {
    expect(parsePeriod({ period: '15' })).toBe('15');
    expect(parsePeriod({ period: ['7', 'x'] })).toBe('7');
  });

  it('is today for anything else, like the design', () => {
    expect(parsePeriod({ period: '90' })).toBe('today');
    expect(parsePeriod({})).toBe('today');
  });
});

describe('money in cents', () => {
  it('reads decimal strings', () => {
    expect(toCents('820.50')).toBe(82050);
    expect(toCents('820')).toBe(82000);
    expect(toCents('0.5')).toBe(50);
    expect(toCents('-3.20')).toBe(-320);
  });

  it('counts a malformed amount as zero', () => {
    expect(toCents('abc')).toBe(0);
    expect(toCents('')).toBe(0);
  });

  it('writes cents back as a decimal string', () => {
    expect(fromCents(82050)).toBe('820.50');
    expect(fromCents(5)).toBe('0.05');
    expect(fromCents(-320)).toBe('-3.20');
  });

  it('sums without floating point errors', () => {
    expect(sumMoney(['0.10', '0.20'])).toBe('0.30');
    expect(sumMoney(['935.00', '178.50'])).toBe('1113.50');
    expect(sumMoney([])).toBe('0.00');
  });
});

describe('shares', () => {
  it('gives the whole percent of each value', () => {
    expect(shares([58, 42])).toEqual([58, 42]);
    expect(shares([1, 1, 1])).toEqual([33, 33, 33]);
  });

  it('is zero when there is nothing', () => {
    expect(shares([0, 0])).toEqual([0, 0]);
  });
});

describe('axis', () => {
  it('rounds the maximum up to 1, 2 or 5 times a power of ten', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(430)).toBe(500);
    expect(niceMax(600)).toBe(1000);
    expect(niceMax(1)).toBe(1);
    expect(niceMax(180)).toBe(200);
  });

  it('spreads the lines from zero to the maximum', () => {
    expect(ticks(600)).toEqual([0, 150, 300, 450, 600]);
  });
});

const box = { left: 0, right: 100, top: 0, bottom: 50 };

describe('line', () => {
  it('spaces the values and puts the maximum at the top', () => {
    expect(linePoints([0, 10, 5], 10, box)).toBe('0.0,50.0 50.0,0.0 100.0,25.0');
  });

  it('centers a single value', () => {
    expect(linePoints([10], 10, box)).toBe('50.0,0.0');
  });

  it('draws at the bottom when the maximum is zero', () => {
    expect(linePoints([0, 0], 0, box)).toBe('0.0,50.0 100.0,50.0');
  });

  it('closes the area down to the axis', () => {
    expect(areaPoints([0, 10], 10, box)).toBe('0.0,50.0 0.0,50.0 100.0,0.0 100.0,50.0');
    expect(areaPoints([], 10, box)).toBe('');
  });
});

describe('pieSlices', () => {
  it('makes one wedge per value, in order, with its share', () => {
    const slices = pieSlices([75, 25], 10, 10);
    expect(slices).toHaveLength(2);
    expect(slices.map((slice) => slice.share)).toEqual([75, 25]);
    expect(slices[0]!.path).toMatch(/^M10,10 L10\.0,0\.0 A10,10 0 1 1 /);
    expect(slices[1]!.path).toMatch(/ A10,10 0 0 1 10\.0,0\.0 Z$/);
  });

  it('leaves out what is zero and marks a full circle without a path', () => {
    expect(pieSlices([0, 5], 10, 10)).toEqual([{ path: null, value: 5, share: 100 }]);
  });

  it('is empty when there is nothing to show', () => {
    expect(pieSlices([0, 0], 10, 10)).toEqual([]);
  });
});

describe('the overview as the API sends it', () => {
  it('turns the days into the day of the month and cents, skipping rows without a day', () => {
    expect(
      dayPoints([
        { day: '2030-03-07', revenue: '120.50', profit: '80.00' },
        { revenue: '1.00' },
        { day: '2030-03-08' },
      ]),
    ).toEqual([
      { label: '7', revenue: 12050, profit: 8000 },
      { label: '8', revenue: 0, profit: 0 },
    ]);
  });

  it('keeps the price bands that have a name', () => {
    expect(priceBands([{ band: '<50', count: 14 }, { count: 3 }, { band: '>800' }])).toEqual([
      { label: '<50', value: 14 },
      { label: '>800', value: 0 },
    ]);
  });

  it('fills the 24 hours, with zero where the API said nothing', () => {
    const bars = hourBars([{ hour: 21, count: 38 }, { hour: 30, count: 9 }, { count: 2 }]);
    expect(bars).toHaveLength(24);
    expect(bars[21]).toEqual({ label: '21h', value: 38 });
    expect(bars[0]).toEqual({ label: '0h', value: 0 });
  });
});
