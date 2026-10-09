// expo-crypto's native module is absent under Jest; Node's crypto gives real v4 UUIDs.
jest.mock('expo-crypto', () => ({ randomUUID: () => require('crypto').randomUUID() }));
