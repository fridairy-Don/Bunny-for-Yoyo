"use client";

// Tiny IndexedDB wrapper for user-uploaded audio files. Picks files from
// disk, stores the binary Blob in the browser so it survives reloads and
// tab closes, and serves them as playable ObjectURLs.
//
// Storage is per-browser / per-device. If you want the same uploads to
// follow you to another device, we would need to add Supabase Storage;
// for now "my library" is local to each install.

const DB_NAME = "bunny-audio";
const STORE = "tracks";
const VERSION = 1;

export type LocalTrack = {
  id: string;
  title: string;
  addedAt: number;
  mimeType: string;
  size: number;
};

type StoredTrack = LocalTrack & { blob: Blob };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txn(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE, mode).objectStore(STORE);
}

export async function addLocalTrack(file: File): Promise<LocalTrack> {
  const db = await openDB();
  const id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const title = file.name.replace(/\.[^.]+$/, "");
  const record: StoredTrack = {
    id,
    title,
    addedAt: Date.now(),
    mimeType: file.type || "audio/mpeg",
    size: file.size,
    blob: file,
  };
  await new Promise<void>((resolve, reject) => {
    const req = txn(db, "readwrite").put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  db.close();
  return {
    id: record.id,
    title: record.title,
    addedAt: record.addedAt,
    mimeType: record.mimeType,
    size: record.size,
  };
}

export async function listLocalTracks(): Promise<
  Array<LocalTrack & { objectUrl: string }>
> {
  const db = await openDB();
  const records = await new Promise<StoredTrack[]>((resolve, reject) => {
    const req = txn(db, "readonly").getAll();
    req.onsuccess = () => resolve(req.result as StoredTrack[]);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return records
    .sort((a, b) => b.addedAt - a.addedAt)
    .map((r) => ({
      id: r.id,
      title: r.title,
      addedAt: r.addedAt,
      mimeType: r.mimeType,
      size: r.size,
      objectUrl: URL.createObjectURL(r.blob),
    }));
}

export async function deleteLocalTrack(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const req = txn(db, "readwrite").delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
  db.close();
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
