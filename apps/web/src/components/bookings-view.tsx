"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { Booking, BookingStatus } from "./demo-data";
import { frontendApi } from "./api-adapter";
import { Icon } from "./icons";
import { Avatar, Badge, EmptyState, PageHeader } from "./ui";
import { useWorkspaceAccess } from "./workspace-access";

const tones: Record<BookingStatus, "success" | "warning" | "danger"> = { confirmed: "success", pending: "warning", canceled: "danger" };

function notificationCopy(status: Booking["notificationStatus"]) {
  switch (status) {
    case "GOOGLE_UPDATE_ACCEPTED": return "Google Kalender hat die letzte Buchungsaktualisierung angenommen.";
    case "LOCAL_NO_EMAIL": return "Lokal gespeichert. Es wurde keine externe E-Mail gesendet.";
    case "RETRY_PENDING": return "Die Aktualisierung wird automatisch erneut versucht.";
    case "PENDING": return "Diese Buchungsaktualisierung wartet auf die Synchronisierung.";
  }
}

function answerText(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (value == null) return "Keine Antwort";
  try { return JSON.stringify(value); } catch { return "Erfasste Antwort"; }
}

export function BookingsView() {
  const { canManage } = useWorkspaceAccess();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | BookingStatus>("all");
  const [selected, setSelected] = useState<Booking | null>(null);
  const [workspaceTimeZone, setWorkspaceTimeZone] = useState("UTC");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLButtonElement | null>(null);
  const load = useCallback(() => { frontendApi.getAccount().then(async (account) => { const [bookingItems, eventItems] = await Promise.all([frontendApi.listBookings(account.workspace.timeZone), frontendApi.listEventTypes()]); const events = new Map(eventItems.map((event) => [event.id, event])); const resolved = bookingItems.map((booking) => { const event = events.get(booking.eventTypeId); return { ...booking, ...(event ? { eventSlug: event.slug } : {}) }; }); setWorkspaceTimeZone(account.workspace.timeZone); setBookings(resolved); const requested = new URLSearchParams(window.location.search).get("selected"); if (requested) setSelected(resolved.find((booking) => booking.id === requested) ?? null); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Buchungen konnten nicht geladen werden.")).finally(() => setLoading(false)); }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (!selected) return; const prior = document.body.style.overflow; document.body.style.overflow = "hidden"; window.requestAnimationFrame(() => closeRef.current?.focus()); return () => { document.body.style.overflow = prior; }; }, [selected]);
  const closeDrawer = () => { setSelected(null); const url = new URL(window.location.href); if (url.searchParams.has("selected")) { url.searchParams.delete("selected"); window.history.replaceState(null, "", `${url.pathname}${url.search}`); } window.requestAnimationFrame(() => returnFocusRef.current?.focus()); };
  const trapDrawer = (event: KeyboardEvent<HTMLElement>) => { if (event.key === "Escape") { event.preventDefault(); closeDrawer(); return; } if (event.key !== "Tab") return; const focusable = [...(drawerRef.current?.querySelectorAll<HTMLElement>("a[href],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex='-1'])") ?? [])]; const first = focusable[0]; const last = focusable.at(-1); if (!first || !last) return; if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } };
  const filtered = useMemo(() => bookings.filter((booking) => (status === "all" || booking.status === status) && `${booking.invitee} ${booking.email} ${booking.eventTitle}`.toLowerCase().includes(query.toLowerCase())), [bookings, query, status]);

  if (loading) return <div className="page-stack"><PageHeader title="Buchungen" /><div className="sync-note" role="status"><span className="spinner" />Buchungen werden geladen…</div></div>;
  if (error && bookings.length === 0) return <div className="page-stack"><PageHeader title="Buchungen" /><section className="panel error-state" role="alert"><span><Icon name="x" /></span><h2>Buchungen wurden nicht geladen</h2><p>{error}</p><button type="button" className="button button-primary" onClick={() => { setLoading(true); setError(""); void load(); }}>Erneut versuchen</button></section></div>;

  return <div className="page-stack">
    <PageHeader title="Buchungen" description={`Datum und Uhrzeit für Gastgeber:innen werden in ${workspaceTimeZone} angezeigt.`} />
    {error && <div className="toast toast-error" role="alert"><span><Icon name="x" /></span>{error}</div>}
    <div className="toolbar bookings-toolbar"><div className="search-field"><Icon name="search" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nach Name, E-Mail oder Termin suchen" aria-label="Buchungen durchsuchen" /></div><select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Buchungsstatus filtern"><option value="all">Alle Serverstatus</option><option value="confirmed">Bestätigt</option><option value="pending">Zahlung ausstehend</option><option value="canceled">Storniert</option></select></div>
    <section className="panel bookings-panel">
      <div className="booking-table-head"><span>Gast</span><span>Termin</span><span>Datum & Uhrzeit</span><span>Status</span><span /></div>
      <div className="booking-table">{filtered.map((booking) => <button type="button" className="booking-table-row" key={booking.id} onClick={(event) => { returnFocusRef.current = event.currentTarget; const url = new URL(window.location.href); url.searchParams.set("selected", booking.id); window.history.replaceState(null, "", `${url.pathname}${url.search}`); setSelected(booking); }} aria-haspopup="dialog"><span className="invitee-cell"><Avatar name={booking.invitee} /><span><strong>{booking.invitee}</strong><small>{booking.email}</small></span></span><span><strong>{booking.eventTitle}</strong><small>{booking.duration} min</small></span><span><strong>{booking.dateLabel}</strong><small>{booking.timeLabel}</small></span><span><Badge tone={tones[booking.status]} dot>{booking.status === "confirmed" ? "bestätigt" : booking.status === "pending" ? "Zahlung ausstehend" : "storniert"}</Badge></span><span><Icon name="arrow-right" /></span></button>)}</div>
      {filtered.length === 0 && <EmptyState icon="search" title="Keine Buchungen gefunden" description="Versuche, deine Suche oder Filter zu ändern." />}
      <footer className="table-footer"><span>{filtered.length} von {bookings.length} Buchungen angezeigt</span></footer>
    </section>
    {selected && <div className="drawer-layer"><button type="button" className="drawer-scrim" onClick={closeDrawer} aria-label="Buchungsdetails schließen" tabIndex={-1} /><aside ref={drawerRef} className="detail-drawer" role="dialog" aria-modal="true" aria-labelledby="booking-drawer-title" onKeyDown={trapDrawer}><header><div><Badge tone={tones[selected.status]} dot>{selected.status === "pending" ? "Zahlung ausstehend" : selected.status === "confirmed" ? "bestätigt" : "storniert"}</Badge><h2 id="booking-drawer-title">{selected.eventTitle}</h2><span>{selected.id}</span></div><button ref={closeRef} type="button" className="icon-button" onClick={closeDrawer} aria-label="Buchungsdetails schließen"><Icon name="x" /></button></header><div className="drawer-invitee"><Avatar name={selected.invitee} size="lg" /><div><strong>{selected.invitee}</strong><span>{selected.email}</span></div></div><div className="detail-list"><div><Icon name="calendar" /><span><small>Datum (Gastgeber:in)</small><strong>{new Intl.DateTimeFormat("de-DE", { timeZone: workspaceTimeZone, weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(new Date(selected.startsAt))}</strong></span></div><div><Icon name="clock" /><span><small>Uhrzeit (Gastgeber:in)</small><strong>{selected.timeLabel}</strong><em>{workspaceTimeZone}</em>{selected.timezone !== workspaceTimeZone && <em>Zeitzone des Gasts: {selected.timezone}</em>}</span></div>{selected.location && <div><Icon name="video" /><span><small>Ort</small><strong>{selected.location}</strong></span></div>}<div><Icon name="video" /><span><small>Kalendersynchronisierung</small><strong>{selected.notificationStatus.replaceAll("_", " ").toLowerCase()}</strong><em>{notificationCopy(selected.notificationStatus)}</em></span></div><div><Icon name="team" /><span><small>Gastgeber:in</small><strong>{selected.hostName}</strong></span></div></div>{selected.answers.length > 0 && <section className="drawer-answer"><h3>Individuelle Antworten</h3>{selected.answers.map((answer, index) => <p key={answer.questionId ?? `${answer.questionLabel}-${index}`}><strong>{answer.questionLabel}</strong><br />{answerText(answer.value)}</p>)}</section>}{selected.cancellationReason && <section className="drawer-answer"><h3>Grund der Stornierung</h3><p>{selected.cancellationReason}</p></section>}{selected.notes && <section className="drawer-answer"><h3>Notizen des Gasts</h3><p>{selected.notes}</p></section>}{canManage && selected.status !== "canceled" && selected.eventSlug && <div className="manage-row"><span>Aktionen für Gastgeber:innen</span>{selected.status === "confirmed" && <Link href={`/manage/${selected.id}/reschedule?slug=${encodeURIComponent(selected.eventSlug)}`}>Verschieben</Link>}<Link href={`/manage/${selected.id}/cancel?slug=${encodeURIComponent(selected.eventSlug)}`}>Stornieren</Link></div>}</aside></div>}
  </div>;
}
