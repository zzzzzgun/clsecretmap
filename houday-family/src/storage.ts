import type { AppState } from './model';

// 端末の中（ブラウザの IndexedDB）に保存する。サーバーには何も送らない。

const DB_NAME = 'houday-family';
const DB_VERSION = 1;
const KV = 'kv';
const PHOTOS = 'photos';
const STATE_KEY = 'state';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV)) db.createObjectStore(KV);
      if (!db.objectStoreNames.contains(PHOTOS)) db.createObjectStore(PHOTOS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run<T>(store: string, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = op(tx.objectStore(store));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function loadState(): Promise<AppState | undefined> {
  return run<AppState | undefined>(KV, 'readonly', (s) => s.get(STATE_KEY));
}

export async function saveState(state: AppState): Promise<void> {
  await run(KV, 'readwrite', (s) => s.put(state, STATE_KEY));
}

export async function putPhoto(id: string, blob: Blob): Promise<void> {
  await run(PHOTOS, 'readwrite', (s) => s.put(blob, id));
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  return run<Blob | undefined>(PHOTOS, 'readonly', (s) => s.get(id));
}

export async function deletePhoto(id: string): Promise<void> {
  await run(PHOTOS, 'readwrite', (s) => s.delete(id));
}

export async function allPhotoIds(): Promise<string[]> {
  const keys = await run<IDBValidKey[]>(PHOTOS, 'readonly', (s) => s.getAllKeys());
  return keys.map(String);
}

export async function clearPhotos(): Promise<void> {
  await run(PHOTOS, 'readwrite', (s) => s.clear());
}

/**
 * ブラウザが容量不足のときに勝手にデータを消さないよう頼む。
 * 認められるかはブラウザ次第なので、バックアップは別に必要。
 */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}
