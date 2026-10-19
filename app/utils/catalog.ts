/** The API refuses a search shorter than this. */
export const MIN_QUERY_LENGTH = 2;

/** The text to search for, or `null` while it is too short to be worth asking. */
export function searchText(input: string): string | null {
  const text = input.trim();
  return text.length >= MIN_QUERY_LENGTH ? text.slice(0, 80) : null;
}

/**
 * Where the highlight goes when an arrow key is pressed in the list of suggestions. `null` is
 * "none": ArrowDown from the last one wraps to the first, ArrowUp from the first goes back to
 * the text field.
 */
export function moveHighlight(
  current: number | null,
  count: number,
  key: 'ArrowDown' | 'ArrowUp' | 'Home' | 'End',
): number | null {
  if (count === 0) return null;
  switch (key) {
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    case 'ArrowDown':
      return current === null ? 0 : (current + 1) % count;
    case 'ArrowUp':
      if (current === null) return count - 1;
      return current === 0 ? null : current - 1;
  }
}

/**
 * The art of a card comes from the address the catalog gives. Only a plain `https` address is
 * used: anything else (a script, an inline file, a plain `http` page) is shown as no art.
 */
export function artUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}
