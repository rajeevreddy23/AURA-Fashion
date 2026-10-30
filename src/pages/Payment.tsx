import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, money, orderResult, readImage } from "../services/api";
import { auth } from "../firebase";
import { blankDesign, designSchema } from "../../shared/studio";
import { pngImage } from "../components/DesignArt";
export default function Payment() {
  const [params] = useSearchParams();
  const id = params.get("order") || sessionStorage.getItem("aura-last-order");
  const [order, setOrder] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [result, setResult] = useState("");
  const [sketch, setSketch] = useState("");
  const [classic] = useState<any>(() => {
    try {
      return JSON.parse(
        sessionStorage.getItem(
          "aura-classic-render:" + auth.currentUser?.uid,
        ) || "null",
      );
    } catch {
      return null;
    }
  });
  const refresh = async () => {
    if (!id || !auth.currentUser) return;
    try {
      setOrder(await api(`/orders/${id}`));
    } catch (e: any) {
      setMessage(e.message);
    }
  };
  useEffect(() => {
    refresh();
    if (!auth.currentUser) return;
    const timer = setInterval(refresh, 4000);
    const stop = setTimeout(() => clearInterval(timer), 120000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [id]);
  useEffect(() => {
    if (order?.resultAvailable)
      orderResult(order.id)
        .then(setResult)
        .catch((e) => setMessage(e.message));
  }, [order?.resultAvailable]);
  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result);
    },
    [result],
  );
  const run = async () => {
    if (!order) return;
    setBusy(true);
    setMessage("");
    try {
      const key = `aura-design-v1:${auth.currentUser?.uid || "guest"}`;
      let sketchImage = sketch || classic?.image;
      if (!sketchImage) {
        const saved = localStorage.getItem(key);
        if (!saved)
          throw new Error(
            "Save a design in Studio or upload an exported sketch first.",
          );
        sketchImage = await pngImage(designSchema.parse(JSON.parse(saved)));
      }
      await api(`/orders/${order.id}/run`, {
        sketchImage,
        instructions: instructions || classic?.instructions || "",
        consent,
      });
      await refresh();
    } catch (e: any) {
      setMessage(e.message);
      refresh();
    } finally {
      setBusy(false);
    }
  };
  const refund = async () => {
    setBusy(true);
    try {
      await api(`/orders/${id}/refund`, {});
      setMessage(
        "Refund submitted. Your payment provider determines when it appears on your statement.",
      );
      await refresh();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="narrow-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR PAYMENT</p>
          <h2>One payment. One clear status.</h2>
        </div>
      </div>
      {message && (
        <p className="notice" role="alert">
          {message}
        </p>
      )}
      {!auth.currentUser ? (
        <p className="notice">
          <Link to="/login" state={{ returnTo: `/payment?order=${id || ""}` }}>
            Log in
          </Link>{" "}
          to view this order.
        </p>
      ) : !id ? (
        <p>
          No order selected. <Link to="/shopping">Browse the Shop</Link>.
        </p>
      ) : (
        <section className="panel">
          <p className="muted order-reference">Reference: {id}</p>
          <p role="status">
            Status: <strong>{order?.status || "Checking…"}</strong>
          </p>
          {order && (
            <p>
              Paid service: {order.kind} · {money(order.amount)}
            </p>
          )}
          <button className="secondary" onClick={refresh} disabled={busy}>
            Refresh status
          </button>
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api(`/orders/${id}/reconcile`, {});
                await refresh();
              } catch (e: any) {
                setMessage(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Recheck payment or recover stalled job
          </button>
          {order?.status === "pending" && (
            <p className="notice">
              Payment has not been verified. A return from checkout does not
              activate access. If you paid, allow a moment for verification;
              keep this order reference.
            </p>
          )}
          {order?.status === "paid" && order.kind === "tryon" && (
            <Link
              className="primary"
              to={`/tryon?product=${order.productId}&order=${order.id}`}
            >
              Continue to your paid try-on
            </Link>
          )}
          {order?.status === "paid" &&
            ["publish", "pass"].includes(order.kind) && (
              <>
                <p className="notice">
                  Payment verified. Your publishing entitlement is available.
                </p>
                <Link className="primary" to="/sketch">
                  Return to Studio to publish
                </Link>
              </>
            )}
          {order?.status === "paid" && order.kind === "render" && (
            <div className="form-stack">
              <p>
                {classic
                  ? "This renders your saved classic sketch on this device."
                  : "This renders the latest design saved in Studio for your account on this device."}
              </p>
              <Link className="text-link" to="/sketch">
                Review the saved design first
              </Link>
              <label className="field">
                Or upload an exported sketch
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      try {
                        setSketch(await readImage(f));
                      } catch (e: any) {
                        setMessage(e.message);
                      }
                  }}
                />
              </label>
              {sketch && (
                <img
                  src={sketch}
                  alt="Selected sketch to render"
                  style={{ maxHeight: 260, objectFit: "contain" }}
                />
              )}
              <label className="field">
                Optional design instructions
                <textarea
                  maxLength={1000}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Send my design to the AI image provider for this render.
              </label>
              <button
                className="primary"
                disabled={!consent || busy}
                onClick={run}
              >
                {busy ? "Rendering…" : "Use this payment to render"}
              </button>
            </div>
          )}
          {order?.status === "running" && (
            <p className="notice">
              Your image is processing. Keep this reference and refresh the
              status. Do not pay again. After 20 minutes you can recover a
              stalled job as a refund. Contact support with this reference if
              needed.
            </p>
          )}
          {order?.status === "refund_pending" && (
            <p className="notice">
              A refund needs completion. Use Retry refund or contact support
              with this reference.
            </p>
          )}
          {order &&
            ["paid", "refund_pending"].includes(order.status) &&
            ["tryon", "render"].includes(order.kind) && (
              <button className="secondary" disabled={busy} onClick={refund}>
                {order.status === "refund_pending"
                  ? "Retry refund"
                  : "Refund unused payment"}
              </button>
            )}
          {order?.status === "refunded" && (
            <p className="notice">
              The refund has been submitted. No generation credit remains on
              this order.
            </p>
          )}
          {result && (
            <div className="result-view">
              <img src={result} alt="AI generated fashion concept" />
              <a className="primary" href={result} download="aura-render.png">
                Download result
              </a>
              <button
                className="secondary"
                onClick={async () => {
                  try {
                    await api(`/orders/${id}/result`, undefined, "DELETE");
                    setResult("");
                    await refresh();
                  } catch (e: any) {
                    setMessage(e.message);
                  }
                }}
              >
                Delete saved result
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
