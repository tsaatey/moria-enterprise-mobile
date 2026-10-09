import QuickCrypto, { argon2, Buffer } from 'react-native-quick-crypto';

/**
 * The PIN is a device-local convenience (§ PIN Unlock): its argon2id hash
 * lives in secure storage and unlocking never touches the network.
 *
 * Native argon2id via react-native-quick-crypto (C++, off the JS thread).
 * Parameters are OWASP's minimum argon2id profile: 19 MiB, 2 passes, 1 lane.
 * Stored as `argon2id$t=…,m=…,p=…$<salt hex>$<hash hex>` so the parameters
 * can be raised later without breaking PINs already set.
 */
const PARAMS = { passes: 2, memory: 19 * 1024, parallelism: 1, tagLength: 32 } as const;

export const PIN_PATTERN = /^\d{4,6}$/;
export const MAX_PIN_FAILURES = 5;

function derive(pin: string, salt: Buffer, opts: { passes: number; memory: number; parallelism: number; tagLength: number }) {
  return new Promise<Buffer>((resolve, reject) =>
    argon2('argon2id', { message: Buffer.from(pin, 'utf8'), nonce: salt, ...opts }, (err, result) =>
      err ? reject(err) : resolve(result),
    ),
  );
}

export async function hashPin(pin: string): Promise<string> {
  const salt = QuickCrypto.randomBytes(16);
  const hash = await derive(pin, salt, PARAMS);
  const { passes: t, memory: m, parallelism: p } = PARAMS;
  return `argon2id$t=${t},m=${m},p=${p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

/** Split a stored hash into its parameters, salt and digest; null when it isn't one of ours. */
export function parsePinHash(stored: string) {
  const [alg, params, saltHex, hashHex] = stored.split('$');
  if (alg !== 'argon2id' || !params || !saltHex || !hashHex) return null;
  const opts = Object.fromEntries(
    params.split(',').map((kv) => {
      const [key, value] = kv.split('=');
      return [key, Number(value)];
    }),
  );
  const { t, m, p } = opts;
  if (![t, m, p].every((n) => Number.isInteger(n) && n > 0)) return null;
  return { passes: t, memory: m, parallelism: p, saltHex, hashHex };
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parsed = parsePinHash(stored);
  if (!parsed) return false;
  const expected = Buffer.from(parsed.hashHex, 'hex');
  const actual = await derive(pin, Buffer.from(parsed.saltHex, 'hex'), {
    passes: parsed.passes,
    memory: parsed.memory,
    parallelism: parsed.parallelism,
    tagLength: expected.length,
  });
  return actual.length === expected.length && QuickCrypto.timingSafeEqual(actual, expected);
}
