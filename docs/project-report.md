# Secure Packager: Class project report

**Course:** SDEV245 — Secure Coding  
**Project:** Secure Packager

This report describes the current repository and observed verification results. It does not claim a formal security audit, deployment review, or completion of requirements from a course rubric that has not been provided.

## Project purpose

Secure Packager demonstrates how confidentiality, hashing, authenticated encryption, and input validation can work together in a small browser application. A user can encrypt a text message or file, save an encrypted package and a separate key, and later reopen the package to recover verified content.

The educational goal is to make the relationship between encryption and integrity visible. The application displays a SHA-256 hash and reports successful verification after decryption. It also provides failure paths for incorrect keys, modified encrypted data, unsupported payloads, and oversized uploads.

## Implemented functionality

The application supports message hashing, message encryption with an immediate verification round trip, file encryption, separate package and key downloads, and recovery from uploaded package/key pairs. Recovered messages appear in the page. Recovered files are offered as binary downloads after validation.

All content processing occurs in the browser. The application has no backend, database, account system, or automatic storage of messages and keys. Users must retain downloaded files to recover content after refreshing or leaving the page.

## Architecture and design rationale

The project uses React for the interface, TypeScript for application types, and Vite for development and production builds. Its source separates presentation, package logic, cryptographic operations, and download handling. This organization allows the cryptographic and validation functions to be tested independently of the interface.

The architecture favors a small, inspectable implementation. `App.tsx` manages the forms and results; `package.ts` defines the package format and validation workflow; `crypto.ts` wraps Web Crypto; and `download.ts` handles local downloads. Browser-native cryptographic operations avoid the need to implement cryptographic algorithms directly.

The chosen package format is a versioned JSON envelope containing an algorithm identifier, IV, and ciphertext. Binary fields use Base64 so that the envelope can be saved as JSON. This makes the format easy to inspect but adds storage and memory overhead. File data is encoded once inside the plaintext payload and again as part of the encrypted envelope.

Keys are downloaded separately to support later recovery without a server. This creates a clear responsibility for the user: the key must remain private and must be retained with a reliable association to its package. The key file is raw key material encoded as Base64 and has no password protection.

These rationales are interpretations of the implemented design. The repository does not contain a historical decision log. Further technical details and tradeoffs appear in [Design and architecture](architecture.md).

## Secure coding practices

**Authenticated encryption.** The application uses AES-256-GCM with a newly generated key for every package and a random 12-byte IV. GCM rejects decryption when the ciphertext is altered or the wrong key is supplied. The key and IV are generated through browser cryptographic APIs.

**Integrity comparison.** SHA-256 is calculated over the message's UTF-8 bytes or the file's original bytes. The hash is stored inside the encrypted payload and checked after decryption. GCM already authenticates that payload, so the hash is primarily an additional educational integrity check. Neither the hash nor successful GCM verification proves the identity of the sender.

**Validation at trust boundaries.** Uploaded JSON is parsed as `unknown` and checked at runtime. The application validates the envelope version, algorithm, field types, IV length, key length, payload structure, and hash format. It compares the recalculated hash before returning recovered content to the interface. TypeScript supports development correctness, while these runtime checks handle untrusted external data.

**Controlled recovery.** File recovery removes directory prefixes from the stored filename and uses `application/octet-stream` for the returned Blob. The application does not render recovered file content. This is limited filename handling rather than a complete filename policy, and it does not establish that a downloaded file is safe to open.

**State and error handling.** Changes to inputs clear previous results, and controls are disabled while their workflow runs. Import failures produce an error rather than a successful recovery result. Creation and import have separate state so that each workflow can report its own progress and errors.

## Verification results

The following checks passed during the documentation review:

| Check | Observed result | What it establishes |
| --- | --- | --- |
| `npm test` | 13 tests passed; 0 failed | Covered utility behavior matched assertions |
| `npm run build` | Passed | TypeScript compilation and Vite production build completed |
| `npm run lint` | Passed | Source passed the configured ESLint rules |

Cryptographic tests cover known SHA-256 vectors, empty and Unicode content, multiline and long messages, fresh IVs, key export/import, and rejection of altered ciphertext, altered IVs, wrong keys, and truncated ciphertext.

Package tests cover message and binary-file round trips, the maximum supported file size, oversized message rejection, recovered filenames, incorrect keys, mismatched hashes, invalid envelopes, unsupported payloads, and rejection of inputs exceeding configured size limits.

These checks support the behavior they exercise. They do not demonstrate production readiness or complete security. Browser interaction, actual download dialogs, and accessibility have not been validated by this automated suite.

## Package size compatibility

An earlier boundary check found that the application accepted a source file that it could not later recover through its upload workflow. Encrypting a 5 MiB file named `limit.bin` produced a 9,321,004-byte package using the same pretty-printed JSON format as the download. The importer allows only 8 MiB, or 8,388,608 bytes, and rejected that package with `Package or key file is too large.`

The cause was the mismatch between source-file and package limits combined with two layers of Base64 encoding. The source-file limit is now 4 MiB. Creation checks the exact downloaded JSON package size against the 8 MiB import limit before offering either a file or message package. A regression test confirms recovery at the maximum supported file size, and another rejects a message whose package would exceed the import limit.

This boundary case illustrates why tests should exercise a complete download and recovery workflow in addition to checking each limit separately.

## Remaining risks and future work

The demonstration trusts the delivered application code, browser, extensions, and operating system. Plaintext and keys are available to the running page, and no explicit memory wiping is implemented. Keeping package and key downloads together removes the practical confidentiality benefit if both are obtained by another person. The application offers no recovery for a lost key and no proof of sender identity.

Files are processed in memory, and messages have no fixed character limit; creation rejects generated packages above 8 MiB. Future work could address browser workflow coverage, clearer package/key pairing, smaller UI components, and a versioned password-protected key format. Each would require implementation and validation before being described as supported.

## Learning outcomes

The project connects several secure coding concepts: using platform cryptography, distinguishing confidentiality from integrity and identity, validating data at trust boundaries, separating UI code from security-sensitive logic, and testing failure paths. The size-limit finding demonstrates why end-to-end boundary tests are useful.

## Repository evidence

- [Application interface](../src/App.tsx)
- [Package format and validation](../src/utils/package.ts)
- [Cryptographic implementation](../src/utils/crypto.ts)
- [Cryptographic tests](../tests/crypto.test.mjs) and [package tests](../tests/package.test.mjs)
- [Build and verification commands](../package.json)
