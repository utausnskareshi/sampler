// Tiny IndexedDB wrapper for project + sample storage.

import { encodeWav, decodeAudio } from "../dsp/wav";
import type { Project, Sample } from "../types";

const DB_NAME = "sampler-db";
const DB_VERSION = 1;
const STORE_PROJECT = "projects";
const STORE_SAMPLE = "samples";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_PROJECT))
        db.createObjectStore(STORE_PROJECT, { keyPath: "id" });
      if (!db.objectStoreNames.contains(STORE_SAMPLE))
        db.createObjectStore(STORE_SAMPLE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const req = fn(s);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export async function saveProject(project: Project): Promise<void> {
  await tx(STORE_PROJECT, "readwrite", (s) =>
    s.put({ id: "current", ...project }),
  );
}

export async function loadProject(): Promise<Project | null> {
  const out = await tx<any>(STORE_PROJECT, "readonly", (s) => s.get("current"));
  if (!out) return null;
  delete out.id;
  return out as Project;
}

export interface StoredSample {
  id: string;
  name: string;
  source: Sample["source"];
  category?: string;
  color?: string;
  wav: ArrayBuffer;
}

export async function putSample(s: StoredSample): Promise<void> {
  await tx(STORE_SAMPLE, "readwrite", (st) => st.put(s));
}

export async function getSampleRecord(id: string): Promise<StoredSample | undefined> {
  return tx<StoredSample | undefined>(STORE_SAMPLE, "readonly", (s) => s.get(id));
}

export async function getAllSampleRecords(): Promise<StoredSample[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE_SAMPLE, "readonly");
    const out: StoredSample[] = [];
    const req = t.objectStore(STORE_SAMPLE).openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (cur) {
        out.push(cur.value as StoredSample);
        cur.continue();
      } else resolve(out);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSample(id: string): Promise<void> {
  await tx(STORE_SAMPLE, "readwrite", (s) => s.delete(id));
}

/** Convenience: encode an AudioBuffer and persist as a Sample record. */
export async function persistSample(sample: Sample): Promise<void> {
  await putSample({
    id: sample.id,
    name: sample.name,
    source: sample.source,
    category: sample.category,
    color: sample.color,
    wav: encodeWav(sample.buffer),
  });
}

/** Decode a stored sample back into a Sample object. */
export async function hydrateSample(
  ctx: BaseAudioContext,
  rec: StoredSample,
): Promise<Sample> {
  const buf = await decodeAudio(ctx, rec.wav);
  return {
    id: rec.id,
    name: rec.name,
    source: rec.source,
    category: rec.category,
    color: rec.color,
    buffer: buf,
  };
}
