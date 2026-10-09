import { secureStorage } from '@/auth/secure-storage';
import { useSession } from '@/auth/session-store';

jest.mock('expo-device', () => ({ deviceName: 'Test', modelName: 'Test' }));
jest.mock('@/auth/pin', () => ({ hashPin: jest.fn(), verifyPin: jest.fn(), MAX_PIN_FAILURES: 5 }));
jest.mock('@/auth/secure-storage', () => {
  const store = new Map<string, string | null>();
  return {
    secureStorage: {
      getDeviceId: async () => store.get('deviceId') ?? null,
      setDeviceId: async (v: string) => void store.set('deviceId', v),
      getRefreshToken: async () => store.get('refresh') ?? null,
      setRefreshToken: async (v: string | null) => void store.set('refresh', v),
      getUser: async () => (store.get('user') ? JSON.parse(store.get('user')!) : null),
      setUser: async (u: unknown) => void store.set('user', u ? JSON.stringify(u) : null),
      getPinHash: async () => store.get('pin') ?? null,
      setPinHash: async (v: string | null) => void store.set('pin', v),
      getPinFailures: async () => 0,
      setPinFailures: async () => {},
      clearSession: jest.fn(async () => {
        store.delete('refresh');
        store.delete('user');
        store.delete('pin');
      }),
    },
  };
});

const user = { id: 'u1', name: 'Ama', phone: '0244000000', role: 'salesperson', shopId: 's1', isActive: true, mustChangePassword: false, hasPin: false };

it('re-running bootstrap mid-setup does not wipe the new session', async () => {
  await useSession.getState().bootstrap();
  expect(useSession.getState().status).toBe('signedOut');

  // What login() leaves behind: tokens stored, no PIN yet.
  await secureStorage.setRefreshToken('rt');
  await secureStorage.setUser(user as never);
  useSession.setState({ status: 'setPin', user: user as never });

  // RootLayout remounts (fast refresh, navigator change) and calls bootstrap again.
  await useSession.getState().bootstrap();

  expect(useSession.getState().status).toBe('setPin');
  expect(secureStorage.clearSession).not.toHaveBeenCalled();
  expect(await secureStorage.getRefreshToken()).toBe('rt');
});
