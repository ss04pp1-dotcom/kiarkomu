import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_ENV = process.env["CONFIG_ENCRYPTION_KEY"] ?? "";

// ── FIX 6: Fail fast on startup if encryption key is invalid ──
// This check runs when the module is first imported, preventing the server
// from starting with a misconfigured or missing encryption key.
(function validateEncryptionKeyOnStartup() {
  if (!KEY_ENV) {
    throw new Error(
      "[FATAL] CONFIG_ENCRYPTION_KEY environment variable is not set. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  const buf = Buffer.from(KEY_ENV, "hex");
  if (buf.length !== 32) {
    throw new Error(
      `[FATAL] CONFIG_ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters). ` +
      `Current key decodes to ${buf.length} bytes. ` +
      "Generate a valid key with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
})();

function getKey(): Buffer {
  if (!KEY_ENV) throw new Error("CONFIG_ENCRYPTION_KEY is not set");
  const buf = Buffer.from(KEY_ENV, "hex");
  if (buf.length !== 32) throw new Error("CONFIG_ENCRYPTION_KEY must be 32 bytes (64 hex chars)");
  return buf;
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("Invalid ciphertext format");
  const [ivHex, tagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex!, "hex");
  const tag = Buffer.from(tagHex!, "hex");
  const data = Buffer.from(dataHex!, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final("utf8");
}

export function safeDecrypt(ciphertext: string): string | null {
  try {
    return decrypt(ciphertext);
  } catch {
    return null;
  }
}

export function isEncrypted(value: string): boolean {
  // AES-256-GCM produces: iv (12 bytes = 24 hex chars) : tag (16 bytes = 32 hex chars) : ciphertext (≥1 byte = ≥2 hex chars)
  // Minimum total length: 24 + 1 + 32 + 1 + 2 = 60 characters (plus two colons).
  // The minimum length check prevents false positives from short hex-like strings.
  const parts = value.split(":");
  if (parts.length !== 3) return false;
  const [iv, tag, data] = parts;
  return (
    /^[0-9a-f]+$/.test(iv!) &&
    /^[0-9a-f]+$/.test(tag!) &&
    /^[0-9a-f]+$/.test(data!) &&
    iv!.length >= 24 &&
    tag!.length >= 32 &&
    data!.length >= 2
  );
}
