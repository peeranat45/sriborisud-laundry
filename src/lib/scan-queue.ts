/**
 * คิวสำหรับเก็บการสแกนไว้ในเครื่องเมื่อเน็ตหลุด แล้วส่งขึ้นระบบเมื่อกลับมาออนไลน์
 *
 * ใช้ IndexedDB โดยตรงโดยไม่พึ่งไลบรารี เพราะต้องการแค่ 4 การกระทำ
 * คือ เพิ่ม · อ่านทั้งหมด · ลบรายตัว · ล้างทั้งหมด
 */

const DB_NAME = "sbl-poc";
const STORE = "scan-queue";
const VERSION = 1;

export interface QueuedScan {
  id?: number;
  code: string;
  station: string;
  /** เวลาที่สแกนจริง ไม่ใช่เวลาที่ส่งขึ้นระบบ */
  scannedAt: string;
  synced: boolean;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const scanQueue = {
  add(scan: Omit<QueuedScan, "id">) {
    return tx("readwrite", (s) => s.add(scan));
  },
  all(): Promise<QueuedScan[]> {
    return tx<QueuedScan[]>("readonly", (s) => s.getAll());
  },
  remove(id: number) {
    return tx("readwrite", (s) => s.delete(id));
  },
  clear() {
    return tx("readwrite", (s) => s.clear());
  },
};
