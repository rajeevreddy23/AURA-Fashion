import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, checkout, money, useConfiguration } from "../services/api";
import { auth } from "../firebase";
export default function Subscription() {
  const config = useConfiguration();
  const [ent, setEnt] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (auth.currentUser)
      api("/me")
        .then(setEnt)
        .catch((e) => setError(e.message));
  }, []);
  const buy = async (kind: "publish" | "pass") => {
    setBusy(true);
    setError("");
    try {
      await checkout(kind);
    } catch (e: any) {
      setError(e.message);
      setBusy(false);
    }
  };
  return (
    <div className="narrow-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MAKE. SHARE. WEAR.</p>
          <h2>Create freely. Publish when ready.</h2>
          <p className="muted">
            Studio tools, 3D concepts and downloads are free. Each AI try-on is
            a separate purchase.
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="notice">
          {error}
        </p>
      )}
      {ent && (
        <p className="notice">
          Your account: {ent.publishCredits} publication credits.{" "}
          {ent.pass
            ? `${ent.pass.remaining} pass uploads remaining until ${new Date(ent.pass.expiresAt).toLocaleDateString()}.`
            : "No active publishing pass."}
        </p>
      )}
      <div className="plan-grid">
        <section className="panel">
          <p className="eyebrow">OCCASIONAL CREATOR</p>
          <h3>One publication</h3>
          <p className="plan-price">{money(config.publishPrice)}</p>
          <p>
            Publish one original design to the community Shop. One credit is
            consumed per upload.
          </p>
          <button
            className="primary"
            disabled={busy || !config.publishingReady}
            onClick={() => buy("publish")}
          >
            Buy one upload
          </button>
        </section>
        <section className="panel featured-plan">
          <p className="eyebrow">REGULAR CREATOR</p>
          <h3>30-day publishing pass</h3>
          <p className="plan-price">{money(config.passPrice)}</p>
          <p>
            Up to 30 design uploads over 30 days. Unused uploads expire. No
            automatic renewal.
          </p>
          <button
            className="primary"
            disabled={busy || !config.publishingReady || !!ent?.pass}
            onClick={() => buy("pass")}
          >
            Buy publishing pass
          </button>
        </section>
      </div>
      {!config.publishingReady && (
        <p className="notice">
          Payments and publishing are awaiting configuration. No plan can be
          activated without verified payment.
        </p>
      )}
      <section className="panel">
        <h3>Try before you commission</h3>
        <p>
          Eligible Shop products show a separate try-on price. One payment
          covers one generation attempt. Failed generations request a refund;
          pending refunds remain visible on your order.
        </p>
        <p>
          AI pictures are visual concepts and cannot guarantee fabric, size or
          fit.
        </p>
        <Link className="text-link" to="/shopping">
          Explore the Shop →
        </Link>
      </section>
    </div>
  );
}
