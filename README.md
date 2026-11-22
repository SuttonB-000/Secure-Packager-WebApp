# Secure Packager

A React and TypeScript demo of message hashing, encryption, decryption, and integrity verification using the browser's Web Crypto API.

## Run locally

Use Node.js 22.18+ (or a newer supported release) with npm. The test command imports TypeScript using Node's built-in type stripping.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Web Crypto requires a secure context: localhost works for development; a deployed version requires HTTPS.

## Use the demo

1. Enter a message.
2. Choose **Calculate SHA-256** to display its hash, or **Encrypt, decrypt, and verify** to run the full round trip.
3. For the full round trip, the app hashes the UTF-8 message and places the message and hash together in a JSON payload. It encrypts the payload with a new, non-exportable AES-256-GCM key and a random 12-byte IV, then immediately decrypts it with that key.
4. The app validates the recovered payload, recalculates the message hash, and shows the recovered message only after the hashes match.

Editing the message clears previous results. Both action buttons and the text field are disabled while an operation runs.

## Checks

```sh
npm run build
npm run lint
npm test
npm audit
```

Tests cover known SHA-256 vectors, empty and Unicode messages, long messages, fresh IVs, non-exportable keys, and rejection of altered ciphertext, altered IVs, incorrect keys, and truncated data.

## Scope and limitations

This is an in-browser demonstration. It supports text messages only; file input, downloadable packages, saved keys, and later decryption are not implemented. No application backend receives messages, and the app does not explicitly persist messages or keys. Plaintext is displayed in the page, so use sample data for the demo.

AES-GCM authenticates the encrypted payload. The enclosed SHA-256 hash demonstrates an additional integrity comparison; it does not prove the sender's identity or provide a digital signature.
