import { z } from "zod";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
export function requireCondition(
  value: unknown,
  status: number,
  message: string,
): asserts value {
  if (!value) throw new ApiError(status, message);
}
export function integerEnv(env: NodeJS.ProcessEnv, key: string, fallback = 0) {
  const n = Number(env[key] ?? fallback);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}
export function pricing(env: NodeJS.ProcessEnv) {
  const tryon = integerEnv(env, "TRYON_PRICE_PAISE");
  const provider = integerEnv(env, "PROVIDER_MAX_COST_PAISE");
  const overhead = integerEnv(env, "JOB_OVERHEAD_PAISE");
  const feeBps = integerEnv(env, "PAYMENT_FEE_BPS", 400);
  const taxBps = integerEnv(env, "TAX_RESERVE_BPS", 1800);
  const margin = integerEnv(env, "MIN_MARGIN_PAISE", 100);
  const reserve = Math.ceil((tryon * (feeBps + taxBps)) / 10000);
  const safe =
    tryon > 0 &&
    provider > 0 &&
    feeBps + taxBps < 10000 &&
    tryon - reserve >= provider + overhead + margin;
  return {
    tryon,
    provider,
    overhead,
    safe,
    publish: integerEnv(env, "PUBLISH_PRICE_PAISE"),
    membership: integerEnv(env, "PUBLISH_PASS_PRICE_PAISE"),
    dailyBudget: integerEnv(env, "DAILY_AI_BUDGET_PAISE"),
    perUser: integerEnv(env, "MAX_USER_DAILY_JOBS", 5),
  };
}
export const eligibleCategories = new Set([
  "shirts",
  "tshirts",
  "pants",
  "blazzers",
  "blazers",
  "suits",
  "jackets",
  "hoodies",
  "coats",
  "saries",
  "sarees",
  "lehangas",
  "punjabhi dress",
  "dresses",
]);
export function eligible(product: any) {
  // Category support is necessary; uploaded catalog records must also be explicitly approved.
  return (
    eligibleCategories.has(product.category) && product.tryOnEnabled === true
  );
}
export function parseImage(value: unknown, maxBytes = 3 * 1024 * 1024) {
  requireCondition(
    typeof value === "string",
    400,
    "Choose a PNG, JPEG or WebP image.",
  );
  const match =
    /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  requireCondition(match, 400, "Choose a PNG, JPEG or WebP image.");
  const buffer = Buffer.from(match[2], "base64");
  requireCondition(
    buffer.length > 12 && buffer.length <= maxBytes,
    400,
    "Image is empty or too large.",
  );
  const signature =
    match[1] === "png"
      ? buffer
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : match[1] === "jpeg"
        ? buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255
        : buffer.toString("ascii", 0, 4) === "RIFF" &&
          buffer.toString("ascii", 8, 12) === "WEBP";
  requireCondition(
    signature,
    400,
    "Image content does not match its file type.",
  );
  return { mimeType: `image/${match[1]}`, data: match[2], buffer };
}
export function paidSessionMatches(session: any, order: any) {
  return (
    session.payment_status === "paid" &&
    session.mode === "payment" &&
    session.amount_total === order.amount &&
    session.currency === "inr" &&
    session.metadata?.orderId === order.id &&
    session.metadata?.uid === order.uid &&
    session.id === order.checkoutId
  );
}
