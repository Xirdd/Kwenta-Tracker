let hideTimer = null;

export function showToast(message, { duration = 4200 } = {}) {
  let el = document.getElementById("toastBanner");
  if (!el) {
    el = document.createElement("div");
    el.id = "toastBanner";
    el.className = "toast-banner";
    document.body.appendChild(el);
  }
  el.textContent = message;
  // Force a reflow so re-triggering the animation works even if a toast is already showing.
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => el.classList.remove("show"), duration);
}

// Every cloud write in the app funnels its failure through here instead of a
// bare console.error, so a failed save is never silent. As of syncQueue.js,
// the write is also automatically queued for retry (see sync.js's
// withRetryQueue) — it'll go through on its own once the connection is back,
// or every 30s while online in case Supabase itself was the problem rather
// than the device's network. This toast is just letting the person know it
// didn't go through *yet*, not asking them to do anything about it.
export function notifySyncError(e) {
  console.error("Cloud sync failed", e);
  showToast(
    "Couldn't sync to the cloud — saved on this device, and we'll retry automatically once you're back online.",
  );
}
