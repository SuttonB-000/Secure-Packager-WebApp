# Secure Packager

A React and TypeScript demo that encrypts text messages or files, downloads encrypted packages and keys, and recovers content with integrity verification using the browser's Web Crypto API.

## Documentation

- [Design and architecture](docs/architecture.md): module boundaries, data flow, design rationale, tradeoffs, and known gaps.
- [Class project report](docs/project-report.md): project purpose, secure coding practices, verification results, and learning outcomes.

## Run locally

Use Node.js 22.18+ (or a newer supported release) with npm. The test command imports TypeScript using Node's built-in type stripping.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Web Crypto requires a secure context: localhost works for development; a deployed version requires HTTPS.

## Create a package

### Text message

1. Enter a message under **Encrypt a message**.
2. Choose **Calculate SHA-256** to display only its hash, or **Encrypt and verify** to create a package and immediately check a decryption round trip.
3. After encryption, review the recovered message and hash.
4. Choose **Download encrypted package** and **Download key** to save `content.secure.json` and `content.key.txt`.

The interface requires a nonempty message. Editing the message or changing the selected source file clears the shared encryption results.

### File

1. Select a file under **Encrypt a file**. The maximum source file size is 4 MiB (4,194,304 bytes).
2. Choose **Encrypt file**.
3. Download the encrypted package and key using the same buttons as for messages.

File creation displays the original file's hash. To verify recovery, reopen the downloaded package using the steps below; file creation does not perform the immediate decryption round trip used for messages. Creation checks that the downloaded package fits the import limit.

Keep track of which key belongs to each package: downloads use the same default names for every operation. The key file contains the raw encryption key encoded as Base64, without password protection. Anyone with both files can decrypt the content.

## Open a saved package

1. Under **Open an encrypted package**, select the saved JSON package and its matching key text file.
2. Choose **Decrypt and verify package**.
3. After successful verification, read the recovered message or choose **Download recovered file**.

The app accepts package uploads up to 8 MiB and key uploads up to 1 KiB. Recovered files must be 4 MiB or smaller. One MiB is 1,048,576 bytes; one KiB is 1,024 bytes.

Recovered files use the final component of their stored filename, removing directory prefixes separated by `/` or `\`. They download with the generic `application/octet-stream` content type, rather than the original MIME type.

If recovery fails, check that you selected the matching key and that both files are complete and within the size limits. Incorrect keys, damaged ciphertext, and invalid or unsupported package contents are rejected. There is no key recovery feature.

## How it works

1. The app hashes the UTF-8 bytes of a message or the original bytes of a file using SHA-256.
2. It places the content and hash in a JSON payload. File payloads also include a filename and MIME type, with the file bytes encoded as Base64.
3. Each package gets a new exportable AES-256-GCM key and a random 12-byte initialization vector (IV). The JSON payload is encrypted with that key and IV.
4. The downloadable JSON envelope contains `version: 1`, `algorithm: "AES-GCM"`, a Base64 `iv`, and Base64 `ciphertext`. The key is downloaded separately.
5. Creation checks that the pretty-printed JSON package fits the 8 MiB import limit before offering downloads. On import, the app validates the envelope and IV length, imports the key for decryption, and decrypts the payload. It validates the recovered payload and compares its stored hash with a newly calculated SHA-256 hash before returning content to the interface.

## Confidentiality, integrity, and availability

- **Confidentiality:** AES-256-GCM encrypts the message or file so the package alone does not reveal its contents. The key is downloaded separately and must be kept private. Anyone who obtains both the package and its key can read the content.
- **Integrity:** The app hashes the original content with SHA-256, stores that hash inside the encrypted payload, and compares it with a new hash after decryption. AES-GCM also detects changes to the encrypted data or use of the wrong key. A matching hash does not prove who created the package.
- **Availability:** A saved package can be reopened locally if the user retains its matching key and a compatible browser. The app has no account or key-recovery service: losing the key makes the content unrecoverable. File and package size limits also constrain what the app can reopen. Keeping backup copies of both downloads helps preserve access, provided the key remains private.

## Entropy and key generation

Entropy is unpredictability in the random values used by cryptography. The app calls the browser's Web Crypto API to generate a new 256-bit AES-GCM key for each package (`crypto.subtle.generateKey`) and a fresh 12-byte IV for encryption (`crypto.getRandomValues`). The application does not derive either value from the message, a timestamp, or `Math.random()`. Unpredictable keys make guessing the secret impractical; a fresh IV avoids reusing the same key/IV combination, which would undermine GCM security. The IV travels in the package and need not be secret, while the exported key must be protected. Base64 in the key download is only an encoding, not encryption.

## Project structure

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Message and file forms, operation state, results, and error messages |
| `src/utils/crypto.ts` | SHA-256, AES-GCM, Base64 conversion, and key import/export |
| `src/utils/package.ts` | Package creation, parsing, size limits, and integrity verification |
| `src/utils/download.ts` | Local downloads using Blob URLs |
| `tests/crypto.test.mjs` | Cryptographic helper tests |
| `tests/package.test.mjs` | Package round trips and validation tests |

## Checks

```sh
npm run build
npm run lint
npm test
```

`npm run build` checks TypeScript and generates the static site in `dist/`. Use `npm run preview` to inspect that build locally. `npm run lint` checks the source with ESLint, and `npm test` runs the Node.js test runner.

Tests cover known SHA-256 vectors; empty, Unicode, multiline, and long messages; fresh IVs; key export/import; binary file recovery; filename handling; malformed packages; the maximum file size round trip; oversized message rejection; mismatched hashes; and rejection of altered ciphertext, altered IVs, incorrect keys, and truncated data. These are utility tests and do not automate the browser interface or download dialogs.

For a manual smoke check, create and reopen a message package, then repeat with a small file and compare the recovered contents. Try the message package with a different package's key and confirm that recovery fails without showing recovered content.

## Scope and limitations

This is an in-browser demonstration. No application backend receives messages or file contents. The application does not save them to browser storage; its working state remains in memory, and downloads are saved through the browser. Reloading clears the interface, so save both the package and its key if you need later recovery.

Plaintext and keys are accessible to the running page. Use sample data for the demo; it does not protect against compromised page scripts, browser extensions, or devices. Recovered files are not scanned for malicious content.

AES-GCM authenticates the encrypted payload. The enclosed SHA-256 hash demonstrates an additional integrity comparison; it does not prove the sender's identity or provide a digital signature.

Files are processed entirely in memory, with Base64 and JSON adding overhead. Source files are limited to 4 MiB, and creation rejects any file or message whose downloaded JSON package would exceed 8 MiB. Messages have no fixed character limit; long messages may be rejected after encryption when the package size is known.
