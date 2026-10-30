import React, { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  api,
  checkout,
  money,
  orderResult,
  readImage,
  useConfiguration,
} from "../services/api";
import { auth } from "../firebase";
export default function TryOn() {
  const [params] = useSearchParams();
  const location = useLocation();
  const productId = params.get("product") || location.state?.product?.id;
  const orderId = params.get("order");
  const config = useConfiguration();
  const [product, setProduct] = useState<any>(null);
  const [order, setOrder] = useState<any>(null);
  const [photo, setPhoto] = useState("");
  const [result, setResult] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = async () => {
    if (orderId && auth.currentUser)
      try {
        const o = await api(`/orders/${orderId}`);
        setOrder(o);
      } catch (e: any) {
        setMessage(e.message);
      }
  };
  useEffect(() => {
    setProduct(null);
    setResult("");
    setPhoto("");
    setConsent(false);
    if (productId)
      api(`/products/${productId}`)
        .then(setProduct)
        .catch((e) => setMessage(e.message));
    refresh();
  }, [productId, orderId]);
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
  const paid =
    order?.status === "paid" &&
    order?.kind === "tryon" &&
    order?.productId === product?.id;
  const buy = async () => {
    setBusy(true);
    try {
      await checkout("tryon", product.id);
    } catch (e: any) {
      setMessage(e.message);
      setBusy(false);
    }
  };
  const file = async (f?: File) => {
    if (!f) return;
    try {
      setPhoto(await readImage(f));
      setMessage("");
    } catch (e: any) {
      setMessage(e.message);
    }
  };
  const run = async () => {
    setBusy(true);
    setMessage("");
    try {
      await api(`/orders/${order.id}/run`, { userImage: photo, consent });
      setPhoto("");
      await refresh();
    } catch (e: any) {
      setMessage(e.message);
      await refresh();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="narrow-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">A NEW WAY TO IMAGINE</p>
          <h2>Your look, reimagined.</h2>
          <p className="muted">
            One separate payment per try-on. A visual concept, not a size or fit
            guarantee.
          </p>
        </div>
      </div>
      {message && (
        <p className="notice" role="alert">
          {message}
        </p>
      )}
      {!productId ? (
        <section className="panel empty-state">
          <h3>Choose a garment first</h3>
          <p>
            Every eligible Shop product shows its own try-on action and price.
          </p>
          <Link className="primary" to="/shopping">
            Explore the Shop
          </Link>
        </section>
      ) : !product ? (
        <p role="status">Loading garment…</p>
      ) : (
        <div className="tryon-grid">
          <section className="panel">
            <img
              className="tryon-garment"
              src={product.image}
              alt={product.name}
            />
            <h3>{product.name}</h3>
            <p className="muted">Your payment applies only to this product.</p>
            <Link className="text-link" to={`/boutique?product=${product.id}`}>
              Ask a boutique to make it →
            </Link>
          </section>
          <section className="panel form-stack">
            {!orderId ? (
              <>
                <h3>1. Pay for one try-on</h3>
                <p className="plan-price">{money(config.tryOnPrice)}</p>
                <p>
                  You’ll choose your photo after payment. Failed generations
                  request a refund. You can refund an unused paid try-on.
                </p>
                <button
                  className="primary"
                  disabled={busy || !config.tryOnReady || !product.tryOnEnabled}
                  onClick={buy}
                >
                  {busy
                    ? "Opening checkout…"
                    : `Pay ${money(config.tryOnPrice)} for one try-on`}
                </button>
                {(!config.tryOnReady || !product.tryOnEnabled) && (
                  <p className="notice">
                    Try-on is not available for this garment yet. Payments, cost
                    limits and product approval must be configured first.
                  </p>
                )}
                {!auth.currentUser && (
                  <Link className="text-link" to="/login">
                    Log in to pay
                  </Link>
                )}
              </>
            ) : paid ? (
              <>
                <h3>2. Choose your photo</h3>
                <label
                  className="image-upload"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    file(e.dataTransfer.files[0]);
                  }}
                >
                  <input
                    aria-label="Your try-on photo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      file(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  {photo ? (
                    <img src={photo} alt="Your selected photo" />
                  ) : (
                    <span>
                      Choose a photo or drop it here
                      <br />
                      PNG, JPEG or WebP · up to 3 MB
                    </span>
                  )}
                </label>
                {photo && (
                  <button
                    className="secondary"
                    onClick={() => {
                      setPhoto("");
                      setConsent(false);
                    }}
                  >
                    Remove photo
                  </button>
                )}
                <label className="check">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  I have permission to use this photo and consent to sending it
                  to the AI provider for this try-on.
                </label>
                <p className="muted">
                  The app does not save your input photo to its database or
                  storage. Provider retention follows its terms. Results are
                  available for 7 days and can be deleted earlier.
                </p>
                <button
                  className="primary"
                  disabled={busy || !photo || !consent}
                  onClick={run}
                >
                  {busy
                    ? "Generating your image…"
                    : "3. Generate using this payment"}
                </button>
              </>
            ) : (
              <p className="notice">
                Order status: {order?.status || "Checking…"}. Open your order to
                refresh its status or manage a refund.
              </p>
            )}
            {orderId && (
              <Link className="secondary" to={`/payment?order=${orderId}`}>
                View order and refund status
              </Link>
            )}
            {result && (
              <div className="result-view">
                <img src={result} alt="AI generated virtual try-on" />
                <a className="primary" href={result} download="aura-tryon.png">
                  Download result
                </a>
                <Link className="secondary" to={`/tryon?product=${product.id}`}>
                  Buy another try-on
                </Link>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
