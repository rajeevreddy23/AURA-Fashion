import "../studio/looks.css";
import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, useConfiguration } from "../services/api";
import { auth } from "../firebase";
import { download } from "../components/DesignArt";
import { parseProject } from "../../shared/workspace";
export default function DesignHub() {
  const [params] = useSearchParams();
  const requestedDesign = params.get("design");
  const config = useConfiguration();
  const [tab, setTab] = useState<"explore" | "own" | "requests">(
    requestedDesign ? "explore" : "explore",
  );
  const [products, setProducts] = useState<any[]>([]),
    [owned, setOwned] = useState<any[]>([]),
    [requests, setRequests] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const refresh = async () => {
    try {
      setProducts(
        (await api<any[]>("/products")).filter((p) => p.source === "designer"),
      );
      if (auth.currentUser && config.communityReady) {
        const [mine, access] = await Promise.all([
          api<any[]>("/my-designs"),
          api<any[]>("/access-requests"),
        ]);
        setOwned(mine);
        setRequests(access);
      }
    } catch (e: any) {
      setMessage(e.message);
    }
  };
  useEffect(() => {
    refresh();
  }, [config.communityReady]);
  const action = async (work: () => Promise<any>, success: string) => {
    setBusy(true);
    try {
      await work();
      setMessage(success);
      await refresh();
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  };
  const projectFile = async (id: string) => {
    const p = parseProject(JSON.stringify(await api(`/designs/${id}/project`)));
    download(
      `${p.id}.aura.json`,
      JSON.stringify(p, null, 2),
      "application/json",
    );
  };
  const ask = async (id: string) => {
    await api(`/designs/${id}/access-requests`, { message: drafts[id] || "" });
  };
  return (
    <div className="narrow-page design-hub">
      <div className="page-heading">
        <div>
          <p className="eyebrow">AURA COMMUNITY</p>
          <h2>Designs with a story.</h2>
          <p className="muted">
            Explore original work, manage your uploads and decide who may use
            your designs.
          </p>
        </div>
        <Link className="primary" to="/studio">
          Create in Studio
        </Link>
      </div>
      <div className="segmented hub-tabs">
        <button
          aria-pressed={tab === "explore"}
          onClick={() => setTab("explore")}
        >
          Explore designs
        </button>
        <button aria-pressed={tab === "own"} onClick={() => setTab("own")}>
          My uploads ({owned.length})
        </button>
        <button
          aria-pressed={tab === "requests"}
          onClick={() => setTab("requests")}
        >
          Access requests (
          {requests.filter((r) => r.status === "pending").length})
        </button>
      </div>
      {message && (
        <p className="notice" role="alert">
          {message}
        </p>
      )}
      {!config.communityReady && (
        <p className="notice">
          Community storage and account services are awaiting setup. Your local
          Studio, projects, versions and exports remain available.
        </p>
      )}
      {!auth.currentUser && (
        <p className="notice">
          <Link to="/login" state={{ returnTo: "/designs" }}>
            Log in
          </Link>{" "}
          to publish, request access or manage designs.
        </p>
      )}
      {tab === "explore" && (
        <>
          <div className="product-grid">
            {products
              .filter((p) => !requestedDesign || p.id === requestedDesign)
              .sort((a, b) => b.likes - a.likes || b.createdAt - a.createdAt)
              .map((p) => {
                const own = owned.some((x) => x.id === p.id),
                  request = requests.find(
                    (r) =>
                      r.designId === p.id &&
                      r.requesterId === auth.currentUser?.uid,
                  ),
                  available =
                    own ||
                    p.patternAccess === "public" ||
                    request?.status === "approved";
                return (
                  <article className="product-card" key={p.id}>
                    <Link to={`/product/${p.id}`} className="product-image">
                      <img src={p.image} alt={p.name} loading="lazy" />
                    </Link>
                    <div className="product-info">
                      <p className="eyebrow">
                        {p.likes || 0} likes ·{" "}
                        {p.hasPattern
                          ? p.patternAccess === "public"
                            ? "Shared project"
                            : "Owner approval required"
                          : "Original design"}
                      </p>
                      <h3>{p.name}</h3>
                      <Link
                        className="secondary"
                        to={`/boutique?product=${p.id}`}
                      >
                        Ask a boutique
                      </Link>
                      {p.hasPattern &&
                        (available ? (
                          <>
                            <Link
                              className="primary"
                              to={`/studio?design=${p.id}`}
                            >
                              Open editable project
                            </Link>
                            <button
                              className="secondary"
                              disabled={busy || !auth.currentUser}
                              onClick={() =>
                                action(
                                  () => projectFile(p.id),
                                  "Project downloaded. Respect the designer’s permission terms.",
                                )
                              }
                            >
                              Download project file
                            </button>
                          </>
                        ) : (
                          <>
                            <p className="muted">
                              Request access to the editable pattern, included
                              measurements and custom try-on.
                            </p>
                            {request ? (
                              <p className="notice">
                                Request: {request.status}
                                {request.reply && ` · ${request.reply}`}
                              </p>
                            ) : (
                              <form
                                className="form-stack"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  action(
                                    () => ask(p.id),
                                    "Access request saved for the designer.",
                                  );
                                }}
                              >
                                <label className="field">
                                  How will you use this design?
                                  <textarea
                                    required
                                    minLength={10}
                                    maxLength={500}
                                    value={drafts[p.id] || ""}
                                    onChange={(e) =>
                                      setDrafts((s) => ({
                                        ...s,
                                        [p.id]: e.target.value,
                                      }))
                                    }
                                  />
                                </label>
                                <button
                                  className="primary"
                                  disabled={
                                    busy ||
                                    !auth.currentUser ||
                                    !config.communityReady
                                  }
                                >
                                  Request designer approval
                                </button>
                              </form>
                            )}
                          </>
                        ))}
                      {p.tryOnEnabled && (
                        <Link
                          className="text-link"
                          to={`/tryon?product=${p.id}`}
                        >
                          View paid try-on
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>
          {products.filter((p) => !requestedDesign || p.id === requestedDesign)
            .length === 0 && (
            <section className="panel empty-state">
              <h3>No published designs here yet</h3>
              <p>
                Publish an original project from Studio after community services
                and billing are configured.
              </p>
              {requestedDesign && (
                <Link className="text-link" to="/designs">
                  Explore all designs
                </Link>
              )}
            </section>
          )}
        </>
      )}
      {tab === "own" && (
        <>
          <div className="hub-summary">
            <section className="panel">
              <small>My uploads</small>
              <strong>{owned.length}</strong>
            </section>
            <section className="panel">
              <small>Visible designs</small>
              <strong>{owned.filter((p) => p.published).length}</strong>
            </section>
            <section className="panel">
              <small>Likes received</small>
              <strong>{owned.reduce((n, p) => n + p.likes, 0)}</strong>
            </section>
          </div>
          <div className="product-grid">
            {owned.map((p) => (
              <section className="product-card" key={p.id}>
                {p.published ? (
                  <div className="product-image">
                    <img src={p.image} alt={p.name} />
                  </div>
                ) : (
                  <div className="private-design-placeholder">
                    Private design preview
                  </div>
                )}
                <div className="product-info">
                  <h3>{p.name}</h3>
                  <p className="muted">
                    {p.published ? "Published" : "Hidden from public browsing"}{" "}
                    · {p.likes} likes
                  </p>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={p.published}
                      disabled={busy}
                      onChange={(e) =>
                        action(
                          () =>
                            api(
                              `/my-designs/${p.id}`,
                              {
                                published: e.target.checked,
                                patternAccess: p.patternAccess,
                              },
                              "PATCH",
                            ),
                          "Design visibility updated.",
                        )
                      }
                    />
                    Show in community
                  </label>
                  {p.hasPattern && (
                    <>
                      <label className="field">
                        Project access
                        <select
                          disabled={busy}
                          value={p.patternAccess}
                          onChange={(e) =>
                            action(
                              () =>
                                api(
                                  `/my-designs/${p.id}`,
                                  {
                                    published: p.published,
                                    patternAccess: e.target.value,
                                  },
                                  "PATCH",
                                ),
                              "Access policy updated.",
                            )
                          }
                        >
                          <option value="approval">
                            Designer approval required
                          </option>
                          <option value="public">Every signed-in user</option>
                        </select>
                      </label>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          action(
                            () => projectFile(p.id),
                            "Your editable project was downloaded.",
                          )
                        }
                      >
                        Download my project
                      </button>
                    </>
                  )}
                </div>
              </section>
            ))}
          </div>
          {owned.length === 0 && (
            <section className="panel empty-state">
              <h3>Your uploaded designs will appear here</h3>
              <Link className="text-link" to="/studio">
                Continue creating locally
              </Link>
            </section>
          )}
        </>
      )}
      {tab === "requests" && (
        <>
          <p className="notice">
            Approval shares access to the project, its measurements and custom
            try-on. You can revoke future access; copies already downloaded
            cannot be recalled. Only the current designer can approve requests.
          </p>
          {requests.length === 0 ? (
            <section className="panel empty-state">
              <h3>No access requests yet</h3>
            </section>
          ) : (
            requests.map((r) => (
              <section className="panel request-card" key={r.id}>
                <p className="eyebrow">
                  {r.ownerId === auth.currentUser?.uid
                    ? "Request received"
                    : "Your request"}{" "}
                  · {r.status}
                </p>
                <h3>{r.designName}</h3>
                <p>{r.message}</p>
                {r.reply && <p className="notice">Designer: {r.reply}</p>}
                {r.ownerId === auth.currentUser?.uid ? (
                  <>
                    <label className="field">
                      Permission note (optional)
                      <textarea
                        maxLength={500}
                        value={drafts[r.id] ?? r.reply ?? ""}
                        onChange={(e) =>
                          setDrafts((s) => ({ ...s, [r.id]: e.target.value }))
                        }
                      />
                    </label>
                    <div className="button-row">
                      {(["approved", "rejected", "revoked"] as const).map(
                        (status) => (
                          <button
                            className={
                              status === "approved" ? "primary" : "secondary"
                            }
                            key={status}
                            disabled={busy || r.status === status}
                            onClick={() =>
                              action(
                                () =>
                                  api(
                                    `/access-requests/${r.id}`,
                                    {
                                      status,
                                      reply: drafts[r.id] ?? r.reply ?? "",
                                    },
                                    "PATCH",
                                  ),
                                `Request ${status}.`,
                              )
                            }
                          >
                            {status === "approved"
                              ? "Approve access"
                              : status === "rejected"
                                ? "Decline request"
                                : "Revoke access"}
                          </button>
                        ),
                      )}
                    </div>
                  </>
                ) : (
                  r.status === "approved" && (
                    <Link
                      className="primary"
                      to={`/studio?design=${r.designId}`}
                    >
                      Open approved project
                    </Link>
                  )
                )}
              </section>
            ))
          )}
        </>
      )}
      <Link className="library-entry" to="/looks">
        <strong>Explore 18 editable dress designs</strong>Lehengas, gowns and
        blouses with coordinated fabrics and embroidery. Open a sample in Studio
        or use its Meshy prompt.
      </Link>
    </div>
  );
}
