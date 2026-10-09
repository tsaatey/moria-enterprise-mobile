/**
 * Runtime configuration. `EXPO_PUBLIC_*` variables are inlined at build time,
 * so nothing secret belongs here.
 */
export const env = {
  /**
   * Origin of moria-enterprise-backend, without `/api/v1`. The dev server
   * boots on :4800 (its .env.example PORT); the Android emulator reaches it
   * as http://10.0.2.2:4800, set in .env.
   */
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4800').replace(/\/$/, ''),
} as const;

export const API_BASE = `${env.apiUrl}/api/v1`;
