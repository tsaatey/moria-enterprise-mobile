import { api } from './client';
import type { TokenPair, User } from './types';

export function login(input: { phone: string; password: string; deviceId: string; deviceName?: string | null }) {
  return api<TokenPair>('/auth/login', { method: 'POST', body: input, auth: false });
}

export function refresh(refreshToken: string) {
  return api<TokenPair>('/auth/refresh', { method: 'POST', body: { refreshToken }, auth: false });
}

export function logout(deviceId: string) {
  return api<{ revokedTokens: number }>('/auth/logout', { method: 'POST', body: { deviceId } });
}

export function me() {
  return api<User>('/auth/me');
}

/** Server-side copy of the PIN so it survives a reinstall. 4–6 digits. */
export function setServerPin(pin: string) {
  return api<{ id: string; hasPin: boolean }>('/auth/pin', { method: 'POST', body: { pin } });
}

export function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  deviceId: string;
  deviceName?: string | null;
}) {
  return api<TokenPair>('/auth/password', { method: 'POST', body: input });
}
