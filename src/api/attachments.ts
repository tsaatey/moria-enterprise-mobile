import { api } from './client';

export interface Attachment {
  id: string;
  directory: string;
  publicUrl: string | null;
  confirmed?: boolean;
}

export interface Reservation extends Attachment {
  uploadUrl: string;
  expiresAt: string;
  /** Send on the PUT exactly as given: content-type and content-length are signed. */
  requiredHeaders: Record<string, string>;
}

/** Step 1 of § Media Storage's upload flow: reserve a row and a presigned PUT. */
export const reserve = (body: { directory: 'productCovers'; name: string; extension: string; contentType: string; sizeBytes: number }) =>
  api<Reservation>('/attachments', { method: 'POST', body });

/** Step 3: the server checks the object against the bucket. Idempotent. */
export const confirm = (id: string) => api<Attachment>(`/attachments/${id}/confirm`, { method: 'POST' });
