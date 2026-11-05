const key = "aura-tryon-handoff-v1";
const lifetime = 30 * 60 * 1000;
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function clearTryOnPhoto(storage: StorageLike) {
  try {
    storage.removeItem(key);
  } catch {}
}
export function rememberTryOnPhoto(
  storage: StorageLike,
  uid: string,
  productId: string,
  photo: string,
  now = Date.now(),
) {
  if (
    !uid ||
    !productId ||
    photo.length > 4300000 ||
    !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo)
  )
    throw new Error("Choose a valid photo before continuing.");
  storage.setItem(
    key,
    JSON.stringify({ uid, productId, photo, expiresAt: now + lifetime }),
  );
}
export function restoreTryOnPhoto(
  storage: StorageLike,
  uid: string,
  productId: string,
  now = Date.now(),
): string {
  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    if (
      value &&
      uid &&
      value.uid === uid &&
      value.productId === productId &&
      value.expiresAt > now &&
      value.expiresAt <= now + lifetime &&
      typeof value.photo === "string" &&
      value.photo.length <= 4300000 &&
      /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value.photo)
    )
      return value.photo;
    storage.removeItem(key);
  } catch {
    try {
      storage.removeItem(key);
    } catch {}
  }
  return "";
}
export function scopeTryOnPhotoToUser(
  storage: StorageLike,
  uid: string,
  now = Date.now(),
) {
  try {
    const value = JSON.parse(storage.getItem(key) || "null");
    if (!uid || typeof value?.productId !== "string") {
      clearTryOnPhoto(storage);
      return;
    }
    restoreTryOnPhoto(storage, uid, value.productId, now);
  } catch {
    clearTryOnPhoto(storage);
  }
}
