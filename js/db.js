// IndexedDB: всё хранится только на устройстве
const NAME = 'trenirovki';
const VERSION = 2;
// хранилища, которые попадают в копию данных; фото — отдельно
export const STORES = ['sessions', 'measurements', 'activities', 'symptoms', 'kv'];
const ALL = [...STORES, 'photos'];

let dbPromise;
function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      for (const s of ALL) {
        if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: s === 'kv' ? 'key' : 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function run(store, mode, fn) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req ? req.result : undefined);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const getAll = (store) => run(store, 'readonly', (st) => st.getAll());
export const put = (store, obj) => run(store, 'readwrite', (st) => st.put(obj));
export const del = (store, id) => run(store, 'readwrite', (st) => st.delete(id));

export async function kvGet(key) { const r = await run('kv', 'readonly', (st) => st.get(key)); return r ? r.value : undefined; }
export const kvSet = (key, value) => put('kv', { key, value });

export async function exportAll() {
  const out = {};
  for (const s of STORES) out[s] = await getAll(s);
  return out;
}

export async function replaceAll(data, { photos = false } = {}) {
  const d = await open();
  const stores = photos ? ALL : STORES;
  await new Promise((resolve, reject) => {
    const t = d.transaction(stores, 'readwrite');
    for (const s of stores) {
      const st = t.objectStore(s);
      st.clear();
      for (const o of data[s] || []) st.put(o);
    }
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}

export async function persist() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { /* нет API */ }
  return false;
}
