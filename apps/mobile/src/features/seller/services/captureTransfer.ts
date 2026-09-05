type CaptureKind = 'image' | 'video';
export type CaptureTarget = 'cover' | 'record';

type PendingCapture = {
  kind: CaptureKind;
  target: CaptureTarget;
  dataUrl: string;
};

const CAPTURE_STORAGE_KEY = 'vinyl-check-pending-capture-transfer';
const SELL_DRAFT_STORAGE_KEY = 'vinyl-check-pending-sell-draft-transfer';
const TRANSFER_DB_NAME = 'vinyl-check-capture-transfer';
const TRANSFER_STORE_NAME = 'entries';
const LEGACY_CAPTURE_KEYS: Record<CaptureKind, string> = {
  image: 'vinyl-check-scanned-record-image',
  video: 'vinyl-check-scanned-record-video',
};

let pendingCapture: PendingCapture | null = null;
let pendingSellDraft: Record<string, unknown> | null = null;
let transferDbPromise: Promise<IDBDatabase | null> | null = null;

function sessionStore() {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function localStore() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function writeSessionValue(key: string, value: unknown) {
  const storage = sessionStore();
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    storage.removeItem(key);
  }
}

function readSessionValue<T>(key: string): T | null {
  const storage = sessionStore();
  if (!storage) return null;
  try {
    return JSON.parse(storage.getItem(key) || 'null') as T | null;
  } catch {
    storage.removeItem(key);
    return null;
  }
}

function removeSessionValue(key: string) {
  sessionStore()?.removeItem(key);
}

function normalizePendingCapture(value: unknown): PendingCapture | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PendingCapture>;
  if ((candidate.kind !== 'image' && candidate.kind !== 'video') || typeof candidate.dataUrl !== 'string' || !candidate.dataUrl) {
    return null;
  }
  return { kind: candidate.kind, target: candidate.target === 'cover' && candidate.kind === 'image' ? 'cover' : 'record', dataUrl: candidate.dataUrl };
}

function normalizeDraft(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function openTransferDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (transferDbPromise) return transferDbPromise;
  transferDbPromise = new Promise(resolve => {
    const request = indexedDB.open(TRANSFER_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(TRANSFER_STORE_NAME)) {
        database.createObjectStore(TRANSFER_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
  return transferDbPromise;
}

async function writePersistentValue(key: string, value: unknown) {
  const database = await openTransferDb();
  if (!database) return;
  await new Promise<void>(resolve => {
    try {
      const transaction = database.transaction(TRANSFER_STORE_NAME, 'readwrite');
      transaction.objectStore(TRANSFER_STORE_NAME).put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function readPersistentValue<T>(key: string): Promise<T | null> {
  const database = await openTransferDb();
  if (!database) return null;
  return await new Promise<T | null>(resolve => {
    try {
      const transaction = database.transaction(TRANSFER_STORE_NAME, 'readonly');
      const request = transaction.objectStore(TRANSFER_STORE_NAME).get(key);
      request.onsuccess = () => resolve((request.result || null) as T | null);
      request.onerror = () => resolve(null);
      transaction.onerror = () => resolve(null);
      transaction.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function removePersistentValue(key: string) {
  const database = await openTransferDb();
  if (!database) return;
  await new Promise<void>(resolve => {
    try {
      const transaction = database.transaction(TRANSFER_STORE_NAME, 'readwrite');
      transaction.objectStore(TRANSFER_STORE_NAME).delete(key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export async function setPendingCapture(kind: CaptureKind, dataUrl: string, target: CaptureTarget = 'record') {
  if (target === 'cover' && kind !== 'image') throw new Error('Cover captures must be images.');
  pendingCapture = { kind, target, dataUrl };
  Object.values(LEGACY_CAPTURE_KEYS).forEach(key => localStore()?.removeItem(key));
  writeSessionValue(CAPTURE_STORAGE_KEY, pendingCapture);
  await writePersistentValue(CAPTURE_STORAGE_KEY, pendingCapture);
}

export async function takePendingCapture(kind: CaptureKind, target: CaptureTarget = 'record') {
  const storedCapture = pendingCapture
    || normalizePendingCapture(readSessionValue<PendingCapture>(CAPTURE_STORAGE_KEY))
    || normalizePendingCapture(await readPersistentValue<PendingCapture>(CAPTURE_STORAGE_KEY));
  if (!storedCapture) {
    if (target !== 'record') return '';
    const legacy = localStore()?.getItem(LEGACY_CAPTURE_KEYS[kind]) || '';
    localStore()?.removeItem(LEGACY_CAPTURE_KEYS[kind]);
    return legacy;
  }
  if (storedCapture.kind !== kind || storedCapture.target !== target) return '';
  const dataUrl = storedCapture.dataUrl;
  pendingCapture = null;
  removeSessionValue(CAPTURE_STORAGE_KEY);
  await removePersistentValue(CAPTURE_STORAGE_KEY);
  localStore()?.removeItem(LEGACY_CAPTURE_KEYS[kind]);
  return dataUrl;
}

export function setPendingSellDraft(draft: Record<string, unknown>) {
  pendingSellDraft = draft;
  writeSessionValue(SELL_DRAFT_STORAGE_KEY, draft);
}

export function takePendingSellDraft() {
  const draft = pendingSellDraft || normalizeDraft(readSessionValue<Record<string, unknown>>(SELL_DRAFT_STORAGE_KEY));
  pendingSellDraft = null;
  removeSessionValue(SELL_DRAFT_STORAGE_KEY);
  return draft;
}
