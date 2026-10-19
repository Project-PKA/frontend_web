import { describe, expect, it } from 'vitest';
import { artUrl, moveHighlight, searchText } from './catalog';

describe('searchText', () => {
  it('waits for 2 characters', () => {
    expect(searchText('')).toBeNull();
    expect(searchText('p')).toBeNull();
    expect(searchText(' p ')).toBeNull();
    expect(searchText('pi')).toBe('pi');
  });

  it('trims the text and keeps it within what the API accepts', () => {
    expect(searchText('  pikachu ')).toBe('pikachu');
    expect(searchText('x'.repeat(200))).toHaveLength(80);
  });
});

describe('moveHighlight', () => {
  it('starts at the first on ArrowDown and at the last on ArrowUp', () => {
    expect(moveHighlight(null, 3, 'ArrowDown')).toBe(0);
    expect(moveHighlight(null, 3, 'ArrowUp')).toBe(2);
  });

  it('wraps down past the last one', () => {
    expect(moveHighlight(2, 3, 'ArrowDown')).toBe(0);
    expect(moveHighlight(0, 3, 'ArrowDown')).toBe(1);
  });

  it('goes back to the text field going up from the first one', () => {
    expect(moveHighlight(0, 3, 'ArrowUp')).toBeNull();
    expect(moveHighlight(2, 3, 'ArrowUp')).toBe(1);
  });

  it('jumps with Home and End', () => {
    expect(moveHighlight(1, 3, 'Home')).toBe(0);
    expect(moveHighlight(1, 3, 'End')).toBe(2);
  });

  it('has nowhere to go with no suggestions', () => {
    expect(moveHighlight(null, 0, 'ArrowDown')).toBeNull();
    expect(moveHighlight(0, 0, 'End')).toBeNull();
  });
});

describe('artUrl', () => {
  it('uses an https address', () => {
    expect(artUrl('https://images.example.com/c/1/high.webp')).toBe(
      'https://images.example.com/c/1/high.webp',
    );
  });

  it('does not use anything else', () => {
    expect(artUrl('http://images.example.com/c.png')).toBeNull();
    expect(artUrl('javascript:alert(1)')).toBeNull();
    expect(artUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(artUrl('not a url')).toBeNull();
    expect(artUrl(null)).toBeNull();
    expect(artUrl('')).toBeNull();
  });
});
