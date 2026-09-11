/**
 * Password hashing with scrypt from the Node standard library — no native build
 * step, and memory-hard enough to make offline cracking expensive.
 *
 * The stored format keeps its own parameters so they can be raised later without
 * invalidating existing hashes:
 *
 *   scrypt$<N>$<r>$<p>$<base64 salt>$<base64 key>
 *
 * Comparison is constant time to avoid leaking the hash through response timing.
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const KEY_LENGTH = 64;
const PARAMS: Required<Pick<ScryptOptions, 'N' | 'r' | 'p'>> = { N: 16384, r: 8, p: 1 };

function derive(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, options, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, KEY_LENGTH, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64');
  const key = await derive(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p)
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}
