import { useState } from "react";
import { hashContent } from "./utils/crypto.ts";

function App() {
  const [message, setMessage] = useState("");
  const [hash, setHash] = useState("");
  const [error, setError] = useState("");
  const [isHashing, setIsHashing] = useState(false);

  async function handleHash() {
    setError("");
    setHash("");
    setIsHashing(true);

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
        }}
        placeholder="Enter a message you wish to encrypt"
        rows={6}
        disabled={isHashing}
      />

      <p>Characters: {message.length}</p>
      
      <button
        type="button"
        onClick={handleHash}
        disabled={isHashing || message.length === 0}
      >
        {isHashing ? "Calculating..." : "Calculate SHA-256"}
      </button>

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
