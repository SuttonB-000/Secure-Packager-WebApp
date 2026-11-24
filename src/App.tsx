import { useState } from "react";
import "./App.css";
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
    } catch (error) {
      setError(
        error instanceof Error && error.message.includes("8 MiB import limit")
          ? "This message would create a package larger than 8 MiB. Use a shorter message."
          : "Could not encrypt, decrypt, or verify the message.",
      );
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
        "or smaller, keys 1 KiB or smaller, and recovered files 4 MiB or smaller.",
      );
    } finally {
      setIsDecrypting(false);
    }
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Secure Packager</h1>
        <p>Encrypt a message or file, then recover and verify it in this browser.</p>
      </header>

      <section className="panel" aria-labelledby="create-heading">
        <div className="section-heading">
          <h2 id="create-heading">Create an encrypted package</h2>
          <p>Start with a message or choose a file.</p>
        </div>

        <div className="encrypt-options">
          <section className="input-section" aria-labelledby="message-heading">
            <h3 id="message-heading">Encrypt a message</h3>
            <div className="field">
              <label htmlFor="message">Your message</label>
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
                aria-describedby="character-count"
              />
              <p id="character-count" className="field-hint">Characters: {message.length}</p>
            </div>

            <div className="actions">
              <button
                className="primary-button"
                type="button"
                onClick={handleEncrypt}
                disabled={isProcessing || message.length === 0}
              >
                {isEncrypting ? "Verifying..." : "Encrypt and verify"}
              </button>
              <button
                type="button"
                onClick={handleHash}
                disabled={isProcessing || message.length === 0}
              >
                {isHashing ? "Calculating..." : "Calculate SHA-256"}
              </button>
            </div>
          </section>

          <section className="input-section" aria-labelledby="file-heading">
            <h3 id="file-heading">Encrypt a file</h3>
            <div className="field">
              <label htmlFor="source-file">File to encrypt</label>
              <input
                id="source-file"
                type="file"
                disabled={isProcessing}
                aria-describedby="file-limit"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                  resetEncryptionResults();
                }}
              />
              <p id="file-limit" className="field-hint">Choose a file up to 4 MiB.</p>
            </div>

            {selectedFile && (
              <p className="file-details">
                {selectedFile.name} · {selectedFile.size.toLocaleString()} bytes
              </p>
            )}

            <div className="actions">
              <button
                className="primary-button"
                type="button"
                onClick={handleEncryptFile}
                disabled={isProcessing || !selectedFile}
              >
                {isEncrypting ? "Processing..." : "Encrypt file"}
              </button>
            </div>
          </section>
        </div>

        {error && <p className="feedback" role="alert">{error}</p>}

        {(hash || (encryptedPackage && exportedKey)) && (
          <section className="results" aria-label="Encryption results" aria-live="polite">
            {integrityVerified && (
              <div className="result-block">
                <h3>Integrity verified</h3>
                <p>The decrypted message matches the original.</p>
                <h4>Recovered message</h4>
                <p className="message-content">{recoveredMessage}</p>
              </div>
            )}

            {hash && (
              <div className="result-block">
                <h3>SHA-256 hash</h3>
                <code className="hash-value">{hash}</code>
              </div>
            )}

            {encryptedPackage && exportedKey && (
              <div className="result-block">
                <h3>Download your package and key</h3>
                <div className="actions">
                  <button
                    type="button"
                    onClick={() => downloadText(
                      JSON.stringify(encryptedPackage, null, 2),
                      "content.secure.json",
                      "application/json",
                    )}
                  >
                    Download encrypted package
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadText(exportedKey, "content.key.txt")}
                  >
                    Download key
                  </button>
                </div>
                <p className="field-hint">
                  Keep your key private. Anyone with both files can decrypt the content.
                </p>
              </div>
            )}
          </section>
        )}
      </section>

      <section className="panel" aria-labelledby="open-heading">
        <div className="section-heading">
          <h2 id="open-heading">Open an encrypted package</h2>
          <p>Select a package and its matching key to recover your content.</p>
        </div>

        <div className="upload-fields">
          <div className="field">
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

          <div className="field">
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
        </div>

        <div className="actions">
          <button
            className="primary-button"
            type="button"
            onClick={handleDecryptPackage}
            disabled={isDecrypting || !packageFile || !keyFile}
          >
            {isDecrypting ? "Decrypting..." : "Decrypt and verify package"}
          </button>
        </div>

        {decryptError && <p className="feedback" role="alert">{decryptError}</p>}

        {importVerified && (
          <section className="results" aria-live="polite">
            <div className="result-block">
              <h3>Integrity verified</h3>
              <p>The recovered content matches the hash inside the package.</p>

              {recoveredFile ? (
                <>
                  <h4>Recovered file</h4>
                  <p className="file-details">{recoveredFilename}</p>
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() => downloadBlob(recoveredFile, recoveredFilename)}
                    >
                      Download recovered file
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h4>Recovered message</h4>
                  <p className="message-content">{importedMessage}</p>
                </>
              )}
            </div>

            <div className="result-block">
              <h3>Verified SHA-256 hash</h3>
              <code className="hash-value">{importedHash}</code>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

export default App;
