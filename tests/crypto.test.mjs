import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hashContent,
  generateKey,
  encryptContent,
  decryptContent,
  exportKey,
  importKey,
} from '../src/utils/crypto.ts';

const encoder = new TextEncoder();

test('SHA-256 matches known test vectors', async () => {
  assert.equal(
    await hashContent(encoder.encode('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  );
  assert.equal(
    await hashContent(encoder.encode('')),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  );
});

test('AES-GCM recovers empty, Unicode, multiline, and long messages', async () => {
  const key = await generateKey();
  for (const message of ['', 'Hello!\nこんにちは 🔐', 'a'.repeat(100_000)]) {
    const bytes = encoder.encode(message);
    const { iv, ciphertext } = await encryptContent(bytes, key);
    const recovered = await decryptContent(ciphertext, iv, key);
    assert.equal(new TextDecoder().decode(recovered), message);
    assert.equal(await hashContent(new Uint8Array(recovered)), await hashContent(bytes));
    assert.equal(iv.byteLength, 12);
  }
});

test('each encryption uses a fresh IV', async () => {
  const key = await generateKey();
  const bytes = encoder.encode('same plaintext');
  const first = await encryptContent(bytes, key);
  const second = await encryptContent(bytes, key);
  assert.notDeepEqual(first.iv, second.iv);
  assert.notDeepEqual(first.ciphertext, second.ciphertext);
});

test('AES-GCM rejects altered ciphertext, IV, wrong keys, and truncation', async () => {
  const key = await generateKey();
  const { iv, ciphertext } = await encryptContent(encoder.encode('private message'), key);
  const alteredCiphertext = new Uint8Array(ciphertext.slice(0));
  alteredCiphertext[0] ^= 1;
  await assert.rejects(decryptContent(alteredCiphertext.buffer, iv, key));

  const alteredIv = iv.slice();
  alteredIv[0] ^= 1;
  await assert.rejects(decryptContent(ciphertext, alteredIv, key));
  await assert.rejects(decryptContent(ciphertext, iv, await generateKey()));
  await assert.rejects(decryptContent(ciphertext.slice(0, -1), iv, key));
});

test('AES-256-GCM keys can be exported and reimported for decryption', async () => {
  const key = await generateKey();
  assert.equal(key.algorithm.name, 'AES-GCM');
  assert.equal(key.algorithm.length, 256);
  assert.equal(key.extractable, true);
  const keyText = await exportKey(key);
  const importedKey = await importKey(keyText);
  const message = 'Recover this message with the downloaded key.';
  const { iv, ciphertext } = await encryptContent(encoder.encode(message), key);
  const recovered = await decryptContent(ciphertext, iv, importedKey);
  assert.equal(new TextDecoder().decode(recovered), message);
});
