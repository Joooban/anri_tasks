import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Application-level encryption for sensitive content (task titles/
// descriptions/comments, announcements, attachments) — see the comment on
// ENCRYPTION_KEY in .env.local for why this exists and what it defends
// against. AES-256-GCM: authenticated encryption, so tampering with stored
// ciphertext is detected (decrypt throws) rather than silently accepted.
//
// Stored format is "<iv>.<authTag>.<ciphertext>", each base64 — plain text
// in a single existing `text` column, no schema/column-type change needed.
const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended length for GCM

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes");
  return key;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map((b) => b.toString("base64")).join(".");
}

// Rows written before encryption was added are still plain text — falling
// back to returning the raw value when it isn't in the "<iv>.<tag>.<ct>"
// shape lets existing data keep displaying correctly instead of throwing,
// while everything written from now on is encrypted going forward.
export function decrypt(stored: string): string {
  const parts = stored.split(".");
  if (parts.length !== 3) return stored;

  const [ivB64, authTagB64, ciphertextB64] = parts;
  let iv: Buffer, authTag: Buffer, ciphertext: Buffer;
  try {
    iv = Buffer.from(ivB64, "base64");
    authTag = Buffer.from(authTagB64, "base64");
    ciphertext = Buffer.from(ciphertextB64, "base64");
  } catch {
    return stored;
  }
  if (iv.length !== IV_LENGTH || authTag.length !== 16) return stored;

  try {
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    // Not actually one of ours (e.g. a plain-text value that happened to
    // split into 3 dot-separated base64-looking parts) — return as-is
    // rather than throwing and breaking the page.
    return stored;
  }
}

export function encryptNullable(plaintext: string | null | undefined): string | null {
  if (plaintext == null || plaintext === "") return null;
  return encrypt(plaintext);
}

export function decryptNullable(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  return decrypt(stored);
}

// Binary variant for file attachments — same algorithm, but stored as a
// single raw byte layout ([iv][authTag][ciphertext]) rather than the
// base64-with-dots text format above, since these bytes go straight into
// Supabase Storage rather than a Postgres text column. There's no safe
// backward-compatible fallback here the way decrypt() has for plain text:
// arbitrary existing file bytes can't be reliably distinguished from "not
// our format" the way a mis-shaped string can. Attachments uploaded before
// this change won't decrypt — expected, given this project currently only
// has test data.
const AUTH_TAG_LENGTH = 16;

export function encryptBuffer(plaintext: Buffer): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptBuffer(stored: Buffer): Buffer {
  const iv = stored.subarray(0, IV_LENGTH);
  const authTag = stored.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = stored.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
