import { ApiError, type ProblemBody } from './errors';

export interface ApiClientOptions {
  baseUrl: string;
  /** Access token lives in memory only (Pinia session store). */
  getAccessToken: () => string | null;
  getStoreId: () => string | null;
  /** Refreshes the session once after a 401. Resolves to true when it worked. */
  refreshSession: () => Promise<boolean>;
  /** Called for every 403 before the error is thrown, e.g. to show the no-permission state. */
  onForbidden?: (error: ApiError, path: string) => void;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** JSON by default; a `Blob` (a photo) goes as it is, with its own content type. */
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Sends the refresh cookie. Needed only for the auth endpoints. */
  withCredentials?: boolean;
  /** Skips the bearer token and the store header (public pages). */
  anonymous?: boolean;
  signal?: AbortSignal;
  /** What the answer is: JSON (the default) or a file, e.g. a card photo, which needs the login. */
  parse?: 'json' | 'blob';
}

const DEFAULT_TIMEOUT_MS = 15_000;

/** A file goes as it is with its own type; anything else goes as JSON. */
function encodeBody(body: unknown): { body: BodyInit; contentType: string } | undefined {
  if (body === undefined) return undefined;
  if (body instanceof Blob) return { body, contentType: body.type };
  return { body: JSON.stringify(body), contentType: 'application/json' };
}

export function createApiClient(options: ApiClientOptions) {
  const doFetch = options.fetchImpl ?? fetch;

  function buildUrl(path: string, query: RequestOptions['query']): string {
    const url = new URL(path, options.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url.toString();
  }

  async function send(path: string, request: RequestOptions): Promise<Response> {
    const headers = new Headers({ Accept: 'application/json, application/problem+json' });
    const payload = encodeBody(request.body);
    if (payload) headers.set('Content-Type', payload.contentType);
    if (!request.anonymous) {
      const token = options.getAccessToken();
      const storeId = options.getStoreId();
      if (token) headers.set('Authorization', `Bearer ${token}`);
      if (storeId) headers.set('x-store-id', storeId);
    }

    const timeout = AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;

    try {
      return await doFetch(buildUrl(path, request.query), {
        method: request.method ?? 'GET',
        headers,
        body: payload?.body,
        credentials: request.withCredentials ? 'include' : 'same-origin',
        referrerPolicy: 'no-referrer',
        signal,
      });
    } catch (cause) {
      if (timeout.aborted) throw new ApiError('timeout', { cause });
      if (request.signal?.aborted) throw new ApiError('aborted', { cause });
      throw new ApiError('network', { cause });
    }
  }

  async function readProblem(response: Response): Promise<ProblemBody | null> {
    try {
      return (await response.json()) as ProblemBody;
    } catch {
      return null;
    }
  }

  async function toError(response: Response): Promise<ApiError> {
    const problem = await readProblem(response);
    return new ApiError('http', {
      status: response.status,
      code: typeof problem?.code === 'string' ? problem.code : undefined,
    });
  }

  async function request<T>(path: string, requestOptions: RequestOptions = {}): Promise<T> {
    let response = await send(path, requestOptions);

    if (response.status === 401 && !requestOptions.anonymous && (await options.refreshSession())) {
      response = await send(path, requestOptions);
    }

    if (!response.ok) {
      const error = await toError(response);
      if (error.status === 403) options.onForbidden?.(error, path);
      throw error;
    }
    if (response.status === 204) return undefined as T;

    try {
      if (requestOptions.parse === 'blob') return (await response.blob()) as T;
      return (await response.json()) as T;
    } catch (cause) {
      throw new ApiError('parse', { status: response.status, cause });
    }
  }

  return { request };
}

export type ApiClient = ReturnType<typeof createApiClient>;
