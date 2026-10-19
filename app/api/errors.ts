/** RFC 9457 body returned by the API. `detail` is never shown to users. */
export interface ProblemBody {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  detail?: string;
}

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'aborted' | 'parse';

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  /** Stable error code from the API, used to pick the translation. */
  readonly code: string | null;

  constructor(
    kind: ApiErrorKind,
    options: { status?: number; code?: string; cause?: unknown } = {},
  ) {
    super(options.code ?? kind, { cause: options.cause });
    this.name = 'ApiError';
    this.kind = kind;
    this.status = options.status ?? null;
    this.code = options.code ?? null;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}
