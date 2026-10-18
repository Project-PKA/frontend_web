import type { z } from 'zod';

/**
 * Minimal adapter between a Zod 4 schema and VeeValidate's typed schema. The
 * official `@vee-validate/zod` package only supports Zod 3. Messages in the
 * schemas are translation keys, translated by the form.
 */
export interface FormSchema<Output> {
  __type: 'VVTypedSchema';
  parse(values: unknown): Promise<{
    value?: Output;
    errors: { path?: string; errors: string[] }[];
  }>;
}

export function toFormSchema<Schema extends z.ZodType>(
  schema: Schema,
): FormSchema<z.output<Schema>> {
  return {
    __type: 'VVTypedSchema',
    async parse(values) {
      const result = await schema.safeParseAsync(values);
      if (result.success) return { value: result.data, errors: [] };

      const byPath = new Map<string, string[]>();
      for (const issue of result.error.issues) {
        const path = issue.path.join('.');
        byPath.set(path, [...(byPath.get(path) ?? []), issue.message]);
      }
      return {
        errors: [...byPath].map(([path, errors]) => ({ path, errors })),
      };
    },
  };
}
