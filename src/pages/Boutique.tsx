import React, { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, money, useConfiguration } from "../services/api";
import { auth } from "../firebase";
export default function Boutique() {
  const [params] = useSearchParams();
  const productId = params.get("product");
  const config = useConfiguration();
  const [boutiques, setBoutiques] = useState<any[]>([]);
  const [product, setProduct] = useState<any>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [boutiqueId, setBoutiqueId] = useState("");
  const [notes, setNotes] = useState("");
  const [budget, setBudget] = useState("");
  const [consent, setConsent] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const id = useRef(crypto.randomUUID());
  const refresh = () => {
    if (auth.currentUser)
      api<any[]>("/quotes")
        .then(setQuotes)
        .catch((e) => setMessage(e.message));
  };
  useEffect(() => {
    api<any[]>("/boutiques")
      .then(setBoutiques)
      .catch((e) => setMessage(e.message));
    if (productId)
      api(`/products/${productId}`)
        .then(setProduct)
        .catch((e) => setMessage(e.message));
    refresh();
  }, [productId]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api("/quotes", {
        requestId: id.current,
        productId,
        boutiqueId,
        notes,
        budgetPaise: Math.round(Number(budget) * 100),
        consent,
      });
      setMessage(
        `Quote request saved. Reference: ${result.id}. No payment has been taken.`,
      );
      id.current = crypto.randomUUID();
      setNotes("");
      setConsent(false);
      refresh();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };
  const reply = async (e: React.FormEvent<HTMLFormElement>, quote: any) => {
    e.preventDefault();
    setBusy(true);
    try {
      const form = new FormData(e.currentTarget);
      await api(
        `/quotes/${quote.id}`,
        {
          pricePaise: Math.round(Number(form.get("price")) * 100),
          reply: String(form.get("reply")),
        },
        "PATCH",
      );
      refresh();
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
          <p className="eyebrow">FROM IDEA TO OUTFIT</p>
          <h2>Make it with a boutique.</h2>
          <p className="muted">
            Share a design and your requirements. Receive a price before
            committing.
          </p>
        </div>
      </div>
      {message && (
        <p className="notice" role="alert">
          {message}
        </p>
      )}
      {!auth.currentUser && (
        <p className="notice">
          <Link to="/login">Log in</Link> to send and track quote requests.
        </p>
      )}
      {product ? (
        <section className="panel quote-layout">
          <img src={product.image} alt={product.name} />
          <div>
            <h3>{product.name}</h3>
            <form onSubmit={submit} className="form-stack">
              <label className="field">
                Choose a boutique
                <select
                  required
                  value={boutiqueId}
                  onChange={(e) => setBoutiqueId(e.target.value)}
                >
                  <option value="">Select an available boutique</option>
                  {boutiques.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.city}
                    </option>
                  ))}
                </select>
              </label>
              {boutiques.length === 0 && (
                <p className="notice">
                  No boutiques are accepting requests yet. Your design can still
                  be saved or exported from Studio.
                </p>
              )}
              <label className="field">
                Budget in INR
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  step="0.01"
                  required
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                />
              </label>
              <label className="field">
                What would you like made?
                <textarea
                  minLength={10}
                  maxLength={1000}
                  required
                  placeholder="Fabric, occasion, sizing preferences and delivery needs…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                Share this design and these requirements with the selected
                boutique.
              </label>
              <button
                className="primary"
                disabled={
                  busy ||
                  !consent ||
                  !boutiques.length ||
                  !auth.currentUser ||
                  !config.communityReady
                }
              >
                Request a quote
              </button>
            </form>
          </div>
        </section>
      ) : (
        <section className="panel">
          <h3>Start with a design you love</h3>
          <p>
            Choose “Ask a boutique” on any Shop product to attach that design.
          </p>
          <Link className="text-link" to="/shopping">
            Browse designs →
          </Link>
        </section>
      )}
      <h3 className="section-title">Your quote conversations</h3>
      {quotes.length === 0 ? (
        <p className="muted">No quote requests yet.</p>
      ) : (
        quotes.map((q) => (
          <section className="panel" key={q.id}>
            <p className="eyebrow">{q.status}</p>
            <h3>
              {q.productName} · {q.boutiqueName}
            </h3>
            <p>{q.notes}</p>
            <p>Budget: {money(q.budgetPaise)}</p>
            {q.reply && (
              <p className="notice">
                Boutique quote: {money(q.pricePaise)}. {q.reply}
              </p>
            )}
            {q.boutiqueOwner === auth.currentUser?.uid && (
              <form className="form-stack" onSubmit={(e) => reply(e, q)}>
                <label className="field">
                  Quoted price in INR
                  <input
                    name="price"
                    type="number"
                    min="1"
                    max="1000000"
                    step=".01"
                    required
                  />
                </label>
                <label className="field">
                  Reply
                  <textarea
                    name="reply"
                    minLength={5}
                    maxLength={1000}
                    required
                  />
                </label>
                <button className="secondary" disabled={busy}>
                  Send quote
                </button>
              </form>
            )}
          </section>
        ))
      )}
    </div>
  );
}
