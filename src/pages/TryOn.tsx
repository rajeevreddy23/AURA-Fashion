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
import { catalogImage, missingCatalogImage } from "../services/catalogMedia";
import {
  clearTryOnPhoto,
  rememberTryOnPhoto,
  restoreTryOnPhoto,
} from "../services/tryOnHandoff";
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
    let restored = "";
    try {
      if (auth.currentUser)
        restored = restoreTryOnPhoto(
          sessionStorage,
          auth.currentUser?.uid || "",
          productId || "",
        );
    } catch {}
    setPhoto(restored);
    setConsent(Boolean(restored));
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
      if (!auth.currentUser)
        throw new Error("Log in before continuing to payment.");
      if (!photo || !consent)
        throw new Error(
          "Choose a photo and confirm permission before payment.",
        );
      rememberTryOnPhoto(
        sessionStorage,
        auth.currentUser.uid,
        product.id,
        photo,
      );
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
      setConsent(false);
      clearTryOnPhoto(sessionStorage);
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
      clearTryOnPhoto(sessionStorage);
      setPhoto("");
      await refresh();
    } catch (e: any) {
      setMessage(e.message);
      await refresh();
    } finally {
      try {
        clearTryOnPhoto(sessionStorage);
      } catch {}
      setBusy(false);
    }
  };
  return (
    <div className="narrow-page aura-tryon-page">
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
      <ol className="tryon-steps" aria-label="Try-on steps">
        <li aria-current={!orderId ? "step" : undefined}>
          <b>1</b> Upload photo
        </li>
        <li aria-current={orderId && !paid && !result ? "step" : undefined}>
          <b>2</b> Payment
        </li>
        <li aria-current={paid || result ? "step" : undefined}>
          <b>3</b> Your result
        </li>
      </ol>
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
              src={catalogImage(product)}
              onError={missingCatalogImage}
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
                <h3>Upload your photo</h3>
                <label className="image-upload">
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
                      Choose your photo
                      <br />
                      <small>
                        Clear front photo · PNG, JPEG or WebP · up to 3 MB
                      </small>
                    </span>
                  )}
                </label>
                {photo && (
                  <button
                    className="secondary"
                    onClick={() => {
                      setPhoto("");
                      setConsent(false);
                      clearTryOnPhoto(sessionStorage);
                    }}
                  >
                    Remove photo
                  </button>
                )}
                <div className="photo-tip-row">
                  <span>Good lighting</span>
                  <span>Front pose</span>
                  <span>Clear image</span>
                </div>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  I have permission to use this photo, consent to AI processing,
                  and allow a temporary copy in this browser tab to continue
                  after payment.
                </label>
                <p className="muted">
                  The temporary copy expires for reuse after 30 minutes and is
                  cleared after generation or removal. It is not uploaded to the
                  app’s database. Provider retention follows its terms.
                </p>
                <h3>Continue to payment</h3>
                <p className="plan-price">{money(config.tryOnPrice)}</p>
                <p>
                  Your photo will be ready when you return. Failed generations
                  request a refund. You can refund an unused paid try-on.
                </p>
                <button
                  className="primary"
                  disabled={
                    busy ||
                    !config.tryOnReady ||
                    !product.tryOnEnabled ||
                    !photo ||
                    !consent ||
                    !auth.currentUser
                  }
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
                      clearTryOnPhoto(sessionStorage);
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
            {busy && paid && (
              <div className="tryon-processing" role="status">
                <span className="processing-ring" />
                Generating your try-on…
                <small>
                  The result will appear when the provider responds.
                </small>
              </div>
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
