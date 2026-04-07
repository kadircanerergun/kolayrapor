const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 128; // bits for WebCrypto

let cachedKey: CryptoKey | null = null;

function getKeyHex(): string {
  const key = import.meta.env.VITE_ENCRYPTION_KEY;
  if (!key || typeof key !== "string" || key.length !== 64) {
    throw new Error(
      "VITE_ENCRYPTION_KEY must be set (64-char hex = 32 bytes)",
    );
  }
  return key;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey;
  const raw = hexToBytes(getKeyHex());
  cachedKey = await crypto.subtle.importKey("raw", raw, ALGORITHM, false, [
    "encrypt",
    "decrypt",
  ]);
  return cachedKey;
}

export async function encryptJson(data: unknown): Promise<string> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const plaintext = new TextEncoder().encode(JSON.stringify(data));

  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv, tagLength: AUTH_TAG_LENGTH },
    key,
    plaintext,
  );

  // WebCrypto appends the auth tag to the ciphertext
  // We rearrange to: iv (12) + authTag (16) + ciphertext (to match API format)
  const encrypted = new Uint8Array(ciphertext);
  const rawCiphertext = encrypted.slice(0, encrypted.length - 16);
  const authTag = encrypted.slice(encrypted.length - 16);

  const payload = new Uint8Array(iv.length + authTag.length + rawCiphertext.length);
  payload.set(iv, 0);
  payload.set(authTag, iv.length);
  payload.set(rawCiphertext, iv.length + authTag.length);

  return btoa(String.fromCharCode(...payload));
}

export async function decryptJson<T = unknown>(encoded: string): Promise<T> {
  const key = await getKey();
  const payload = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));

  const iv = payload.slice(0, IV_LENGTH);
  const authTag = payload.slice(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = payload.slice(IV_LENGTH + 16);

  // WebCrypto expects authTag appended to ciphertext
  const combined = new Uint8Array(ciphertext.length + authTag.length);
  combined.set(ciphertext, 0);
  combined.set(authTag, ciphertext.length);

  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv, tagLength: AUTH_TAG_LENGTH },
    key,
    combined,
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}
