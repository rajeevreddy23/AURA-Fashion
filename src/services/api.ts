import { useEffect, useState } from "react";
import { auth } from "../firebase";

export async function api<T = any>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response
    .json()
    .catch(() => ({ error: "The service could not be reached." }));
  if (!response.ok) throw new Error(data.error || "The request failed.");
  return data;
}
export async function checkout(
  kind: "tryon" | "render" | "publish" | "pass",
  productId?: string,
) {
  if (!auth.currentUser) throw new Error("Please log in before paying.");
  const data = await api("/checkout", { kind, productId });
  const u = new URL(data.url);
  if (u.protocol !== "https:" || u.hostname !== "checkout.stripe.com")
    throw new Error("Invalid payment link.");
  sessionStorage.setItem("aura-last-order", data.orderId);
  window.location.assign(data.url);
}
export const money = (paise?: number | null) =>
  paise == null
    ? "Price pending setup"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(paise / 100);
export type Configuration = {
  paymentsReady: boolean;
  tryOnReady: boolean;
  publishingReady: boolean;
  communityReady: boolean;
  tryOnPrice: number | null;
  publishPrice: number | null;
  passPrice: number | null;
};
export function useConfiguration() {
  const [config, setConfig] = useState<Configuration>({
    paymentsReady: false,
    tryOnReady: false,
    publishingReady: false,
    communityReady: false,
    tryOnPrice: null,
    publishPrice: null,
    passPrice: null,
  });
  useEffect(() => {
    let alive = true;
    api<Configuration>("/config")
      .then((c) => {
        if (alive) setConfig(c);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return config;
}
export async function readImage(file: File, maxBytes = 3 * 1024 * 1024) {
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > maxBytes
  )
    throw new Error("Choose a PNG, JPEG or WebP smaller than 3 MB.");
  const data = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error("Could not read that file."));
    r.readAsDataURL(file);
  });
  const img = new Image();
  img.src = data;
  await img.decode().catch(() => {
    throw new Error("This image could not be opened.");
  });
  if (img.width * img.height > 25000000)
    throw new Error("Choose an image smaller than 25 megapixels.");
  return data;
}
export async function orderResult(id: string) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch(`/api/orders/${id}/result`, {
    headers: { Authorization: `Bearer ${token || ""}` },
  });
  if (!response.ok) throw new Error("The result is unavailable or expired.");
  return URL.createObjectURL(await response.blob());
}
