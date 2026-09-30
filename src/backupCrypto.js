// Password-protected backups: AES-256-GCM, with the key derived from the
// person's password via PBKDF2 (SHA-256, 250k iterations) and a fresh random
// salt + IV per file, all through the browser's built-in Web Crypto API — no
// third-party crypto library involved.
//
// What this does and doesn't protect against, plainly:
//  - Anyone who gets hold of the backup FILE (a lost phone, a shared
//    Downloads folder, an email attachment) sees only ciphertext. Without the
//    password it's unreadable, and GCM's authentication tag means a wrong
//    password or any tampering with the file fails loudly instead of
//    producing garbage.
//  - There is NO recovery. Kwenta never sees or stores the password, so a
//    forgotten password means that specific backup file can't be opened by
//    anyone, including us. The UI says this before encrypting.
//  - It's only as strong as the password chosen — PBKDF2's iteration count
//    slows guessing down, it doesn't make "1234" safe.

const VERSION = 1;
const ITERATIONS = 250000;
const SALT_BYTES = 16;
const IV_BYTES = 12; // the standard/recommended size for GCM

const enc = new TextEncoder();
const dec = new TextDecoder();

function toB64(bytes) {
  let bin = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

function fromB64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveKey(password, salt, iterations) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// Anything JSON-serializable in, an envelope object out — the envelope is
// itself plain JSON (base64 strings), so it saves and re-reads as an
// ordinary .json file.
export async function encryptJSON(payload, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt, ITERATIONS);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(payload)),
  );
  return {
    kwentaEncryptedBackup: VERSION,
    kdf: "PBKDF2-SHA256",
    iterations: ITERATIONS,
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(ciphertext),
  };
}

export function isEncryptedEnvelope(obj) {
  return !!(
    obj &&
    typeof obj === "object" &&
    typeof obj.kwentaEncryptedBackup === "number" &&
    obj.salt &&
    obj.iv &&
    obj.ciphertext
  );
}

// Throws a friendly Error on a wrong password OR a damaged/tampered file —
// AES-GCM can't tell those two apart (both just fail authentication), so the
// message covers both honestly instead of claiming to know which.
export async function decryptEnvelope(envelope, password) {
  try {
    const salt = fromB64(envelope.salt);
    const iv = fromB64(envelope.iv);
    const key = await deriveKey(
      password,
      salt,
      envelope.iterations || ITERATIONS,
    );
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      fromB64(envelope.ciphertext),
    );
    return JSON.parse(dec.decode(plain));
  } catch (e) {
    throw new Error(
      "Couldn't unlock this backup — the password is wrong, or the file was changed or damaged.",
    );
  }
}
