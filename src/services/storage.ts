import type { StateStorage } from 'zustand/middleware';
let dbPromise: Promise<IDBDatabase> | undefined;
function db() {
  return dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('forma-studio', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('state');
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
async function operation<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await db();
  return new Promise<T>((resolve, reject) => {
    const tx = database.transaction('state', mode); const req = run(tx.objectStore('state'));
    tx.oncomplete = () => resolve(req.result); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
  });
}
export const indexedStorage: StateStorage = {
  getItem: async key => (await operation('readonly', s => s.get(key))) ?? null,
  setItem: async (key, value) => {
    try { await operation('readwrite', s => s.put(value, key)); }
    catch { window.dispatchEvent(new Event('forma:storage-error')); }
  },
  removeItem: async key => { await operation('readwrite', s => s.delete(key)); },
};
