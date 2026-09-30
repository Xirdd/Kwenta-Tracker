// Web Share Target plumbing. When someone shares a screenshot/receipt/text to
// Kwenta from their phone's share sheet, the browser POSTs it to
// /share-target/. There's no server behind that URL — the service worker
// (sw.js) intercepts the POST, parks whatever was shared here in IndexedDB,
// and redirects into the app, which then picks it up (main.js) and opens the
// intake sheet. IndexedDB, not localStorage: it can hold an actual image
// file, where localStorage only holds small strings.
//
// This module is imported by BOTH the service worker and the page, so it
// must only use APIs available in both (no DOM, no window).

const DB_NAME = "kwenta-share";
const STORE = "pending";
const KEY = "latest"; // one slot: a new share replaces an unopened older one

const MAX_TEXT = 500;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putPendingShare(record) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record, KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

// Reads the pending share AND clears it in one transaction, so opening the
// app twice never shows the same shared item twice.
export async function takePendingShare() {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const getReq = store.get(KEY);
      let value = null;
      getReq.onsuccess = () => {
        value = getReq.result || null;
        if (value) store.delete(KEY);
      };
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const clean = (v) => (typeof v === "string" ? v.trim().slice(0, MAX_TEXT) : "");

// The service worker's answer to the share POST. Always ends in a redirect
// into the app — even if storing fails, the person lands in Kwenta rather
// than on a browser error page.
export async function handleShareRequest(request) {
  const home = new URL("/?shared=1", request.url).href;
  try {
    const form = await request.formData();
    const file = form.get("photo");
    const isImage =
      file &&
      typeof file === "object" &&
      typeof file.type === "string" &&
      file.type.startsWith("image/");
    const record = {
      title: clean(form.get("title")),
      text: clean(form.get("text")),
      url: clean(form.get("url")),
      file: isImage ? file : null,
      receivedAt: Date.now(),
    };
    if (record.title || record.text || record.url || record.file) {
      await putPendingShare(record);
    }
  } catch (e) {
    // swallow — fall through to the redirect
  }
  return Response.redirect(home, 303);
}
