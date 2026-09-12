// A small retry queue for cloud writes that failed — the gap the README's
// "Polish pass: sync failures are surfaced, not silent" section explicitly
// called out as NOT yet built: "No retry queue yet (that's a bigger feature
// — tracking failed writes and re-attempting on reconnect)."
//
// Design goal: don't touch the 25 existing call sites in sheet.js,
// budgets.js, income.js, loans.js, recurring.js, bills.js, and goals.js.
// Every cloud mutation already funnels through a small set of named
// functions in sync.js (cloudUpsertTransaction, cloudUpsertBudget, etc.), so
// this wraps *those* instead — one registration point per function, rather
// than 25 call-site changes.

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

// Called once per retryable function, at module load time in sync.js —
// maps a short string ("kind") to the real function, so queued jobs (which
// are just plain JSON: { kind, args }) can be replayed later without
// needing to serialize an actual function reference (impossible anyway).
export function registerRetryable(kind, fn) {
  registry[kind] = fn;
}

// Called by sync.js whenever a registered function's cloud call fails.
// `args` must be JSON-serializable (every current cloud function's
// arguments already are: strings, numbers, and plain data objects).
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

// Attempts every queued job once. Jobs that succeed are removed; jobs that
// fail again stay queued for the next flush. Guarded against overlapping
// runs (e.g. the 'online' event and the interval firing at the same time).
export async function flushSyncQueue() {
  if (flushing) return;
  const queue = loadQueue();
  if (queue.length === 0) return;

  flushing = true;
  try {
    const stillPending = [];
    for (const job of queue) {
      const fn = registry[job.kind];
      if (!fn) {
        // Unknown kind — e.g. an older queued job from before a rename.
        // Drop it rather than let it sit forever with nothing able to run it.
        continue;
      }
      try {
        await fn(...job.args);
      } catch (e) {
        stillPending.push(job);
      }
    }
    saveQueue(stillPending);
  } finally {
    flushing = false;
  }
}

// Call once on app startup. Retries automatically when the browser regains
// connectivity, and every 30s while online regardless — the 'online' event
// only fires for the device's own network coming back, but Supabase itself
// being briefly unreachable wouldn't trigger it, so the interval catches
// that case too.
export function initSyncQueue() {
  window.addEventListener("online", flushSyncQueue);
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = setInterval(flushSyncQueue, FLUSH_INTERVAL_MS);
  flushSyncQueue(); // in case jobs were queued in a previous session
}
