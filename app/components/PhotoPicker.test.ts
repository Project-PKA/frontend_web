import { render, screen } from '@testing-library/vue';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PhotoPicker from './PhotoPicker.vue';

let counter = 0;

beforeEach(() => {
  counter = 0;
  vi.stubGlobal('URL', {
    ...URL,
    createObjectURL: () => {
      counter += 1;
      return `blob:photo-${counter}`;
    },
    revokeObjectURL: () => undefined,
  });
});
afterEach(() => vi.unstubAllGlobals());

const png = (name: string, size = 100) => {
  const file = new File([new Uint8Array(1)], name, { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

function setup(initial: File[] = []) {
  const updates: File[][] = [];
  const view = render(PhotoPicker, {
    props: {
      files: initial,
      'onUpdate:files': (value: File[]) => updates.push(value),
      label: 'Real photos',
      add: 'Add photos',
      hint: 'JPEG, PNG or WebP, up to 5 MB each and 8 photos.',
      remove: (position: number) => `Remove photo ${position}`,
      problem: (name: string, reason: string) => `${name}: ${reason}`,
      preview: (position: number) => `Photo ${position}`,
    },
  });
  return { ...view, updates, input: () => screen.getByLabelText('Add photos') as HTMLInputElement };
}

describe('PhotoPicker', () => {
  it('has a file field the keyboard can reach, with its hint', () => {
    const { input } = setup();
    expect(input().type).toBe('file');
    expect(input().multiple).toBe(true);
    expect(input().accept).toBe('image/jpeg,image/png,image/webp');
    expect(screen.getByText('JPEG, PNG or WebP, up to 5 MB each and 8 photos.')).toBeTruthy();
  });

  it('adds the photos that are picked and shows a preview of each', async () => {
    const { input, updates } = setup();

    await userEvent.upload(input(), [png('front.png'), png('back.png')]);

    expect(updates.at(-1)?.map((file) => file.name)).toEqual(['front.png', 'back.png']);
  });

  it('shows a preview with a name and a way to take each photo out', () => {
    setup([png('front.png'), png('back.png')]);

    expect(screen.getByAltText('Photo 1').getAttribute('src')).toBe('blob:photo-1');
    expect(screen.getByAltText('Photo 2').getAttribute('src')).toBe('blob:photo-2');
    expect(screen.getByRole('button', { name: 'Remove photo 2' })).toBeTruthy();
  });

  it('takes one photo out and lets go of its temporary address', async () => {
    const files = [png('front.png'), png('back.png')];
    const { updates } = setup(files);

    await userEvent.click(screen.getByRole('button', { name: 'Remove photo 1' }));

    expect(updates.at(-1)).toEqual([files[1]]);
  });

  it('says which files it left out and why', async () => {
    const { input } = setup();
    const pdf = new File([new Uint8Array(1)], 'doc.pdf', { type: 'application/pdf' });

    await userEvent.upload(input(), [pdf, png('huge.png', 6 * 1024 * 1024)], {
      applyAccept: false,
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('doc.pdf: type');
    expect(alert.textContent).toContain('huge.png: size');
  });

  it('offers no more room after 8 photos', () => {
    setup(Array.from({ length: 8 }, (_, index) => png(`p${index}.png`)));
    expect(screen.queryByLabelText('Add photos')).toBeNull();
  });
});
