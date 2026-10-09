import { API_BASE } from '@/config/env';

import { ApiError, NetworkError } from './errors';

/**
 * Supplied by the session layer, so this module never imports it (no cycle).
 * `refresh` must be single-flight: the API treats a replayed refresh token as
 * theft and revokes every token on the device.
 */
export interface AuthHooks {
  getAccessToken(): string | null;
  /** Rotate the token pair. Resolves to the new access token, or null if the session is dead. */
  refresh(): Promise<string | null>;
  /** The server holds this account until its password is changed. */
  onPasswordChangeRequired(): void;
}

let hooks: AuthHooks | null = null;

export function setAuthHooks(next: AuthHooks): void {
  hooks = next;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Send the bearer token. Off only for login and refresh. */
  auth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = Object.entries(query)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
  return params.length ? `${url}?${params.join('&')}` : url;
}

async function send(path: string, opts: RequestOptions, token: string | null): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    return await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch (e) {
    throw new NetworkError(e);
  }
}

async function toError(res: Response): Promise<ApiError> {
  try {
    const json = await res.json();
    const err = json?.error;
    if (err?.code) return new ApiError(err.code, err.message ?? err.code, res.status, err.details ?? {});
  } catch {
    // Not the envelope — fall through.
  }
  return new ApiError('INTERNAL_ERROR', `HTTP ${res.status}`, res.status);
}

/** Call a `/api/v1` JSON endpoint. Retries once through a token refresh on TOKEN_EXPIRED. */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const useAuth = opts.auth !== false;
  let token = useAuth ? (hooks?.getAccessToken() ?? null) : null;

  if (useAuth && !token && hooks) token = await hooks.refresh();

  let res = await send(path, opts, token);

  if (useAuth && res.status === 401 && hooks) {
    const err = await toError(res);
    if (err.code !== 'TOKEN_EXPIRED') throw err;
    const fresh = await hooks.refresh();
    if (!fresh) throw err;
    res = await send(path, opts, fresh);
  }

  if (!res.ok) {
    const err = await toError(res);
    if (err.code === 'PASSWORD_CHANGE_REQUIRED') hooks?.onPasswordChangeRequired();
    throw err;
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
