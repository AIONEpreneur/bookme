"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { EventType } from "./demo-data";
import { frontendApi } from "./api-adapter";
import { Icon } from "./icons";
import { Badge, ButtonLink, PageHeader, Toggle } from "./ui";
import { useWorkspaceAccess } from "./workspace-access";

export function EventTypesView() {
  const { canManage } = useWorkspaceAccess();
  const [events, setEvents] = useState<EventType[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "published" | "draft">("all");
  const [copiedId, setCopiedId] = useState("");
  const [savingId, setSavingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { frontendApi.listEventTypes().then(setEvents).catch((reason) => setError(reason instanceof Error ? reason.message : "Terminarten konnten nicht geladen werden.")).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => events.filter((event) => (filter === "all" || event.status === filter) && event.title.toLowerCase().includes(query.toLowerCase())), [events, filter, query]);
  const copyLink = async (event: EventType) => {
    try { await navigator.clipboard.writeText(`${window.location.origin}/book/${event.slug}`); setCopiedId(event.id); window.setTimeout(() => setCopiedId(""), 1800); }
    catch { setError("Der Buchungslink konnte nicht kopiert werden. Öffne ihn und kopiere stattdessen die Browser-Adresse."); }
  };
  const toggle = async (id: string) => {
    if (savingId) return;
    const target = events.find((item) => item.id === id);
    if (!target) return;
    const next = { ...target, status: target.status === "published" ? "draft" as const : "published" as const };
    setSavingId(id); setError("");
    setEvents((items) => items.map((item) => item.id === id ? next : item));
    try { const saved = await frontendApi.saveEventType(next, "edit", next.status === "published"); setEvents((items) => items.map((item) => item.id === id ? saved : item)); }
    catch (reason) { setEvents((items) => items.map((item) => item.id === id ? target : item)); setError(reason instanceof Error ? reason.message : "Der Veröffentlichungsstatus konnte nicht geändert werden."); }
    finally { setSavingId(""); }
  };

  if (!canManage) return <div className="page-stack"><PageHeader title="Terminarten" /><section className="panel error-state" role="alert"><span><Icon name="x" /></span><h2>Gastgeber-Zugang erforderlich</h2><p>Deine Workspace-Rolle kann Buchungen und Kontoeinstellungen sehen, aber keine Terminarten erstellen oder ändern.</p></section></div>;
  return <div className="page-stack">
    <PageHeader title="Terminarten" description="Erstelle und verwalte die Erlebnisse, die man buchen kann." actions={<ButtonLink href="/event-types/new" icon="plus">Terminart erstellen</ButtonLink>} />
    <div className="toolbar"><div className="search-field"><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Terminarten durchsuchen" aria-label="Terminarten durchsuchen" /></div><div className="segmented" aria-label="Terminarten filtern">{(["all", "published", "draft"] as const).map((item) => <button type="button" key={item} className={filter === item ? "is-active" : ""} aria-pressed={filter === item} onClick={() => setFilter(item)}>{item === "all" ? "Alle" : item === "published" ? "Veröffentlicht" : "Entwürfe"} <span>{item === "all" ? events.length : events.filter((event) => event.status === item).length}</span></button>)}</div></div>
    {loading && <div className="sync-note" role="status"><span className="spinner" />Terminarten werden synchronisiert…</div>}
    {error && <div className="toast toast-error" role="alert"><span><Icon name="x" /></span>{error}</div>}
    <div className="event-card-grid">
      {filtered.map((event) => <article className="event-card" key={event.id}>
        <div className="event-card-accent" style={{ background: event.color }} />
        <div className="event-card-head"><Badge tone={event.status === "published" ? "success" : "neutral"} dot>{event.status === "published" ? "veröffentlicht" : event.status === "draft" ? "Entwurf" : "archiviert"}</Badge></div>
        <div className="event-card-body"><h2>{event.title}</h2><p>{event.description}</p><div className="event-meta"><span><Icon name="clock" />{event.durations.map((item) => item.label).join(", ")}</span><span><Icon name="video" />{event.location}</span><span><Icon name="team" />{event.hostName}</span><span><Icon name="bookings" />{event.bookingCount} {event.bookingCount === 1 ? "Buchung" : "Buchungen"}</span></div></div>
        <div className="event-card-link"><span suppressHydrationWarning>{typeof window === "undefined" ? `/book/${event.slug}` : `${window.location.origin}/book/${event.slug}`}</span><button type="button" onClick={() => copyLink(event)} aria-label={`Buchungslink für ${event.title} kopieren`}>{copiedId === event.id ? <Icon name="check" /> : <Icon name="copy" />}</button><Link href={`/book/${event.slug}`} aria-label="Buchungsseite öffnen"><Icon name="external" /></Link></div>
        <div className="event-card-foot"><Toggle checked={event.status === "published"} onChange={() => void toggle(event.id)} label={`${event.title} ${event.status === "published" ? "auf Entwurf zurücksetzen" : "veröffentlichen"}`} disabled={savingId === event.id} /><span>{savingId === event.id ? "Wird gespeichert…" : event.status === "published" ? "Nimmt Buchungen an" : "Nicht öffentlich"}</span><Link className="button button-secondary button-sm" href={`/event-types/${event.id}`}>Bearbeiten</Link></div>
      </article>)}
    </div>
  </div>;
}
