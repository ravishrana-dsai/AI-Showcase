/**
 * AES-256-GCM encryption/decryption for storing OAuth tokens at rest.
 * Requires ENCRYPTION_KEY env var: a 64-character hex string (32 bytes).
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // bytes
const IV_LENGTH = 12; // bytes (96-bit IV for GCM)
const TAG_LENGTH = 16; // bytes

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes)."
    );
  }
  return Buffer.from(hex, "hex");
}

/**
 * Encrypts plaintext and returns a base64 string in the format:
 * iv:authTag:ciphertext (all base64-encoded, colon-delimited)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

/**
 * Decrypts a value produced by encrypt().
 */
export function decrypt(encoded: string): string {
  const key = getKey();
  const [ivB64, tagB64, ciphertextB64] = encoded.split(":");

  if (!ivB64 || !tagB64 || !ciphertextB64) {
    throw new Error("Invalid encrypted value format.");
  }

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  if (iv.length !== IV_LENGTH || authTag.length !== TAG_LENGTH) {
    throw new Error("Corrupted encrypted value.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
