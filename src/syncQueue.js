// Retry queue for cloud writes that failed. sync.js wraps EVERY write
// (transactions, salary, budgets, recurring, bills, goals, loans) with
// withRetry(), which registers a replayable executor here and enqueues the
// call on a transient failure. budgetLimitsCloud.js and
// customCategoriesCloud.js register their own kinds the same way.

const QUEUE_KEY = "kwenta_sync_queue_v1";
const FLUSH_INTERVAL_MS = 30000;

const registry = {}; // kind (string) -> the actual async function to retry
let flushing = false;
let intervalHandle = null;

function loadQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (e) {
    /* localStorage full or unavailable — nothing more we can do here */
  }
}

// True for failures worth retrying (no connection, timeouts, 429, 5xx).
// PostgREST errors that carry a `code` (RLS denial 42501, constraint
// violations 23xxx, bad request…) are permanent: retrying can never fix them.
export function isTransientError(e) {
  if (!e) return false;
  const status = Number(e.status) || 0;
  if (status === 408 || status === 429 || status >= 500) return true;
  const msg = String(e.message || e).toLowerCase();
  if (
    /failed to fetch|networkerror|network request failed|load failed|timeout|timed out/.test(
      msg,
    )
  )
    return true;
  return !e.code; // no Postgres/PostgREST code at all => never reached the DB
}

export function registerRetryable(kind, fn) {
  registry[kind] = fn;
}

export function enqueueRetry(kind, args) {
  const queue = loadQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    kind,
    args,
    queuedAt: new Date().toISOString(),
  });
  saveQueue(queue);
}

export function pendingSyncCount() {
  return loadQueue().length;
}

// Wipes every queued write. Call on logout (so one person's unsynced edits
// can never be replayed into the next person's session) and after a
// successful backup restore (so stale pre-restore edits don't re-appear).
export function clearSyncQueue() {
  try {
    localStorage.removeItem(QUEUE_KEY);
  } catch (e) {
    /* ignore */
  }
}

// Replays queued jobs in order, once. Succeeded jobs are removed; transient
// failures stay queued; permanent failures are dropped (logged). Jobs that
// were enqueued WHILE this ran are preserved — the old version overwrote the
// queue at the end and silently lost them.
export async function flushSyncQueue() {
  if (flushing) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const queue = loadQueue();
  if (queue.length === 0) return;

  flushing = true;
  try {
    const stillPending = [];
    for (const job of queue) {
      const fn = registry[job.kind];
      if (!fn) continue; // unknown/renamed kind — drop it
      try {
        await fn(...job.args);
      } catch (e) {
        if (isTransientError(e)) stillPending.push(job);
        else console.error("Dropping unrecoverable queued write", job.kind, e);
      }
    }
    const processed = new Set(queue.map((j) => j.id));
    const added = loadQueue().filter((j) => !processed.has(j.id));
    saveQueue([...stillPending, ...added]);
  } finally {
    flushing = false;
  }
}

export function initSyncQueue() {
  window.addEventListener("online", flushSyncQueue);
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = setInterval(flushSyncQueue, FLUSH_INTERVAL_MS);
  flushSyncQueue();
}
