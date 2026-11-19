import { useState } from "react";
import { 
  hashContent,
  generateKey,
  encryptContent,
  decryptContent,
} from "./utils/crypto.ts";

function App() {
  const [ message, setMessage ] = useState("");
  const [ hash, setHash ] = useState("");
  const [ error, setError ] = useState("");
  const [ isHashing, setIsHashing ] = useState(false);
  const [ recoveredMessage, setRecoveredMessage ] = useState("");
  const [ integrityVerified, setIntegrityVerified ] = useState(false);
  const [ isEncrypting, setIsEncrypting ] = useState(false);


  async function handleHash() {
    setError("");
    setHash("");
    setIsHashing(true);
    setRecoveredMessage("");
    setIntegrityVerified(false);

    try {
      const bytes = new TextEncoder().encode(message);
      const result = await hashContent(bytes);

      setHash(result)
    } catch {
      setError("Could not calculate the hash. Please try again.");
    } finally {
      setIsHashing(false);
    }
  }

  async function handleEncrypt() {
    setError("");
    setHash("");
    setRecoveredMessage(false);
    setIsEncrypting(true);

    try {
      const originalBytes = new TextEncoder().encode(message);
      const originalHash = await hashContent(originalBytes);

      //keep content and reference hash together inside encryption 
      const payload = JSON.stringify({
        message,
        hash: originalHash,
      });

      const payloadBytes = new TextEncoder().encode(payload);
      const key = await generateKey();

      const { iv, ciphertext } = await encryptContent(payloadBytes, key);

      const decryptedBuffer = await decryptContent(ciphertext, iv, key);
      const decryptedText = new TextDecoder().decode(decryptedBuffer)

      //JSON.parse does not validate external data
      // temp demo reads only payload jsut made
      const recovered = JSON.parse(decryptedText); 

      const recoveredBytes = new TextEncoder().encode(recovered.message)
      const recoveredHash = await hashContent(recoveredBytes)

      if (recoveredHash !== recovered.hash) {
        throw new Error("Integrity verification failed.");
      }

      setHash(recoveredHash);
      setRecoveredMessage(recovered.Message)
      setIntegrityVerified(true)
    } catch(error) {
      console.error(error);
      setError("Could not encrypt, decrypt, or verify the message");
    } finally {
      setIsEncrypting(false);
    }
  }

  return (
    <main>
      <h1>Secure Packager</h1>
      <p>Encrypt a message or file, then recover and verify it.</p>

      <label htmlFor="message">Your Message</label>
      <textarea
        id="message"
        value={message}
        onChange={(event) => {
          setMessage(event.target.value);
          setHash("");
          setError("");
          setRecoveredMessage("");
          setIntegrityVerified(false);
        }}
        placeholder="Enter a message you wish to encrypt"
        rows={6}
        disabled={isHashing || isEncrypting}
      />

      <p>Characters: {message.length}</p>
      
      <button
        type="button"
        onClick={handleHash}
        disabled={isHashing || isEncrypting || message.length === 0}
      >
        {isHashing ? "Calculating..." : "Calculate SHA-256"}
      </button>

      {integrityVerified && (
        <section aria-live="polite">
          <h2>Integrity Verified</h2>
          <p>The decrypted message matches the original</p>

          <h3>Recovered Message</h3>
          <p style={{ whiteSpace: "pre-wrap" }}>{recoveredMessage}</p>
        </section>

      )}

      {error && <p role="alert">{error}</p>}

      {hash && (
        <section aria-live="polite">
          <h2>SHA-256 hash</h2>
          <code style={{ overflowWrap: "anywhere" }}>{hash}</code>
        </section>
      )}

      

    </main>
  );
}

export default App;
