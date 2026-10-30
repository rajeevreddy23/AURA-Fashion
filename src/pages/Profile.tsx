import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, addDoc, getDocs, query, where } from "firebase/firestore";
import { auth } from "../firebase";
import { db } from "../database";
import { api, money } from "../services/api";
export default function Profile() {
  const user = auth.currentUser;
  const [admin, setAdmin] = useState(false);
  const [ent, setEnt] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const refreshMessages = async () => {
    if (!user) return;
    const snap = await getDocs(
      query(collection(db, "supportMessages"), where("userId", "==", user.uid)),
    );
    setMessages(
      snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt)),
    );
  };
  useEffect(() => {
    if (!user) return;
    user.getIdTokenResult().then((t) => setAdmin(t.claims.admin === true));
    api("/me")
      .then(setEnt)
      .catch((e) => setStatus(e.message));
    api<any[]>("/orders")
      .then(setOrders)
      .catch((e) => setStatus(e.message));
    refreshMessages().catch(() => {});
  }, [user]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    try {
      await addDoc(collection(db, "supportMessages"), {
        userId: user.uid,
        email: user.email,
        subject,
        message,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
      setStatus(
        "Support request saved. Keep your order reference if this concerns a payment.",
      );
      setSubject("");
      setMessage("");
      await refreshMessages();
    } catch {
      setStatus("The support request could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  if (!user)
    return (
      <section className="panel empty-state">
        <h2>Your AURA account</h2>
        <p>Log in to view payments, publishing access and support requests.</p>
        <Link className="primary" to="/login">
          Log in
        </Link>
      </section>
    );
  return (
    <div className="narrow-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">YOUR CREATIVE SPACE</p>
          <h2>{user.displayName || "Your account"}</h2>
          <p className="muted">{user.email}</p>
        </div>
        {admin && (
          <Link className="secondary" to="/admin">
            Catalog administration
          </Link>
        )}
      </div>
      {status && (
        <p role="status" className="notice">
          {status}
        </p>
      )}
      <section className="panel">
        <h3>Publishing access</h3>
        {ent ? (
          <p>
            {ent.publishCredits} publication credits.{" "}
            {ent.pass
              ? `${ent.pass.remaining} pass uploads remaining, expires ${new Date(ent.pass.expiresAt).toLocaleDateString()}.`
              : "No active publishing pass."}
          </p>
        ) : (
          <p className="muted">Access details are unavailable.</p>
        )}
        <Link className="text-link" to="/subscription">
          Manage publishing access
        </Link>
        <p className="muted">Each AI try-on is purchased separately.</p>
      </section>
      <section className="panel">
        <h3>Payment history</h3>
        {orders.length === 0 ? (
          <p className="muted">No paid service orders yet.</p>
        ) : (
          orders.map((o) => (
            <div className="order-row" key={o.id}>
              <div>
                <strong>
                  {o.kind} · {money(o.amount)}
                </strong>
                <p className="muted">
                  {o.status} · {new Date(o.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Link className="text-link" to={`/payment?order=${o.id}`}>
                View order
              </Link>
            </div>
          ))
        )}
      </section>
      <section className="panel">
        <h3>Contact support</h3>
        <form onSubmit={submit} className="form-stack">
          <label className="field">
            Subject
            <input
              required
              maxLength={120}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
          <label className="field">
            Message
            <textarea
              required
              maxLength={3000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Include the order reference for payment or image issues."
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : "Save support request"}
          </button>
        </form>
      </section>
      {messages.map((m) => (
        <section className="panel" key={m.id}>
          <p className="eyebrow">{m.status}</p>
          <h3>{m.subject}</h3>
          <p>{m.message}</p>
          {m.reply && <p className="notice">{m.reply}</p>}
        </section>
      ))}
      <Link className="text-link" to="/boutique">
        View your boutique quotes →
      </Link>
    </div>
  );
}
