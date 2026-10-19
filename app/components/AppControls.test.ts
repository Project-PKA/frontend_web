import { render, screen } from '@testing-library/vue';
import { mount } from '@vue/test-utils';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import AppInput from './AppInput.vue';
import AppSelect from './AppSelect.vue';
import AppTextarea from './AppTextarea.vue';

describe('AppInput', () => {
  it('is found by its label', () => {
    render(AppInput, { props: { label: 'E-mail' } });
    expect(screen.getByLabelText('E-mail').tagName).toBe('INPUT');
  });

  it('passes the other attributes to the input', () => {
    render(AppInput, {
      props: { label: 'E-mail' },
      attrs: { type: 'email', autocomplete: 'email', name: 'email' },
    });
    const input = screen.getByLabelText('E-mail');
    expect(input.getAttribute('type')).toBe('email');
    expect(input.getAttribute('autocomplete')).toBe('email');
    expect(input.getAttribute('name')).toBe('email');
  });

  it('follows v-model', async () => {
    const value = ref('');
    render({
      components: { AppInput },
      template: '<AppInput v-model="value" label="Name" />',
      setup: () => ({ value }),
    });

    await userEvent.type(screen.getByLabelText('Name'), 'Ash');

    expect(value.value).toBe('Ash');
  });

  it('is described by its hint', () => {
    render(AppInput, { props: { label: 'CPF', hint: 'Only numbers' } });
    const input = screen.getByLabelText('CPF');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByText('Only numbers').id).toBe(input.getAttribute('aria-describedby'));
  });

  it('is marked invalid and described by its error', () => {
    render(AppInput, { props: { label: 'CPF', error: 'Enter a valid CPF.' } });
    const input = screen.getByLabelText('CPF');
    const message = screen.getByText('Enter a valid CPF.');

    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(message.id);
    expect(message.className).toContain('hint--error');
  });

  it('is described by both the hint and the error', () => {
    render(AppInput, { props: { label: 'CPF', hint: 'Only numbers', error: 'Wrong' } });
    const ids = (screen.getByLabelText('CPF').getAttribute('aria-describedby') ?? '').split(' ');
    expect(ids).toEqual([screen.getByText('Only numbers').id, screen.getByText('Wrong').id]);
  });

  it('gives each field its own id', () => {
    render({
      components: { AppInput },
      template: '<div><AppInput label="One" /><AppInput label="Two" /></div>',
    });
    expect(screen.getByLabelText('One').id).not.toBe(screen.getByLabelText('Two').id);
  });

  it('can be focused from outside', () => {
    const wrapper = mount(AppInput, { props: { label: 'Name' }, attachTo: document.body });
    (wrapper.vm as unknown as { focus: () => void }).focus();
    expect(document.activeElement).toBe(wrapper.find('input').element);
    wrapper.unmount();
  });

  it('uses the id it is given', () => {
    render(AppInput, { props: { label: 'Name', id: 'customer-name' } });
    expect(screen.getByLabelText('Name').id).toBe('customer-name');
  });
});

describe('AppSelect', () => {
  it('is a labelled combobox with the options of its slot', async () => {
    const value = ref('en');
    render({
      components: { AppSelect },
      template:
        '<AppSelect v-model="value" label="Language"><option value="en">English</option><option value="pt-BR">Português</option></AppSelect>',
      setup: () => ({ value }),
    });

    const select = screen.getByRole('combobox', { name: 'Language' });
    await userEvent.selectOptions(select, 'pt-BR');

    expect(value.value).toBe('pt-BR');
    expect(select.className).toBe('select');
  });

  it('shows its error', () => {
    render(AppSelect, { props: { label: 'Language', error: 'Required' } });
    expect(screen.getByRole('combobox', { name: 'Language' }).getAttribute('aria-invalid')).toBe(
      'true',
    );
  });
});

describe('AppTextarea', () => {
  it('is a labelled multi-line field', async () => {
    const value = ref('');
    render({
      components: { AppTextarea },
      template: '<AppTextarea v-model="value" label="Notes" rows="3" />',
      setup: () => ({ value }),
    });

    const field = screen.getByLabelText('Notes');
    await userEvent.type(field, 'Mint');

    expect(field.tagName).toBe('TEXTAREA');
    expect(field.getAttribute('rows')).toBe('3');
    expect(value.value).toBe('Mint');
  });
});
