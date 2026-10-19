export interface FieldIds {
  control: string;
  hint: string;
  error: string;
  /** For `aria-describedby`: the texts that describe the control, if any. */
  describedby: string | undefined;
}

/** The ids that tie a form control to its hint and error message. */
export function fieldIds(options: {
  id?: string;
  generated: string;
  hint?: string;
  error?: string | null;
}): FieldIds {
  const control = options.id ?? `field-${options.generated}`;
  const hint = `${control}-hint`;
  const error = `${control}-error`;
  const described = [options.hint ? hint : null, options.error ? error : null].filter(
    (value): value is string => value !== null,
  );
  return {
    control,
    hint,
    error,
    describedby: described.length > 0 ? described.join(' ') : undefined,
  };
}
