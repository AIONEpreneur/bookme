"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Booking, EventType } from "./demo-data";
import { frontendApi } from "./api-adapter";
import { Icon } from "./icons";
import { Avatar, Badge, ButtonLink, EmptyState, Metric, PageHeader, SectionHeader } from "./ui";
import { useWorkspaceAccess } from "./workspace-access";

function calendarMonthKey(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(value);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

export function DashboardView() {
  const { canManage } = useWorkspaceAccess();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [workspaceTimeZone, setWorkspaceTimeZone] = useState("UTC");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(() => { frontendApi.getAccount().then(async (account) => { const [bookingItems, eventItems] = await Promise.all([frontendApi.listBookings(account.workspace.timeZone), frontendApi.listEventTypes()]); setWorkspaceTimeZone(account.workspace.timeZone); setBookings(bookingItems); setEventTypes(eventItems); }).catch((reason) => setError(reason instanceof Error ? reason.message : "Das Dashboard konnte nicht geladen werden.")).finally(() => setLoading(false)); }, []);
  useEffect(() => { void load(); }, [load]);
  const now = useMemo(() => new Date(), []);
  const allUpcoming = useMemo(() => bookings.filter((booking) => new Date(booking.startsAt) >= now && booking.status !== "canceled").sort((a, b) => a.startsAt.localeCompare(b.startsAt)), [bookings, now]);
  const upcoming = allUpcoming.slice(0, 3);
  const monthBookings = bookings.filter((booking) => booking.status !== "canceled" && calendarMonthKey(new Date(booking.startsAt), workspaceTimeZone) === calendarMonthKey(now, workspaceTimeZone));
  const activeEvents = eventTypes.filter((event) => event.status === "published");
  const bookedHours = monthBookings.reduce((total, booking) => total + booking.duration, 0) / 60;
  const metrics = [
    { label: "Anstehend", value: String(allUpcoming.length), detail: "Bestätigt oder Zahlung ausstehend", icon: "bookings" as const, tone: "brand" as const },
    { label: "Diesen Monat", value: String(monthBookings.length), detail: "Buchungen in deinem Kalender", icon: "calendar" as const, tone: "blue" as const },
    { label: "Gebuchte Stunden", value: bookedHours.toFixed(1), detail: "In diesem Kalendermonat", icon: "clock" as const, tone: "green" as const },
    { label: "Veröffentlichte Links", value: String(activeEvents.length), detail: `${eventTypes.length} Terminarten insgesamt`, icon: "event-types" as const, tone: "amber" as const },
  ];
  const publicEvent = activeEvents[0];
  if (loading) return <div className="page-stack"><PageHeader title="Planungsübersicht" /><div className="sync-note" role="status"><span className="spinner" />Dashboard wird geladen…</div></div>;
  if (error) return <div className="page-stack"><PageHeader title="Planungsübersicht" /><section className="panel error-state" role="alert"><span><Icon name="x" /></span><h2>Dashboard wurde nicht geladen</h2><p>{error}</p><button className="button button-primary" type="button" onClick={() => { setLoading(true); setError(""); void load(); }}>Erneut versuchen</button></section></div>;
  return (
    <div className="page-stack">
      <PageHeader title="Planungsübersicht" description={`Buchungen werden in ${workspaceTimeZone} angezeigt.`} actions={canManage ? <ButtonLink href="/event-types/new" icon="plus">Terminart erstellen</ButtonLink> : undefined} />
      <section className="metric-grid" aria-label="Buchungsübersicht">
        {metrics.map((metric) => <Metric key={metric.label} {...metric} />)}
      </section>
      <div className="dashboard-grid">
        <section className="panel upcoming-panel">
          <SectionHeader title="Anstehende Buchungen" description="Deine nächsten bestätigten und ausstehenden Meetings" action={<Link className="text-link" href="/bookings">Alle ansehen <Icon name="arrow-right" size={14} /></Link>} />
          <div className="booking-list">
            {upcoming.map((booking) => (
              <Link href={`/bookings?selected=${booking.id}`} className="booking-row" key={booking.id}>
                <div className="date-chip"><strong>{new Intl.DateTimeFormat("de-DE", { day: "numeric", timeZone: workspaceTimeZone }).format(new Date(booking.startsAt))}</strong><span>{new Intl.DateTimeFormat("de-DE", { month: "short", timeZone: workspaceTimeZone }).format(new Date(booking.startsAt))}</span></div>
                <div className="booking-main"><div><strong>{booking.invitee}</strong><Badge tone={booking.status === "pending" ? "warning" : "success"} dot>{booking.status === "pending" ? "Zahlung ausstehend" : booking.status === "confirmed" ? "bestätigt" : "storniert"}</Badge></div><span>{booking.eventTitle}</span><small><Icon name="clock" size={14} />{booking.timeLabel}<i>·</i><Icon name="team" size={14} />{booking.hostName}</small></div>
                <Avatar name={booking.invitee} size="sm" />
                <Icon name="arrow-right" size={16} />
              </Link>
            ))}
          </div>
          {upcoming.length === 0 && !error && <EmptyState icon="calendar" title="Keine anstehenden Buchungen" description="Neue bestätigte Buchungen erscheinen hier." />}
        </section>
        <aside className="panel quick-panel">
          <SectionHeader title="Schnellaktionen" />
          <div className="quick-actions">
            {canManage && <Link href="/event-types/new"><span className="quick-icon"><Icon name="plus" /></span><div><strong>Neue Terminart</strong><small>Erstelle ein Buchungserlebnis</small></div><Icon name="arrow-right" /></Link>}
            {canManage && <Link href="/availability"><span className="quick-icon"><Icon name="availability" /></span><div><strong>Verfügbarkeit aktualisieren</strong><small>Passe deine Arbeitszeiten an</small></div><Icon name="arrow-right" /></Link>}
            {publicEvent && <Link href={`/book/${publicEvent.slug}`}><span className="quick-icon"><Icon name="link" /></span><div><strong>Buchungslink teilen</strong><small>Sieh dir den Ablauf für Gäste an</small></div><Icon name="arrow-right" /></Link>}
          </div>
        </aside>
      </div>
      <section className="panel event-summary-panel">
        <SectionHeader title="Aktive Terminarten" description="Die Links, die derzeit Buchungen annehmen" action={canManage ? <Link className="text-link" href="/event-types">Terminarten verwalten <Icon name="arrow-right" size={14} /></Link> : undefined} />
        <div className="event-summary-grid">
          {activeEvents.map((event) => <Link href={canManage ? `/event-types/${event.id}` : `/book/${event.slug}`} className="event-summary" key={event.id}><span className="event-color" style={{ background: event.color }} /><div><strong>{event.title}</strong><span>{event.durations.map((item) => item.label).join(" · ")} · {event.location}</span></div></Link>)}
        </div>
        {activeEvents.length === 0 && <EmptyState icon="event-types" title="Keine veröffentlichten Terminarten" description={canManage ? "Veröffentliche eine Terminart, um einen öffentlichen Buchungslink zu erstellen." : "Derzeit sind keine öffentlichen Buchungslinks verfügbar."} action={canManage ? <ButtonLink href="/event-types/new">Terminart erstellen</ButtonLink> : undefined} />}
      </section>
    </div>
  );
}
