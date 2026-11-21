/**
 * Password hashing using Argon2id — the current recommended algorithm for
 * password storage (winner of the Password Hashing Competition).
 *
 * We NEVER store plaintext passwords. We store only the Argon2 hash, which
 * already contains the salt and parameters, so verification needs just the
 * hash and the candidate password.
 */
import argon2 from 'argon2';

// argon2id balances resistance to GPU and side-channel attacks.
const HASH_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 19456, // ~19 MB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plainPassword: string): Promise<string> {
  return argon2.hash(plainPassword, HASH_OPTIONS);
}

export async function verifyPassword(hash: string, plainPassword: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plainPassword);
  } catch {
    // A malformed hash should never crash login — treat it as "no match".
    return false;
  }
}
