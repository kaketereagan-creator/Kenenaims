/**
 * KFMS Offline Sync Engine
 * Uses IndexedDB (via idb) to cache all writes when offline.
 * Auto-syncs when connectivity is restored — chronological order, conflict-free.
 */

import { openDB } from 'idb';

const DB_NAME = 'kfms_offline';
const DB_VERSION = 1;
const STORE_QUEUE = 'sync_queue';
const STORE_CACHE  = 'data_cache';

// ── Open / Init DB ─────────────────────────────────────────────────────────
export async function getDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Pending operations queue
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        const qs = db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
        qs.createIndex('by_timestamp', 'timestamp');
        qs.createIndex('by_synced', 'is_synced');
      }
      // Local read cache (animals list, tasks, etc.)
      if (!db.objectStoreNames.contains(STORE_CACHE)) {
        db.createObjectStore(STORE_CACHE, { keyPath: 'key' });
      }
    },
  });
}

// ── Queue a write operation ────────────────────────────────────────────────
export async function queueOperation(method, path, body, meta = {}) {
  const db = await getDB();
  const op = {
    method,
    path,
    body,
    meta,            // { type: 'animal_weight', label: 'Weight for RBT-000001' }
    timestamp: Date.now(),
    is_synced: false,
    attempts: 0,
    error: null,
  };
  const id = await db.add(STORE_QUEUE, op);
  console.log(`[Offline] Queued: ${method} ${path} (id=${id})`);
  return id;
}

// ── Get all pending ops ────────────────────────────────────────────────────
export async function getPendingOps() {
  const db = await getDB();
  const all = await db.getAllFromIndex(STORE_QUEUE, 'by_synced', false);
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

export async function getPendingCount() {
  const pending = await getPendingOps();
  return pending.length;
}

// ── Mark op as synced ──────────────────────────────────────────────────────
async function markSynced(id) {
  const db = await getDB();
  const op = await db.get(STORE_QUEUE, id);
  if (op) { op.is_synced = true; await db.put(STORE_QUEUE, op); }
}

async function markFailed(id, error) {
  const db = await getDB();
  const op = await db.get(STORE_QUEUE, id);
  if (op) { op.attempts++; op.error = error; await db.put(STORE_QUEUE, op); }
}

// ── Cache read data ────────────────────────────────────────────────────────
export async function cacheData(key, value) {
  const db = await getDB();
  await db.put(STORE_CACHE, { key, value, cached_at: Date.now() });
}

export async function getCached(key) {
  const db = await getDB();
  const entry = await db.get(STORE_CACHE, key);
  return entry?.value || null;
}

// ── Sync Engine ────────────────────────────────────────────────────────────
let syncing = false;
let syncListeners = [];

export function onSyncProgress(fn) {
  syncListeners.push(fn);
  return () => { syncListeners = syncListeners.filter(l => l !== fn); };
}

function emitProgress(state) {
  syncListeners.forEach(fn => fn(state));
}

export async function runSync() {
  if (syncing || !navigator.onLine) return;
  syncing = true;

  const pending = await getPendingOps();
  if (pending.length === 0) { syncing = false; return; }

  emitProgress({ status: 'syncing', total: pending.length, done: 0 });

  const token = localStorage.getItem('kfms_token');
  let done = 0;
  let failed = 0;

  for (const op of pending) {
    try {
      const res = await fetch(`/api${op.path}`, {
        method: op.method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          'X-Offline-Sync': 'true',
          'X-Original-Timestamp': op.timestamp.toString(),
        },
        body: op.body ? JSON.stringify(op.body) : undefined,
      });

      if (res.ok || res.status === 409) {
        // 409 = conflict (already exists) — still mark as synced
        await markSynced(op.id);
        done++;
      } else {
        await markFailed(op.id, `HTTP ${res.status}`);
        failed++;
      }
    } catch (err) {
      await markFailed(op.id, err.message);
      failed++;
    }

    emitProgress({ status: 'syncing', total: pending.length, done, failed });
  }

  syncing = false;
  emitProgress({ status: 'complete', total: pending.length, done, failed });
  console.log(`[Sync] Complete: ${done} synced, ${failed} failed`);
}

// ── Network listener — auto trigger sync ─────────────────────────────────
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Sync] Network restored — starting sync…');
    setTimeout(runSync, 1500); // small delay for connection to stabilise
  });
  // Also try sync on page focus (catches cases where device sleeps/wakes)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && navigator.onLine) runSync();
  });
}

// ── Smart fetch — auto-queue when offline ─────────────────────────────────
export async function smartFetch(path, options = {}, meta = {}) {
  const token = localStorage.getItem('kfms_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  if (!navigator.onLine && options.method && options.method !== 'GET') {
    // Queue the write for later
    const body = options.body ? JSON.parse(options.body) : undefined;
    await queueOperation(options.method, path, body, meta);
    return { ok: true, offline: true, json: async () => ({ queued: true, offline: true }) };
  }

  try {
    const res = await fetch(`/api${path}`, { ...options, headers });
    return res;
  } catch (err) {
    if (options.method && options.method !== 'GET') {
      const body = options.body ? JSON.parse(options.body) : undefined;
      await queueOperation(options.method, path, body, meta);
      return { ok: true, offline: true, json: async () => ({ queued: true, offline: true }) };
    }
    throw err;
  }
}
