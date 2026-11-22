import { useState } from "react";
import { hashContent } from "./utils/crypto.ts";
import { downloadBlob, downloadText } from "./utils/download.ts";
import {
  createFilePackage,
  createMessagePackage,
  openUploadedPackage,
} from "./utils/package.ts";
import type { EncryptedPackage } from "./utils/package.ts";

function App() {
  // Message and file encryption share the same output area.
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isHashing, setIsHashing] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [error, setError] = useState("");
  const [hash, setHash] = useState("");
  const [recoveredMessage, setRecoveredMessage] = useState("");
  const [integrityVerified, setIntegrityVerified] = useState(false);
  const [encryptedPackage, setEncryptedPackage] =
    useState<EncryptedPackage | null>(null);
  const [exportedKey, setExportedKey] = useState("");

  // Uploaded packages have separate inputs, progress, and verified results.
  const [packageFile, setPackageFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState("");
  const [importedMessage, setImportedMessage] = useState("");
  const [importedHash, setImportedHash] = useState("");
  const [importVerified, setImportVerified] = useState(false);
  const [recoveredFile, setRecoveredFile] = useState<Blob | null>(null);
  const [recoveredFilename, setRecoveredFilename] = useState("");

  const isProcessing = isHashing || isEncrypting;

  function resetEncryptionResults() {
    setEncryptedPackage(null);
    setExportedKey("");
    setError("");
    setHash("");
    setRecoveredMessage("");
    setIntegrityVerified(false);
  }

  function resetImportResults() {
    setDecryptError("");
    setImportedMessage("");
    setImportedHash("");
    setImportVerified(false);
    setRecoveredFile(null);
    setRecoveredFilename("");
  }

  async function handleHash() {
    resetEncryptionResults();
    setIsHashing(true);

    try {
      const bytes = new TextEncoder().encode(message);
      setHash(await hashContent(bytes));
    } catch {
      setError("Could not calculate the hash. Please try again.");
    } finally {
      setIsHashing(false);
    }
  }

  async function handleEncrypt() {
    resetEncryptionResults();
    setIsEncrypting(true);

    try {
      const result = await createMessagePackage(message);
      setEncryptedPackage(result.encryptedPackage);
      setExportedKey(result.exportedKey);
      setHash(result.hash);
      setRecoveredMessage(result.message);
      setIntegrityVerified(true);
    } catch {
      setError("Could not encrypt, decrypt, or verify the message.");
    } finally {
      setIsEncrypting(false);
    }
  }

  async function handleEncryptFile() {
    if (!selectedFile) return;

    resetEncryptionResults();
    setIsEncrypting(true);

    try {
      const result = await createFilePackage(selectedFile);
      setEncryptedPackage(result.encryptedPackage);
      setExportedKey(result.exportedKey);
      setHash(result.hash);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not encrypt the file.",
      );
    } finally {
      setIsEncrypting(false);
    }
  }

  async function handleDecryptPackage() {
    resetImportResults();

    if (!packageFile || !keyFile) {
      setDecryptError("Select both an encrypted package and a key file.");
      return;
    }

    setIsDecrypting(true);

    try {
      const result = await openUploadedPackage(packageFile, keyFile);

      if (result.kind === "file") {
        setRecoveredFile(result.file);
        setRecoveredFilename(result.filename);
      } else {
        setImportedMessage(result.message);
      }

      setImportedHash(result.hash);
      setImportVerified(true);
    } catch {
      setDecryptError(
        "Could not decrypt and verify this package. The key may be incorrect, " +
        "or the files may be damaged or unsupported. Packages must be 8 MiB " +
        "or smaller, keys 1 KiB or smaller, and recovered files 5 MiB or smaller.",
      );
    } finally {
      setIsDecrypting(false);
    }
  }

  return (
    <main>
      <h1>Secure Packager</h1>
      <p>Encrypt a message, then recover and verify it in this browser.</p>

      <label htmlFor="message">Your Message</label>

      <textarea
        id="message"
        value={message}
        onChange={(event) => {
          setMessage(event.target.value);
          resetEncryptionResults();
        }}
        placeholder="Enter a message you wish to encrypt"
        rows={6}
        disabled={isProcessing}
      />

      <p>Characters: {message.length}</p>

      <button
        type="button"
        onClick={handleHash}
        disabled={isProcessing || message.length === 0}
      >
        {isHashing ? "Calculating..." : "Calculate SHA-256"}
      </button>

      <button
        type="button"
        onClick={handleEncrypt}
        disabled={isProcessing || message.length === 0}
      >
        {isEncrypting ? "Verifying..." : "Encrypt, decrypt, and verify"}
      </button>

      {error && <p role="alert">{error}</p>}

      {integrityVerified && (
        <section aria-live="polite">
          <h2>Integrity Verified</h2>
          <p>The decrypted message matches the original.</p>

          <h3>Recovered Message</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{recoveredMessage}</p>
        </section>
      )}

      {hash && (
        <section aria-live="polite">
          <h2>SHA-256 Hash</h2>
          <code style={{ overflowWrap: "anywhere" }}>{hash}</code>
        </section>
      )}

      {encryptedPackage && exportedKey && (
        <section>
          <h2>Download your encrypted message</h2>

          <button
            type="button"
            onClick={() =>
              downloadText(
                JSON.stringify(encryptedPackage, null, 2),
                "content.secure.json",
                "application/json"
              )
            }
          >
            Download encrypted package
          </button>

          <button
            type="button"
            onClick={() => downloadText(exportedKey, "content.key.txt")}
          >
            Download key
          </button>

          <p>
            Keep your key private. Anyone with both files can decrypt
            the message.
          </p>
        </section>
      )}

      <section>
        <h2>Open an encrypted package</h2>
        <p>Select an encrypted package and its matching key file.</p>

        <div>
          <label htmlFor="package-file">Encrypted package</label>
          <input
            id="package-file"
            type="file"
            accept=".json"
            disabled={isDecrypting}
            onChange={(event) => {
              setPackageFile(event.target.files?.[0] ?? null);
              resetImportResults();
            }}
          />
        </div>

        <div>
          <label htmlFor="key-file">Key file</label>
          <input
            id="key-file"
            type="file"
            accept=".txt"
            disabled={isDecrypting}
            onChange={(event) => {
              setKeyFile(event.target.files?.[0] ?? null);
              resetImportResults();
            }}
          />
        </div>

        <button
          type="button"
          onClick={handleDecryptPackage}
          disabled={isDecrypting || !packageFile || !keyFile}
        >
          {isDecrypting ? "Decrypting..." : "Decrypt and verify package"}
        </button>

        {decryptError && <p role="alert">{decryptError}</p>}

        {importVerified && (
          <section aria-live="polite">
            <h3>Integrity verified</h3>
            <p>The recovered content matches the hash inside the package.</p>

            {recoveredFile ? (
              <>
                <h4>Recovered file</h4>
                <p>{recoveredFilename}</p>

                <button
                  type="button"
                  onClick={() =>
                    downloadBlob(recoveredFile, recoveredFilename)
                  }
                >
                  Download recovered file
                </button>
              </>
            ) : (
              <>
                <h4>Recovered message</h4>
                <p style={{ whiteSpace: "pre-wrap" }}>{importedMessage}</p>
              </>
            )}

            <h4>Verified SHA-256 hash</h4>
            <code style={{ overflowWrap: "anywhere" }}>{importedHash}</code>
          </section>
        )}
      </section>

      <section>
        <h2>Encrypt a file</h2>
        <p>Select a file of up to 5 MiB.</p>

        <label htmlFor="source-file">File to encrypt</label>
        <input
          id="source-file"
          type="file"
          disabled={isProcessing}
          onChange={(event) => {
            setSelectedFile(event.target.files?.[0] ?? null);
            resetEncryptionResults();
          }}
        />

        {selectedFile && (
          <p>
            Selected: {selectedFile.name}
            {" — "}
            {selectedFile.size.toLocaleString()} bytes
          </p>
        )}

        <button
          type="button"
          onClick={handleEncryptFile}
          disabled={isProcessing || !selectedFile}
        >
          {isEncrypting ? "Processing..." : "Encrypt file"}
        </button>
      </section>
    </main>
  );
}

export default App;
