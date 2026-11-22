export async function hashContent(
  content: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", content);

  const hashBytes = new Uint8Array(hashBuffer);

  return Array.from(hashBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function encryptContent(
  content: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    content,
  );

  return { iv, ciphertext };
}

export async function decryptContent(
  ciphertext: ArrayBuffer,
  iv: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    ciphertext,
  );
}

// Encode binary data so it can be stored in JSON or a text file.
export function bytesToBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

// Export the raw AES key as Base64 for a separate key download.
export async function exportKey(key: CryptoKey): Promise<string> {
  const rawKey = await crypto.subtle.exportKey("raw", key);

  return bytesToBase64(new Uint8Array(rawKey));
}

export function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

export async function importKey(keyText: string): Promise<CryptoKey> {
  const keyBytes = base64ToBytes(keyText.trim());

  if (keyBytes.length !== 32) {
    throw new Error("Expected a 256-bit AES key.");
  }

  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
}