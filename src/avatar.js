import { supabase } from "./supabaseClient.js";
import { getCurrentUser } from "./auth.js";

// Profile photos.
//
// Where the photo lives: a Supabase Storage bucket called "avatars" (created by
// supabase/migrations/20261011000000_avatars_bucket.sql). Only the photo's
// PATH — a short string — is saved on the account, in
// user_metadata.avatar_path. The image itself is never put in user_metadata:
// that object is copied into every sign-in token, and a base64 photo would
// bloat each request and eventually break sign-in.
//
// Privacy: the bucket serves files by public URL, and each upload gets a
// random file name (userId/<random-uuid>.jpg), so a photo's address can't be
// guessed — but anyone who is given the exact URL can open it. Only the owner
// can upload, replace or delete files in their own folder (storage policies in
// the migration, which also require a finished 2FA challenge when 2FA is on).
//
// Every upload is center-cropped to a 256×256 JPEG in the browser first, so a
// 12 MB camera photo becomes roughly 15–30 KB.

const BUCKET = "avatars";
const SIZE = 256;
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const PATH_RE = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/i;

// Right after an upload/removal the signed-in user object (auth.js) still holds
// the OLD metadata until Supabase's next auth event, so the new path is
// remembered here and wins for that user.
let override = null; // { userId, path|null }

function currentPath() {
  const user = getCurrentUser();
  if (!user) return null;
  const path =
    override && override.userId === user.id
      ? override.path
      : user.user_metadata?.avatar_path;
  // The path comes from account metadata, so it's validated before it's ever
  // used to build a URL.
  return typeof path === "string" && PATH_RE.test(path) ? path : null;
}

export function hasAvatar() {
  return !!currentPath();
}

export function getAvatarUrl() {
  const path = currentPath();
  if (!path || !supabase) return null;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || null;
}

// If a photo can't be loaded (offline, file gone), drop the <img> so the
// initial underneath shows instead of a broken-image icon. Content-Security-
// Policy forbids inline onerror="" handlers, so this is wired up in code
// after each render (main.js calls it from attachEvents).
export function wireAvatarFallbacks() {
  document.querySelectorAll("img[data-avatar]").forEach((img) => {
    if (img.dataset.wired) return;
    img.dataset.wired = "1";
    img.addEventListener("error", () => img.remove());
  });
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch (e) {
      try {
        return await createImageBitmap(file);
      } catch (e2) {
        /* fall through to <img> */
      }
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image."));
    };
    img.src = url;
  });
}

async function toSquareJpeg(file) {
  const src = await loadBitmap(file);
  const w = src.width;
  const h = src.height;
  const side = Math.min(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1a1a1a"; // JPEG has no transparency
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    src,
    (w - side) / 2,
    (h - side) / 2,
    side,
    side,
    0,
    0,
    SIZE,
    SIZE,
  );
  if (typeof src.close === "function") src.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Couldn't process that image.")),
      "image/jpeg",
      0.86,
    );
  });
}

function requireReady() {
  if (!supabase) throw new Error("Supabase is not configured.");
  const user = getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  return user;
}

// Turns Supabase's raw storage errors into something a person can act on.
function friendly(error) {
  const msg = String(error?.message || "");
  if (/bucket not found/i.test(msg))
    return new Error(
      "Photo uploads aren't set up yet — the avatars storage bucket is missing. Run the latest database migration (npm run db:push).",
    );
  if (/row-level security|not authorized|unauthorized/i.test(msg))
    return new Error(
      "You're not allowed to upload right now. If you use 2FA, finish the code prompt and try again.",
    );
  return error instanceof Error ? error : new Error(msg || "Upload failed.");
}

export async function uploadAvatar(file) {
  const user = requireReady();
  if (!file || !String(file.type).startsWith("image/"))
    throw new Error("Choose an image file.");
  if (file.size > MAX_INPUT_BYTES)
    throw new Error("That image is too large — pick one under 20 MB.");

  const blob = await toSquareJpeg(file);
  const oldPath = currentPath();
  const path = `${user.id}/${crypto.randomUUID()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, {
      contentType: "image/jpeg",
      cacheControl: "31536000", // random names never change, so cache for a year
      upsert: false,
    });
  if (uploadError) throw friendly(uploadError);

  const { error: metaError } = await supabase.auth.updateUser({
    data: { avatar_path: path },
  });
  if (metaError) {
    await supabase.storage.from(BUCKET).remove([path]); // don't leave an orphan
    throw friendly(metaError);
  }

  override = { userId: user.id, path };
  if (oldPath) supabase.storage.from(BUCKET).remove([oldPath]); // best effort
}

export async function removeAvatar() {
  const user = requireReady();
  const oldPath = currentPath();
  const { error } = await supabase.auth.updateUser({
    data: { avatar_path: null },
  });
  if (error) throw friendly(error);
  override = { userId: user.id, path: null };
  if (oldPath) supabase.storage.from(BUCKET).remove([oldPath]); // best effort
}
