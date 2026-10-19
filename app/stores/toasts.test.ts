import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_TOASTS, useToastStore } from './toasts';

describe('toast store', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('shows a message with a tone, as info by default', () => {
    const store = useToastStore();
    store.show('Saved', 'success');
    store.show('FYI');
    expect(store.toasts.map(({ message, tone }) => [message, tone])).toEqual([
      ['Saved', 'success'],
      ['FYI', 'info'],
    ]);
  });

  it('gives each toast its own id', () => {
    const store = useToastStore();
    const first = store.show('One');
    const second = store.show('Two');
    expect(first).not.toBe(second);
  });

  it('dismisses one toast and keeps the others', () => {
    const store = useToastStore();
    const first = store.show('One');
    store.show('Two');

    store.dismiss(first);

    expect(store.toasts.map((toast) => toast.message)).toEqual(['Two']);
  });

  it('keeps only the newest ones', () => {
    const store = useToastStore();
    for (let n = 1; n <= MAX_TOASTS + 2; n += 1) store.show(`Toast ${n}`);

    expect(store.toasts).toHaveLength(MAX_TOASTS);
    expect(store.toasts[0]?.message).toBe('Toast 3');
    expect(store.toasts.at(-1)?.message).toBe(`Toast ${MAX_TOASTS + 2}`);
  });

  it('clears everything', () => {
    const store = useToastStore();
    store.show('One');
    store.clear();
    expect(store.toasts).toEqual([]);
  });
});
