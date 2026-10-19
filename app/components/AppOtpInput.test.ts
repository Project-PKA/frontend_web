import { render, screen } from '@testing-library/vue';
import { mount } from '@vue/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import AppOtpInput from './AppOtpInput.vue';

const digitLabel = (position: number, total: number) => `Digit ${position} of ${total}`;

function setup(options: { length?: number; initial?: string } = {}) {
  const value = ref(options.initial ?? '');
  const completed: string[] = [];
  render({
    components: { AppOtpInput },
    template:
      '<AppOtpInput v-model="value" label="6-digit code" :digit-label="digitLabel" :length="length" @complete="onComplete" />',
    setup: () => ({
      value,
      digitLabel,
      length: options.length ?? 6,
      onComplete: (code: string) => completed.push(code),
    }),
  });
  const box = (position: number) =>
    screen.getByRole('textbox', {
      name: `Digit ${position} of ${options.length ?? 6}`,
    }) as HTMLInputElement;
  return { value, completed, box };
}

describe('AppOtpInput', () => {
  it('is a named group with one named box per digit', () => {
    setup();
    expect(screen.getByRole('group', { name: '6-digit code' })).toBeTruthy();
    expect(screen.getAllByRole('textbox')).toHaveLength(6);
  });

  it('asks for the numeric keyboard and lets the browser fill the code', () => {
    const { box } = setup();
    expect(box(1).getAttribute('inputmode')).toBe('numeric');
    expect(box(1).getAttribute('autocomplete')).toBe('one-time-code');
  });

  it('moves to the next box as digits are typed, and announces the complete code', async () => {
    const { value, completed, box } = setup();

    await userEvent.click(box(1));
    await userEvent.keyboard('123456');

    expect(value.value).toBe('123456');
    expect(completed).toEqual(['123456']);
    expect([1, 2, 3, 4, 5, 6].map((n) => box(n).value).join('')).toBe('123456');
  });

  it('ignores anything that is not a digit', async () => {
    const { value, box } = setup();

    await userEvent.click(box(1));
    await userEvent.keyboard('a-1b');

    expect(value.value).toBe('1');
    expect(box(1).value).toBe('1');
  });

  it('takes a pasted code', async () => {
    const { value, completed, box } = setup();

    await userEvent.click(box(1));
    await userEvent.paste('123 456');

    expect(value.value).toBe('123456');
    expect(completed).toEqual(['123456']);
  });

  it('cuts a pasted code that is too long', async () => {
    const { value, box } = setup();

    await userEvent.click(box(1));
    await userEvent.paste('12345678');

    expect(value.value).toBe('123456');
  });

  it('takes the whole code when the browser fills it into one box', async () => {
    const { value, box } = setup();

    await userEvent.type(box(1), '654321');

    expect(value.value).toBe('654321');
  });

  it('deletes the last digit with Backspace and goes back a box', async () => {
    const { value, box } = setup({ initial: '123' });

    await userEvent.click(box(4));
    await userEvent.keyboard('{Backspace}');

    expect(value.value).toBe('12');
    expect(document.activeElement).toBe(box(3));
  });

  it('deletes the digit of the box it is in and keeps the others in order', async () => {
    const { value, box } = setup({ initial: '1234' });

    await userEvent.click(box(2));
    await userEvent.keyboard('{Backspace}');

    expect(value.value).toBe('134');
    expect(document.activeElement).toBe(box(2));
  });

  it('moves with the arrow keys, Home and End', async () => {
    const { box } = setup({ initial: '123456' });

    await userEvent.click(box(3));
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(box(2));
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(document.activeElement).toBe(box(4));
    await userEvent.keyboard('{Home}');
    expect(document.activeElement).toBe(box(1));
    await userEvent.keyboard('{End}');
    expect(document.activeElement).toBe(box(6));
  });

  it('replaces a digit typed over an existing one', async () => {
    const { value, box } = setup({ initial: '123456' });

    await userEvent.click(box(2));
    await userEvent.keyboard('9');

    expect(value.value).toBe('193456');
  });

  it('can have another length', async () => {
    const { value, completed, box } = setup({ length: 4 });

    await userEvent.click(box(1));
    await userEvent.keyboard('1234');

    expect(screen.getAllByRole('textbox')).toHaveLength(4);
    expect(value.value).toBe('1234');
    expect(completed).toEqual(['1234']);
  });
});

describe('AppOtpInput focus', () => {
  const focusable = (wrapper: ReturnType<typeof mount>) =>
    (wrapper.vm as unknown as { focus: () => void }).focus;

  it('puts the cursor in the first empty box', async () => {
    const wrapper = mount(AppOtpInput, {
      props: { label: 'Code', digitLabel, modelValue: '12' },
      attachTo: document.body,
    });
    focusable(wrapper)();
    await Promise.resolve();
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(wrapper.findAll('input')[2]!.element);
    wrapper.unmount();
  });

  it('puts the cursor in the last box when the code is full', async () => {
    const wrapper = mount(AppOtpInput, {
      props: { label: 'Code', digitLabel, modelValue: '123456' },
      attachTo: document.body,
    });
    focusable(wrapper)();
    await Promise.resolve();
    await wrapper.vm.$nextTick();
    expect(document.activeElement).toBe(wrapper.findAll('input')[5]!.element);
    wrapper.unmount();
  });
});

describe('AppOtpInput states', () => {
  it('marks the boxes invalid and describes the group', () => {
    render(AppOtpInput, {
      props: { label: 'Code', digitLabel, invalid: true, describedby: 'code-error' },
    });
    expect(screen.getByRole('group').getAttribute('aria-describedby')).toBe('code-error');
    expect(
      screen.getAllByRole('textbox').every((box) => box.getAttribute('aria-invalid') === 'true'),
    ).toBe(true);
  });

  it('can be disabled', () => {
    render(AppOtpInput, { props: { label: 'Code', digitLabel, disabled: true } });
    expect(screen.getAllByRole('textbox').every((box) => (box as HTMLInputElement).disabled)).toBe(
      true,
    );
  });

  it('has the wider look of the access key', () => {
    render(AppOtpInput, { props: { label: 'Key', digitLabel, keys: true, length: 4 } });
    expect(screen.getByRole('group').className).toContain('otp--keys');
  });
});
