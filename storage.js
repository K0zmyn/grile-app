// storage.js
// Persistă PDF-urile și grilele local (IndexedDB) după primul import.
// API: StorageDB.putBook(key, Blob), getBookURL(key), hasBook(key), putJSON(key, obj), getJSON(key), rememberLibraryIndex(indexObj)

const DB_NAME = 'quizlib-db';
const DB_VER  = 1;
let dbp;

function openDB() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = () => {
        const db = req.result;
        db.createObjectStore('books');
        db.createObjectStore('jsons');
        db.createObjectStore('meta');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

async function idbPut(store, key, value) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readwrite');
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
    tx.objectStore(store).put(value, key);
  });
}

async function idbGet(store, key) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    tx.onerror = () => rej(tx.error);
    const rq = tx.objectStore(store).get(key);
    rq.onsuccess = () => res(rq.result);
  });
}

async function idbKeys(store) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(store, 'readonly');
    tx.onerror = () => rej(tx.error);
    const req = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => res(req.result);
  });
}

export const StorageDB = {
  async putBook(key, blob) {
    await idbPut('books', key, blob);
  },
  async getBookURL(key) {
    const blob = await idbGet('books', key);
    if (!blob) return null;
    return URL.createObjectURL(blob);
  },
  async hasBook(key) {
    const keys = await idbKeys('books');
    return keys.includes(key);
  },
  async putJSON(key, obj) {
    await idbPut('jsons', key, new Blob([JSON.stringify(obj)], { type:'application/json' }));
  },
  async getJSON(key) {
    const b = await idbGet('jsons', key);
    if (!b) return null;
    const txt = await b.text();
    return JSON.parse(txt);
  },
  async setMeta(key, value) {
    await idbPut('meta', key, new Blob([JSON.stringify(value)], {type:'application/json'}));
  },
  async getMeta(key) {
    const b = await idbGet('meta', key);
    if (!b) return null;
    return JSON.parse(await b.text());
  }
};
