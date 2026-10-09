/**
 * Runtime configuration. `EXPO_PUBLIC_*` variables are inlined at build time,
 * so nothing secret belongs here.
 */
export const env = {
  /** Origin of moria-enterprise-backend, without `/api/v1`. Dev server boots on :4800 (its .env.example PORT). */
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4800 (its .env.example PORT)').replace(/\/$/, ''),
} as const;

export const API_BASE = `${env.apiUrl}/api/v1`;
