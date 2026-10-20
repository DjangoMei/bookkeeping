/**
 * @param {unknown} candidate
 * @param {{algorithm: string, iterations: number, salt: string, hash: string}} verifier
 */
export async function verifyPassphrase(candidate, verifier) {
  if (typeof candidate !== "string" || candidate.length === 0 || candidate.length > 512) return false;
  if (!verifier || verifier.algorithm !== "PBKDF2-SHA256" || verifier.iterations !== 100000
    || !/^[a-f0-9]{32}$/.test(verifier.salt) || !/^[a-f0-9]{64}$/.test(verifier.hash)) return false;

  const salt = Uint8Array.from(verifier.salt.match(/../g), (byte) => Number.parseInt(byte, 16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(candidate), "PBKDF2", false, ["deriveBits"]);
  const derived = new Uint8Array(await crypto.subtle.deriveBits({
    name: "PBKDF2", hash: "SHA-256", salt, iterations: verifier.iterations,
  }, key, 256));
  const expected = Uint8Array.from(verifier.hash.match(/../g), (byte) => Number.parseInt(byte, 16));
  let mismatch = 0;
  for (let index = 0; index < expected.length; index += 1) mismatch |= expected[index] ^ derived[index];
  return mismatch === 0;
}
