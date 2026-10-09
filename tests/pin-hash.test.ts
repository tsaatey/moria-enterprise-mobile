import { parsePinHash } from '@/auth/pin';

jest.mock('react-native-quick-crypto', () => ({ __esModule: true, default: {}, argon2: jest.fn(), Buffer }));

it('reads the parameters back out of a stored hash', () => {
  expect(parsePinHash('argon2id$t=2,m=19456,p=1$00ff$abcd')).toEqual({
    passes: 2,
    memory: 19456,
    parallelism: 1,
    saltHex: '00ff',
    hashHex: 'abcd',
  });
});

it('rejects anything that is not a complete argon2id record', () => {
  expect(parsePinHash('bcrypt$x$y$z')).toBeNull();
  expect(parsePinHash('argon2id$t=2,m=19456$00ff$abcd')).toBeNull();
  expect(parsePinHash('argon2id$t=2,m=19456,p=1$00ff')).toBeNull();
});
