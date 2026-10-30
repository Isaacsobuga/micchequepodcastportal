import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase';

export type AdminTable = 'events' | 'episodes' | 'merchandise';
export type UploadKind = 'event-poster' | 'event-video' | 'merch-image' | 'episode-cover';

const TOKEN_KEY = 'mic-cheque-admin-token';
const ENDPOINT = `${supabaseUrl}/functions/v1/admin-api`;
const UPLOADED_PREFIX = `${supabaseUrl}/storage/v1/object/public/media/`;

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

export function isAuthError(error: unknown): boolean {
  return error instanceof AdminApiError && error.status === 401;
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isUploadedMediaUrl(url: string | null | undefined): url is string {
  return !!url && url.startsWith(UPLOADED_PREFIX);
}

export function getAdminToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearAdminToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

function requireToken(): string {
  const token = getAdminToken();
  if (!token) throw new AdminApiError('Please sign in to the admin area.', 401);
  return token;
}

function readErrorMessage(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }
  return 'Something went wrong. Please try again.';
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${supabaseAnonKey}`, apikey: supabaseAnonKey },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AdminApiError('Could not reach the server. Check your connection and try again.', 0);
  }
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new AdminApiError(readErrorMessage(payload), response.status);
  if (!payload || typeof payload !== 'object') throw new AdminApiError('The server sent an unexpected response.', response.status);
  return payload as T;
}

function callAdmin<T>(body: Record<string, unknown>): Promise<T> {
  return post<T>({ ...body, token: requireToken() });
}

export async function loginAdmin(password: string): Promise<void> {
  const data = await post<{ token?: unknown }>({ action: 'login', password });
  if (typeof data.token !== 'string') throw new AdminApiError('The server sent an unexpected response.', 500);
  window.localStorage.setItem(TOKEN_KEY, data.token);
}

export async function logoutAdmin(): Promise<void> {
  const token = getAdminToken();
  try {
    if (token) await post({ action: 'logout', token });
  } finally {
    clearAdminToken();
  }
}

export async function verifyAdminSession(): Promise<void> {
  await callAdmin({ action: 'verify' });
}

export async function listAdminRows<T>(table: AdminTable): Promise<T[]> {
  const data = await callAdmin<{ rows?: unknown }>({ action: 'list', table });
  if (!Array.isArray(data.rows)) throw new AdminApiError('The server sent an unexpected response.', 500);
  return data.rows as T[];
}

export async function saveAdminRow<T>(table: AdminTable, id: string | null, values: Record<string, unknown>): Promise<T> {
  const data = await callAdmin<{ row?: unknown }>({ action: 'save', table, id, data: values });
  if (!data.row || typeof data.row !== 'object') throw new AdminApiError('The server sent an unexpected response.', 500);
  return data.row as T;
}

export async function deleteAdminRow(table: AdminTable, id: string): Promise<void> {
  await callAdmin({ action: 'delete', table, id });
}

export async function setAdminPublished(table: AdminTable, id: string, published: boolean): Promise<void> {
  await callAdmin({ action: 'set-published', table, id, published });
}

export function uploadAdminMedia(kind: UploadKind, file: File, onProgress: (percent: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    let token: string;
    try {
      token = requireToken();
    } catch (err) {
      reject(err);
      return;
    }
    const form = new FormData();
    form.append('token', token);
    form.append('kind', kind);
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', ENDPOINT);
    xhr.setRequestHeader('Authorization', `Bearer ${supabaseAnonKey}`);
    xhr.setRequestHeader('apikey', supabaseAnonKey);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let payload: { url?: unknown; error?: unknown } = {};
      try {
        payload = JSON.parse(xhr.responseText) as typeof payload;
      } catch {
        payload = {};
      }
      if (xhr.status >= 200 && xhr.status < 300 && typeof payload.url === 'string') {
        resolve(payload.url);
      } else {
        reject(new AdminApiError(readErrorMessage(payload), xhr.status));
      }
    };
    xhr.onerror = () => reject(new AdminApiError('The upload was interrupted. Check your connection and try again.', 0));
    xhr.send(form);
  });
}
