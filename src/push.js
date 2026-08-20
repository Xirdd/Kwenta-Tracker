import { supabase } from "./supabaseClient.js";
import { getCurrentUser } from "./auth.js";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Web Push wants the VAPID key as a Uint8Array, but it's distributed as a
// base64url string — this is the standard conversion for that.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// Distinguishes *why* push might not work, rather than lumping every cause
// into one generic "not supported" — a missing VITE_VAPID_PUBLIC_KEY looks
// identical to genuinely unsupported iOS Safari otherwise, and those need
// completely different fixes (one's a code/config issue, the other is a
// real platform limitation with no workaround).
//
// 'ok' | 'no-service-worker' | 'no-vapid-key' | 'no-push-api'
export function pushCapability() {
  if (!("serviceWorker" in navigator)) return "no-service-worker";
  if (!VAPID_PUBLIC_KEY) return "no-vapid-key";
  if (!("PushManager" in window)) return "no-push-api";
  return "ok";
}

export function pushSupported() {
  return pushCapability() === "ok";
}

// 'default' (not asked yet) | 'granted' | 'denied' | 'unsupported'
export function pushPermissionState() {
  if (!pushSupported()) return "unsupported";
  return Notification.permission;
}

export async function isPushSubscribed() {
  if (!pushSupported()) return false;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  return !!sub;
}

export async function enablePush() {
  if (!pushSupported())
    throw new Error("Push notifications are not supported in this browser.");
  if (!supabase) throw new Error("Supabase is not configured.");
  const user = getCurrentUser();
  if (!user) throw new Error("Sign in first to enable notifications.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("Notification permission was not granted.");

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const { error } = await supabase.from("kwenta_push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth_key: json.keys.auth,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw error;
}

export async function disablePush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;

  if (supabase) {
    await supabase
      .from("kwenta_push_subscriptions")
      .delete()
      .eq("endpoint", sub.endpoint);
  }
  await sub.unsubscribe();
}
