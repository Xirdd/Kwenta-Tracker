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
// bare console.error, so a failed save is never silent — without this,
// someone offline could add an expense, watch the sheet close normally, and
// have no idea it only exists on this device.
export function notifySyncError(e) {
  console.error("Cloud sync failed", e);
  showToast(
    "Couldn't sync to the cloud — this change is only saved on this device right now.",
  );
}
