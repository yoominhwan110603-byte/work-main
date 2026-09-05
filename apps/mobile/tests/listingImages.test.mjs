import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { readListingImageSlots } from '../src/features/seller/services/listingImages.ts';

const cover = 'data:image/jpeg;base64,Y292ZXI=';
const record = 'data:image/jpeg;base64,c3VyZmFjZQ==';
const extra = 'data:image/jpeg;base64,ZXh0cmE=';
let moduleId = 0;
const freshTransfer = () => import(`../src/features/seller/services/captureTransfer.ts?test=${moduleId++}`);
const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
};

beforeEach(() => {
  globalThis.window = { sessionStorage: memoryStorage(), localStorage: memoryStorage() };
});
afterEach(() => { delete globalThis.window; });

test('a cover capture cannot be consumed by the surface slot', async () => {
  const transfer = await freshTransfer();
  await transfer.setPendingCapture('image', cover, 'cover');
  assert.equal(await transfer.takePendingCapture('image', 'record'), '');
  assert.equal(await transfer.takePendingCapture('image', 'cover'), cover);
  assert.equal(await transfer.takePendingCapture('image', 'cover'), '');
  assert.equal(await transfer.takePendingCapture('image', 'record'), '');
});

test('a surface capture cannot fill the cover slot', async () => {
  const transfer = await freshTransfer();
  await transfer.setPendingCapture('image', record, 'record');
  assert.equal(await transfer.takePendingCapture('image', 'cover'), '');
  assert.equal(await transfer.takePendingCapture('image', 'record'), record);
});

test('capture target survives module reload through session storage', async () => {
  const initial = await freshTransfer();
  await initial.setPendingCapture('image', cover, 'cover');
  const restored = await freshTransfer();
  assert.equal(await restored.takePendingCapture('image', 'record'), '');
  assert.equal(await restored.takePendingCapture('image', 'cover'), cover);
});

test('legacy captures are surface-only and consumed once', async () => {
  window.sessionStorage.setItem('vinyl-check-pending-capture-transfer', JSON.stringify({ kind: 'image', dataUrl: record }));
  const transfer = await freshTransfer();
  assert.equal(await transfer.takePendingCapture('image', 'cover'), '');
  assert.equal(await transfer.takePendingCapture('image', 'record'), record);
  assert.equal(await transfer.takePendingCapture('image', 'record'), '');
});

test('new cover capture clears stale legacy surface results', async () => {
  window.localStorage.setItem('vinyl-check-scanned-record-image', record);
  const transfer = await freshTransfer();
  await transfer.setPendingCapture('image', cover, 'cover');
  assert.equal(await transfer.takePendingCapture('image', 'cover'), cover);
  assert.equal(await transfer.takePendingCapture('image', 'record'), '');
});

test('surface video cannot be applied as an image or a cover', async () => {
  const transfer = await freshTransfer();
  await transfer.setPendingCapture('video', 'surface-video', 'record');
  assert.equal(await transfer.takePendingCapture('image', 'record'), '');
  assert.equal(await transfer.takePendingCapture('image', 'cover'), '');
  assert.equal(await transfer.takePendingCapture('video', 'record'), 'surface-video');
  await assert.rejects(transfer.setPendingCapture('video', 'video', 'cover'));
});

test('surface-only draft retains the empty cover after a camera round trip', async () => {
  const draft = { images: [record], coverImageDataUrl: '', recordImageDataUrl: record, extraImages: [] };
  const transfer = await freshTransfer();
  transfer.setPendingSellDraft(draft);
  const restored = await freshTransfer();
  assert.deepEqual(readListingImageSlots(restored.takePendingSellDraft()), { cover: '', record, extras: [] });
});

test('cover-only draft does not invent a surface image', () => {
  assert.deepEqual(readListingImageSlots({ images: [cover, extra], coverImageDataUrl: cover, recordImageDataUrl: '' }), { cover, record: '', extras: [extra] });
});

test('cleared slots stay empty and extra images remain separate', () => {
  assert.deepEqual(readListingImageSlots({ images: [extra], coverImageDataUrl: '', recordImageDataUrl: '', extraImages: [extra] }), { cover: '', record: '', extras: [extra] });
});

test('named roles win over gallery ordering', () => {
  assert.deepEqual(readListingImageSlots({ images: [record, extra, cover], coverImageDataUrl: cover, recordImageDataUrl: record }), { cover, record, extras: [extra] });
});

test('legacy positional galleries preserve empty slots', () => {
  assert.deepEqual(readListingImageSlots({ images: [cover, record, extra] }), { cover, record, extras: [extra] });
  assert.deepEqual(readListingImageSlots({ images: ['', record] }), { cover: '', record, extras: [] });
});

test('editing draft keeps both photos and the editing listing identity', async () => {
  const transfer = await freshTransfer();
  transfer.setPendingSellDraft({ editingListingId: 'listing-a', coverImageDataUrl: cover, recordImageDataUrl: record, images: [cover, record] });
  const draft = transfer.takePendingSellDraft();
  assert.equal(draft.editingListingId, 'listing-a');
  assert.deepEqual(readListingImageSlots(draft), { cover, record, extras: [] });
  assert.equal(transfer.takePendingSellDraft(), null);
});
