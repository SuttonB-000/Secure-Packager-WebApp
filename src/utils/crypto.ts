export async function hashContent(
  content: Uint8Array<ArrayBuffer>
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
    ["encrypt", "decrypt"]
  );
}

export async function encryptContent(
  content: Uint8Array<ArrayBuffer>,
  key: CryptoKey
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
  key: CryptoKey
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    ciphertext
  );
}
