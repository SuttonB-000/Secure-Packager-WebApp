// Both helpers download locally without sending content to a server.
export function downloadText(
  content: string,
  filename: string,
  type = "text/plain",
): void {
  downloadBlob(new Blob([content], { type }), filename);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  link.remove();

  // Allow the browser to start the download before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
