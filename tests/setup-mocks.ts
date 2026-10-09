// expo-crypto's native module is absent under Jest; Node's crypto gives real v4 UUIDs.
jest.mock('expo-crypto', () => ({ randomUUID: () => jest.requireActual<typeof import('crypto')>('crypto').randomUUID() }));
