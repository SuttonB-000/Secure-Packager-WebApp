import {
  base64ToBytes,
  bytesToBase64,
  decryptContent,
  encryptContent,
  exportKey,
  generateKey,
  hashContent,
  importKey,
} from "./crypto.ts";

const MIB = 1024 * 1024;
const MAX_FILE_SIZE = 4 * MIB;
const MAX_PACKAGE_SIZE = 8 * MIB;
const MAX_KEY_SIZE = 1024;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

export interface EncryptedPackage {
  version: 1;
  algorithm: "AES-GCM";
  iv: string;
  ciphertext: string;
}

export type VerifiedContent =
  | { kind: "message"; message: string; hash: string }
  | { kind: "file"; file: Blob; filename: string; hash: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePackage(text: string): EncryptedPackage {
  const parsed: unknown = JSON.parse(text);

  if (
    !isRecord(parsed) ||
    parsed.version !== 1 ||
    parsed.algorithm !== "AES-GCM" ||
    typeof parsed.iv !== "string" ||
    typeof parsed.ciphertext !== "string"
  ) {
    throw new Error("Invalid or unsupported package.");
  }

  return {
    version: parsed.version,
    algorithm: parsed.algorithm,
    iv: parsed.iv,
    ciphertext: parsed.ciphertext,
  };
}

// Downloads use pretty-printed JSON, so measure that exact representation.
function ensureImportableSize(encryptedPackage: EncryptedPackage): void {
  const packageBytes = new TextEncoder().encode(
    JSON.stringify(encryptedPackage, null, 2),
  ).byteLength;
  if (packageBytes > MAX_PACKAGE_SIZE) {
    throw new Error("Encrypted package exceeds the 8 MiB import limit.");
  }
}

async function encryptPayload(payload: object) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const key = await generateKey();
  const { iv, ciphertext } = await encryptContent(bytes, key);

  const encryptedPackage: EncryptedPackage = {
    version: 1,
    algorithm: "AES-GCM",
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };

  ensureImportableSize(encryptedPackage);

  return { encryptedPackage, key, iv, ciphertext };
}

// Validate the payload and verify its hash before returning any recovered content.
async function verifyPayload(payload: unknown): Promise<VerifiedContent> {
  if (
    !isRecord(payload) ||
    typeof payload.hash !== "string" ||
    !SHA256_PATTERN.test(payload.hash)
  ) {
    throw new Error("Invalid decrypted payload.");
  }

  let bytes: Uint8Array<ArrayBuffer>;
  let filename = "";

  if ("kind" in payload) {
    if (
      payload.kind !== "file" ||
      typeof payload.name !== "string" ||
      typeof payload.content !== "string"
    ) {
      throw new Error("Invalid file payload.");
    }

    bytes = base64ToBytes(payload.content);
    if (bytes.length > MAX_FILE_SIZE) {
      throw new Error("Recovered file is too large.");
    }

    filename = payload.name.split(/[\\/]/).pop() || "recovered-file";
  } else {
    if (typeof payload.message !== "string") {
      throw new Error("Invalid message payload.");
    }

    bytes = new TextEncoder().encode(payload.message);
  }

  const hash = await hashContent(bytes);
  if (hash !== payload.hash) {
    throw new Error("Integrity verification failed.");
  }

  if (filename) {
    return {
      kind: "file",
      file: new Blob([bytes], { type: "application/octet-stream" }),
      filename,
      hash,
    };
  }

  return { kind: "message", message: new TextDecoder().decode(bytes), hash };
}

export async function createMessagePackage(message: string) {
  const hash = await hashContent(new TextEncoder().encode(message));
  const { encryptedPackage, key, iv, ciphertext } = await encryptPayload({
    message,
    hash,
  });

  // Check the message round trip before offering the package for download.
  const decrypted = await decryptContent(ciphertext, iv, key);
  const payload: unknown = JSON.parse(new TextDecoder().decode(decrypted));
  const recovered = await verifyPayload(payload);

  if (recovered.kind !== "message") {
    throw new Error("Invalid message payload.");
  }

  return {
    encryptedPackage,
    exportedKey: await exportKey(key),
    message,
    hash: recovered.hash,
  };
}

export async function createFilePackage(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Please select a file of 4 MiB or smaller.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const hash = await hashContent(bytes);
  const { encryptedPackage, key } = await encryptPayload({
    kind: "file",
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    content: bytesToBase64(bytes),
    hash,
  });

  return { encryptedPackage, exportedKey: await exportKey(key), hash };
}

export async function openUploadedPackage(
  packageFile: File,
  keyFile: File,
): Promise<VerifiedContent> {
  if (packageFile.size > MAX_PACKAGE_SIZE || keyFile.size > MAX_KEY_SIZE) {
    throw new Error("Package or key file is too large.");
  }

  const encryptedPackage = parsePackage(await packageFile.text());
  const iv = base64ToBytes(encryptedPackage.iv);
  const ciphertext = base64ToBytes(encryptedPackage.ciphertext);

  if (iv.length !== 12) {
    throw new Error("Invalid initialization vector.");
  }

  const key = await importKey(await keyFile.text());
  const decrypted = await decryptContent(ciphertext.buffer, iv, key);
  const payload: unknown = JSON.parse(new TextDecoder().decode(decrypted));

  return verifyPayload(payload);
}
