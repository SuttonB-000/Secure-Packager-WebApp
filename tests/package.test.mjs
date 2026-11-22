import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bytesToBase64,
  encryptContent,
  exportKey,
  generateKey,
  hashContent,
} from '../src/utils/crypto.ts';
import {
  createFilePackage,
  createMessagePackage,
  openUploadedPackage,
} from '../src/utils/package.ts';

const encoder = new TextEncoder();

function uploadFiles(result) {
  return [
    new File([JSON.stringify(result.encryptedPackage)], 'content.secure.json'),
    new File([result.exportedKey], 'content.key.txt'),
  ];
}

// Build authenticated packages with custom payloads to exercise runtime validation.
async function packagePayload(payload) {
  const key = await generateKey();
  const { iv, ciphertext } = await encryptContent(
    encoder.encode(JSON.stringify(payload)),
    key,
  );
  return {
    encryptedPackage: {
      version: 1,
      algorithm: 'AES-GCM',
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    },
    exportedKey: await exportKey(key),
  };
}

test('message packages retain their format and recover after key export', async () => {
  for (const message of ['', 'Hello!\nこんにちは 🔐', '\ud800']) {
    const result = await createMessagePackage(message);
    assert.equal(result.message, message);
    assert.equal(result.encryptedPackage.version, 1);
    assert.equal(result.encryptedPackage.algorithm, 'AES-GCM');

    const recovered = await openUploadedPackage(...uploadFiles(result));
    assert.deepEqual(recovered, {
      kind: 'message',
      message: new TextDecoder().decode(encoder.encode(message)),
      hash: await hashContent(encoder.encode(message)),
    });
  }
});

test('file packages recover exact binary bytes with a safe filename and download type', async () => {
  const bytes = new Uint8Array([0, 255, 128, 10, 13, 42]);
  const file = new File([bytes], 'folder\\example.bin', { type: 'image/png' });
  const result = await createFilePackage(file);
  const recovered = await openUploadedPackage(...uploadFiles(result));

  assert.equal(recovered.kind, 'file');
  assert.equal(recovered.filename, 'example.bin');
  assert.equal(recovered.file.type, 'application/octet-stream');
  assert.deepEqual(new Uint8Array(await recovered.file.arrayBuffer()), bytes);
  assert.equal(recovered.hash, await hashContent(bytes));
});

test('file recovery strips both directory separators and supplies a fallback name', async () => {
  const hash = await hashContent(new Uint8Array());
  for (const [name, expected] of [
    ['../folder/example.txt', 'example.txt'],
    ['..\\folder\\example.txt', 'example.txt'],
    ['', 'recovered-file'],
  ]) {
    const result = await packagePayload({ kind: 'file', name, content: '', hash });
    const recovered = await openUploadedPackage(...uploadFiles(result));
    assert.equal(recovered.kind, 'file');
    assert.equal(recovered.filename, expected);
  }
});

test('recovery rejects incorrect keys and mismatched payload hashes', async () => {
  const result = await createMessagePackage('private');
  const [packageFile] = uploadFiles(result);
  const wrongKey = new File([await exportKey(await generateKey())], 'wrong.key.txt');
  await assert.rejects(openUploadedPackage(packageFile, wrongKey));

  const mismatched = await packagePayload({ message: 'changed', hash: '0'.repeat(64) });
  await assert.rejects(
    openUploadedPackage(...uploadFiles(mismatched)),
    /Integrity verification failed/,
  );
});

test('recovery rejects malformed envelopes and unsupported payloads', async () => {
  const result = await createMessagePackage('test');
  const [, keyFile] = uploadFiles(result);
  for (const envelope of [null, {}, { ...result.encryptedPackage, version: 2 }]) {
    const packageFile = new File([JSON.stringify(envelope)], 'invalid.json');
    await assert.rejects(openUploadedPackage(packageFile, keyFile), /Invalid or unsupported package/);
  }

  const invalidIv = { ...result, encryptedPackage: { ...result.encryptedPackage, iv: '' } };
  await assert.rejects(openUploadedPackage(...uploadFiles(invalidIv)), /Invalid initialization vector/);

  for (const payload of [
    null,
    { message: 42, hash: '0'.repeat(64) },
    { kind: 'unknown', message: 'test', hash: '0'.repeat(64) },
    { kind: 'file', name: 42, content: '', hash: '0'.repeat(64) },
  ]) {
    const invalid = await packagePayload(payload);
    await assert.rejects(openUploadedPackage(...uploadFiles(invalid)), /Invalid .*payload/);
  }
});

test('size checks reject oversized uploads before parsing or encrypting', async () => {
  const emptyFile = new File([], 'empty');
  const largePackage = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'large.json');
  const largeKey = new File([new Uint8Array(1025)], 'large.key.txt');
  const largeSource = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.bin');

  await assert.rejects(openUploadedPackage(largePackage, emptyFile), /too large/);
  await assert.rejects(openUploadedPackage(emptyFile, largeKey), /too large/);
  await assert.rejects(createFilePackage(largeSource), /5 MiB or smaller/);
});
