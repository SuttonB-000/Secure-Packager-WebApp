export async function hashContent(
  content: Uint8Array<ArrayBuffer>
): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", content);

  const hashBytes = new Uint8Array(hashBuffer);

  return Array.from(hashBytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
