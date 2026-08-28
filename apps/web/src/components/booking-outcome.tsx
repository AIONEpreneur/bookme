"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { BookingSlot, BookingSummary, WorkspaceBranding } from "@/lib/contracts";
import { frontendApi } from "./api-adapter";
import { clearTerminalBookingAttempt } from "./booking-attempt";
import { retainBookingRecoveryAuthority, shareBookingRecoveryLoad } from "./booking-recovery-load";
import { foregroundForBackground } from "./brand-contrast";
import { claimOneUseLinkAuthority } from "./one-use-link-authority";
import { loadRescheduleWindowSlots } from "./slot-window";
import { Icon } from "./icons";
import { ActionButton, Field } from "./ui";

function bookingDate(booking: BookingSummary) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: booking.inviteeTimeZone, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(new Date(booking.startAt));
}
function bookingTime(booking: BookingSummary) {
  return new Intl.DateTimeFormat("de-DE", { timeZone: booking.inviteeTimeZone, hour: "numeric", minute: "2-digit" }).format(new Date(booking.startAt));
}
function calendarDelivery(booking: BookingSummary) {
  switch (booking.notificationStatus) {
    case "GOOGLE_UPDATE_ACCEPTED": return "Google Kalender hat die letzte Buchungsaktualisierung erhalten.";
    case "LOCAL_NO_EMAIL": return "Diese Buchung ist im lokalen Kalender gespeichert.";
    case "RETRY_PENDING": return "Die Kalendersynchronisierung wird automatisch erneut versucht.";
    case "PENDING": return "Die Kalendersynchronisierung läuft.";
  }
}
function bookingLocation(booking: BookingSummary) {
  if (booking.locationType === "GOOGLE_MEET") return booking.calendarProvider === "google" && booking.calendarSyncStatus === "SYNCED" ? "Google Meet" : "Details zum Online-Meeting nicht verfügbar";
  if (booking.locationType === "PHONE") return booking.locationValue || "Telefonanruf";
  if (booking.locationType === "IN_PERSON") return booking.locationValue || "Vor Ort";
  return booking.locationValue || "Individueller Ort";
}
function dateKey(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function usePublicBranding(slug: string) {
  const [branding, setBranding] = useState<WorkspaceBranding | null>(null);
  useEffect(() => { if (!slug) return; let active = true; frontendApi.getPublicEvent(slug).then((event) => { if (active) setBranding(event.branding ?? null); }).catch(() => undefined); return () => { active = false; }; }, [slug]);
  return branding;
}

export function ConfirmationView({ slug, bookingId, payment, readCapability, cancelCapability, rescheduleCapability }: { slug: string; bookingId?: string; payment?: string; readCapability?: string; cancelCapability?: string; rescheduleCapability?: string }) {
  const incomplete = !bookingId;
  const branding = usePublicBranding(slug);
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [loading, setLoading] = useState(!incomplete);
  const [error, setError] = useState(incomplete ? "Dieser Bestätigungslink ist unvollständig." : "");
  const started = useRef(false);
  const verify = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError("");
    const legacyPresent = Boolean(readCapability || cancelCapability || rescheduleCapability);
    const cleanUrl = `/book/${encodeURIComponent(slug)}/confirmation?booking=${encodeURIComponent(bookingId)}${payment ? `&payment=${encodeURIComponent(payment)}` : ""}`;
    let exchangeFailed = false;
    try {
      if (legacyPresent) {
        if (readCapability && cancelCapability && rescheduleCapability) {
          try {
            await frontendApi.exchangeBookingManageSession(bookingId, { read: readCapability, cancel: cancelCapability, reschedule: rescheduleCapability, expiresAt: "" });
          } catch {
            exchangeFailed = true;
          }
        } else {
          exchangeFailed = true;
        }
      }

      const verified = await frontendApi.getBookingForManage(bookingId);
      await frontendApi.acknowledgeBookingManageSession(bookingId);
      window.history.replaceState(null, "", cleanUrl);
      setBooking(verified);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Diese Buchung konnte nicht verifiziert werden.";
      setError(exchangeFailed ? `Die sichere Sitzungswiederherstellung wurde nicht abgeschlossen. ${message}` : message);
    } finally {
      setLoading(false);
    }
  }, [bookingId, cancelCapability, payment, readCapability, rescheduleCapability, slug]);
  useEffect(() => {
    if (!bookingId || started.current) return;
    started.current = true;
    void verify();
  }, [bookingId, verify]);
  const calendarPending = booking?.calendarSyncStatus === "PENDING" || booking?.notificationStatus === "PENDING" || booking?.notificationStatus === "RETRY_PENDING";
  useEffect(() => {
    if (!bookingId || !calendarPending) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const refresh = async () => {
      attempts += 1;
      try {
        const refreshed = await frontendApi.getBookingForManage(bookingId);
        if (!active) return;
        setBooking(refreshed);
        const stillPending = refreshed.calendarSyncStatus === "PENDING" || refreshed.notificationStatus === "PENDING" || refreshed.notificationStatus === "RETRY_PENDING";
        if (stillPending && attempts < 5) timer = setTimeout(() => void refresh(), attempts * 800);
      } catch {
        if (active && attempts < 5) timer = setTimeout(() => void refresh(), attempts * 800);
      }
    };
    timer = setTimeout(() => void refresh(), 600);
    return () => { active = false; if (timer) clearTimeout(timer); };
  }, [bookingId, calendarPending]);
  useEffect(() => { if (booking && booking.status !== "PENDING_PAYMENT") clearTerminalBookingAttempt(slug); }, [booking, slug]);
  if (loading) return <ManageLoading label="Deine Buchung wird verifiziert…" />;
  if (!booking) return incomplete ? <ManageError title="Buchung nicht verifiziert" description={error} branding={branding} /> : <ManageRetry bookingId={bookingId} description={error} onRetry={verify} branding={branding} />;
  if (booking.status === "PENDING_PAYMENT") return <PaymentPending booking={booking} branding={branding} payment={payment} slug={slug} />;
  if (booking.status === "CANCELLED") return <ManageError title="Diese Buchung ist storniert" description="Die Buchung ist nicht mehr aktiv." />;
  const slugQuery = `slug=${encodeURIComponent(slug)}`;
  return <div className="public-page outcome-page"><BrandHeader branding={branding} /><main className="outcome-shell"><div className="success-mark" style={{ color: branding?.accentColor }}><Icon name="check" size={34} /></div><span className="outcome-eyebrow">Buchung bestätigt</span><h1>Du bist gebucht, {booking.inviteeName}.</h1><p>Deine Meeting-Details sind bereit. Behalte diese Seite griffbereit, falls du etwas ändern möchtest.</p><BookingCard booking={booking} branding={branding} /><div className="manage-row"><span>Möchtest du etwas ändern?</span><Link href={`/manage/${booking.id}/reschedule?${slugQuery}`}>Verschieben</Link><i>·</i><Link href={`/manage/${booking.id}/cancel?${slugQuery}`}>Stornieren</Link></div><small className="reference">Buchungsreferenz · {booking.id}</small></main><PublicFooter branding={branding} /></div>;
}

export function CancelBookingView({ bookingId, slug = "" }: { bookingId: string; slug?: string }) {
  const router = useRouter();
  const branding = usePublicBranding(slug);
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [reason, setReason] = useState("");
  const [canceled, setCanceled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    frontendApi.getBookingForManage(bookingId).then(setBooking).catch((reason) => setError(reason instanceof Error ? reason.message : "Diese Buchung konnte nicht geladen werden.")).finally(() => setLoadingBooking(false));
  }, [bookingId]);
  const cancel = async () => {
    setLoading(true); setError("");
    try { const updated = await frontendApi.cancelBooking(bookingId, reason || undefined); setBooking(updated); setCanceled(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Diese Buchung konnte nicht storniert werden."); }
    finally { setLoading(false); }
  };
  const resumeCheckout = async () => {
    setRecovering(true); setError("");
    try {
      const result = await frontendApi.resumeBookingCheckout(bookingId);
      if (result.bookingId !== bookingId) throw new Error("Der wiederhergestellte Zahlungsversuch passt nicht zu dieser Buchung.");
      if (result.checkoutUrl) { window.location.assign(result.checkoutUrl); return; }
      if (result.status !== "PENDING_PAYMENT") { router.push(`/book/${encodeURIComponent(slug)}/confirmation?booking=${encodeURIComponent(bookingId)}`); return; }
      setError("Der gehostete Checkout ist derzeit nicht verfügbar. Für diese Buchung steht die Zahlung weiterhin aus.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Der gehostete Checkout konnte nicht wiederhergestellt werden."); }
    finally { setRecovering(false); }
  };
  if (loadingBooking) return <ManageLoading label="Buchung wird geladen…" branding={branding} />;
  if (!booking) return <ManageFrame title="Buchung nicht verfügbar" description="Eine sichere Buchungssitzung konnte nicht verifiziert werden." branding={branding}>{error && <div className="form-error" role="alert">{error}</div>}<BookingRecoveryForm bookingId={bookingId} onAccepted={() => setError("")} /></ManageFrame>;
  if (canceled || booking.status === "CANCELLED") return <ManageOutcome title="Deine Buchung ist storniert" description={booking.refundStatus === "REFUND_PENDING" ? "Der Termin wurde freigegeben. Deine Rückerstattung beim Zahlungsanbieter ist zur Bearbeitung vorgemerkt." : booking.refundStatus === "REFUNDED" ? `Der Termin wurde freigegeben und ${(booking.refundedAmountCents / 100).toFixed(2)} ${booking.currency.toUpperCase()} wurden zurückerstattet.` : booking.refundStatus === "REFUND_FAILED" ? "Der Termin wurde freigegeben, aber die Rückerstattung erfordert die Aufmerksamkeit der Gastgeber:in." : "Der Termin wurde freigegeben und kann erneut gebucht werden."} branding={branding} />;
  return <ManageFrame title="Diese Buchung stornieren" description="Überprüfe deine Meeting-Details, bevor du stornierst." branding={branding}><BookingManageSummary booking={booking} branding={branding} /><div className="manage-form">{booking.status === "PENDING_PAYMENT" && booking.priceCents > 0 && <div className="notice notice-info"><Icon name="sparkles" /><div><strong>Der Checkout wurde unterbrochen</strong><span>Dein Termin ist weiterhin reserviert. Setze den Checkout fort oder storniere die Buchung unten.</span></div></div>}{booking.status === "PENDING_PAYMENT" && booking.priceCents > 0 && <ActionButton variant="primary" onClick={resumeCheckout} disabled={recovering}>{recovering ? "Checkout wird geöffnet…" : "Checkout fortsetzen"}</ActionButton>}<Field label="Grund für die Stornierung (optional)"><select value={reason} onChange={(item) => setReason(item.target.value)}><option value="">Wähle einen Grund</option><option>Terminkonflikt</option><option>Nicht mehr benötigt</option><option>Versehentlich gebucht</option><option>Sonstiges</option></select></Field>{booking.priceCents > 0 && booking.status !== "PENDING_PAYMENT" && <div className="notice notice-warning"><Icon name="sparkles" /><div><strong>Rückerstattung in Bearbeitung</strong><span>Beim Stornieren wird eine berechtigte Rückerstattung beim konfigurierten Zahlungsanbieter vorgemerkt. Die Bearbeitung erfolgt nicht sofort.</span></div></div>}{error && <div className="form-error" role="alert">{error}</div>}<ActionButton variant="danger" onClick={cancel} disabled={loading}>{loading ? "Wird storniert…" : "Buchung stornieren"}</ActionButton></div></ManageFrame>;
}

export function RescheduleBookingView({ bookingId, slug = "" }: { bookingId: string; slug?: string }) {
  const branding = usePublicBranding(slug);
  const [booking, setBooking] = useState<BookingSummary | null>(null);
  const [slots, setSlots] = useState<BookingSlot[]>([]);
  const [selectedStart, setSelectedStart] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [done, setDone] = useState(false);
  const [refreshedAfterSuccess, setRefreshedAfterSuccess] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [error, setError] = useState("");
  const recoveryAuthority = useRef("");
  useEffect(() => {
    let active = true;
    const load = () => {
      const recovery = retainBookingRecoveryAuthority(recoveryAuthority, () => claimOneUseLinkAuthority("recovery"));
      if (recovery) { setBooking(null); setLoadingBooking(true); setError(""); }
      const key = `${bookingId}\u0000${slug}\u0000${recovery ?? ""}`;
      const recoveryLoad = shareBookingRecoveryLoad(key, async () => {
        if (recovery) {
          let consumeFailure: unknown;
          try {
            const established = await frontendApi.consumeBookingManageLink(recovery);
            if (established.bookingId !== bookingId) throw new Error("Dieser Wiederherstellungslink passt nicht zur angeforderten Buchung.");
          } catch (reason) {
            consumeFailure = reason;
          }
          try {
            await frontendApi.getBookingForManage(bookingId);
          } catch {
            throw consumeFailure ?? new Error("Es konnte keine sichere Buchungssitzung hergestellt werden.");
          }
        }
        const item = await frontendApi.getBookingForManage(bookingId);
        await frontendApi.acknowledgeBookingManageSession(bookingId);
        const items = await loadRescheduleWindowSlots(item.id, item.bookingWindowDays, item.inviteeTimeZone, item.durationId ?? undefined);
        const nextSlots = items.filter((slot) => new Date(slot.start).getTime() !== new Date(item.startAt).getTime());
        return { item, nextSlots };
      });
      void recoveryLoad.promise.then(({ item, nextSlots }) => {
        if (!active) return;
        setBooking(item);
        setSlots(nextSlots);
        setSelectedDate(nextSlots[0] ? dateKey(nextSlots[0].start, item.inviteeTimeZone) : "");
        setDayOffset(0);
        setError("");
      }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Optionen zum Verschieben konnten nicht geladen werden."); }).finally(() => { if (active) { recoveryAuthority.current = ""; setLoadingBooking(false); } });
    };
    load();
    window.addEventListener("hashchange", load);
    return () => { active = false; window.removeEventListener("hashchange", load); };
  }, [bookingId, slug]);
  const days = useMemo(() => {
    if (!booking) return [];
    return [...new Set(slots.map((slot) => dateKey(slot.start, booking.inviteeTimeZone)))];
  }, [booking, slots]);
  const activeDate = selectedDate || days[0] || "";
  const visibleDays = days.slice(dayOffset, dayOffset + 7);
  const available = booking ? slots.filter((slot) => dateKey(slot.start, booking.inviteeTimeZone) === activeDate && new Date(slot.start).getTime() !== new Date(booking.startAt).getTime()) : [];
  const reschedule = async () => {
    if (!selectedStart) { setError("Wähle eine neue Zeit."); return; }
    if (booking && new Date(selectedStart).getTime() === new Date(booking.startAt).getTime()) { setError("Wähle eine Zeit, die sich von der aktuellen Buchung unterscheidet."); return; }
    setLoading(true); setError("");
    try {
      const preferredDate = activeDate;
      const updated = await frontendApi.rescheduleBooking(bookingId, selectedStart);
      setBooking(updated); setDone(true); setRefreshedAfterSuccess(false); setSelectedStart("");
      try {
        const refreshed = await frontendApi.getBookingForManage(bookingId);
        const nextSlots = await loadRescheduleWindowSlots(refreshed.id, refreshed.bookingWindowDays, refreshed.inviteeTimeZone, refreshed.durationId ?? undefined);
        const filteredSlots = nextSlots.filter((slot) => new Date(slot.start).getTime() !== new Date(refreshed.startAt).getTime());
        const nextDays = [...new Set(filteredSlots.map((slot) => dateKey(slot.start, refreshed.inviteeTimeZone)))];
        const nextDate = nextDays.includes(preferredDate) ? preferredDate : nextDays[0] ?? "";
        setBooking(refreshed);
        setSlots(filteredSlots);
        setSelectedDate(nextDate);
        const nextIndex = nextDays.indexOf(nextDate);
        setDayOffset(nextIndex >= 0 ? Math.floor(nextIndex / 7) * 7 : 0);
        setRefreshedAfterSuccess(true);
      } catch { setError("Die Buchung wurde verschoben, aber die aktuelle Verfügbarkeit konnte nicht geladen werden. Lade die Seite neu, bevor du eine weitere Änderung vornimmst."); }
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Diese Buchung konnte nicht verschoben werden."); }
    finally { setLoading(false); }
  };
  if (loadingBooking) return <ManageLoading label="Verfügbare Zeiten werden geladen…" branding={branding} />;
  if (!booking) return <ManageFrame title="Buchung nicht verfügbar" description="Eine sichere Buchungssitzung konnte nicht verifiziert werden." branding={branding}>{error && <div className="form-error" role="alert">{error}</div>}<BookingRecoveryForm bookingId={bookingId} onAccepted={() => setError("")} /></ManageFrame>;
  if (done) return <ManageFrame title="Dein Meeting wurde verschoben" description={`Deine neue Zeit ist ${bookingDate(booking)} um ${bookingTime(booking)} Uhr (${booking.inviteeTimeZone}).`} branding={branding}><BookingManageSummary booking={booking} branding={branding} />{error && <div className="form-error" role="alert">{error}</div>}{refreshedAfterSuccess && <ActionButton variant="secondary" onClick={() => { setDone(false); setRefreshedAfterSuccess(false); setError(""); }}>Andere Zeit wählen</ActionButton>}</ManageFrame>;
  return <ManageFrame title="Wähle eine neue Zeit" description="Deine aktuelle Zeit bleibt reserviert, bis du einen Ersatz bestätigst." branding={branding}><BookingManageSummary booking={booking} branding={branding} />{error && <div className="form-error" role="alert">{error}</div>}<div className="reschedule-picker"><div className="calendar-heading"><span>Verfügbare Termine</span><div><button type="button" className="icon-button" aria-label="Vorherige verfügbare Termine" disabled={dayOffset === 0} onClick={() => { const next = Math.max(0, dayOffset - 7); setDayOffset(next); setSelectedDate(days[next] ?? ""); setSelectedStart(""); }}><Icon name="arrow-left" /></button><button type="button" className="icon-button" aria-label="Nächste verfügbare Termine" disabled={dayOffset + 7 >= days.length} onClick={() => { const next = Math.min(dayOffset + 7, Math.max(0, days.length - 1)); setDayOffset(next); setSelectedDate(days[next] ?? ""); setSelectedStart(""); }}><Icon name="arrow-right" /></button></div></div><div className="calendar-week">{visibleDays.map((key) => { const date = new Date(`${key}T12:00:00Z`); return <button type="button" className={activeDate === key ? "is-selected" : ""} aria-pressed={activeDate === key} onClick={() => { setSelectedDate(key); setSelectedStart(""); }} key={key}><span>{new Intl.DateTimeFormat("de-DE", { weekday: "short", timeZone: booking.inviteeTimeZone }).format(date)}</span><strong>{new Intl.DateTimeFormat("de-DE", { day: "numeric", timeZone: booking.inviteeTimeZone }).format(date)}</strong></button>; })}</div><div className="time-grid">{available.map((slot) => <button type="button" className={selectedStart === slot.start ? "is-selected" : ""} aria-pressed={selectedStart === slot.start} onClick={() => setSelectedStart(slot.start)} key={slot.start}>{new Intl.DateTimeFormat("de-DE", { hour: "numeric", minute: "2-digit", timeZone: booking.inviteeTimeZone }).format(new Date(slot.start))}{selectedStart === slot.start && <Icon name="check" size={15} />}</button>)}</div>{slots.length === 0 && <div className="empty-state"><p>Derzeit sind keine Zeiten zum Verschieben verfügbar.</p></div>}<ActionButton variant="primary" className="flow-next" disabled={loading || !selectedStart} onClick={reschedule}>{loading ? "Wird verschoben…" : "Neue Zeit bestätigen"} <Icon name="arrow-right" /></ActionButton></div></ManageFrame>;
}

function BookingCard({ booking, branding }: { booking: BookingSummary; branding: WorkspaceBranding | null }) {
  return <section className="confirmation-card"><div className="confirmation-brand"><BrandLogo branding={branding} /><div><strong>{booking.eventTitleSnapshot}</strong><span>{branding?.workspaceName || "SnagTime-Buchung"}</span></div></div><dl><div><dt><Icon name="calendar" />Datum und Uhrzeit</dt><dd>{bookingDate(booking)} um {bookingTime(booking)} Uhr<small>{booking.durationMinutes} Minuten · {booking.inviteeTimeZone}</small></dd></div><div><dt><Icon name="video" />Ort</dt><dd>{bookingLocation(booking)}<small>Dein Meeting-Ort</small></dd></div><div><dt><Icon name="video" />Kalender</dt><dd>{booking.calendarSyncStatus.toLowerCase()}<small>{calendarDelivery(booking)}</small></dd></div>{booking.priceCents > 0 && <div><dt><Icon name="sparkles" />Zahlung</dt><dd>${(booking.priceCents / 100).toFixed(2)} {booking.currency.toUpperCase()}<small>{booking.status === "CONFIRMED" ? "Bestätigt" : booking.status === "PENDING_PAYMENT" ? "Zahlung ausstehend" : booking.status.replaceAll("_", " ").toLowerCase()}</small></dd></div>}</dl></section>;
}
function PaymentPending({ booking, branding, payment, slug }: { booking: BookingSummary; branding: WorkspaceBranding | null; payment?: string; slug: string }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const resume = async () => {
    setWorking(true); setError("");
    try {
      const result = await frontendApi.resumeBookingCheckout(booking.id);
      if (result.bookingId !== booking.id) throw new Error("Der wiederhergestellte Zahlungsversuch passt nicht zu dieser Buchung.");
      if (result.checkoutUrl) { window.location.assign(result.checkoutUrl); return; }
      if (result.status !== "PENDING_PAYMENT") { window.location.reload(); return; }
      setError("Der gehostete Checkout ist derzeit nicht verfügbar. Deine ausstehende Buchung wurde nicht als bestätigt angezeigt.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Der gehostete Checkout konnte nicht wiederhergestellt werden."); }
    finally { setWorking(false); }
  };
  const slugQuery = `slug=${encodeURIComponent(slug)}`;
  return <div className="public-page outcome-page"><BrandHeader branding={branding} /><main className="outcome-shell"><span className="outcome-eyebrow">Zahlung ausstehend</span><h1>{payment === "success" ? "Wir bestätigen deine Zahlung" : "Deine Buchung ist noch nicht bestätigt"}</h1><p>{payment === "success" ? "Der Checkout ist abgeschlossen. Aktualisiere gleich die Seite, während wir die Zahlung bestätigen." : "Der Checkout wurde abgebrochen oder unterbrochen. Du kannst dort weitermachen, wo du aufgehört hast."}</p><BookingCard booking={booking} branding={branding} />{error && <div className="form-error" role="alert">{error}</div>}<div className="manage-row">{payment === "success" ? <ActionButton variant="primary" onClick={() => window.location.reload()}>Zahlungsstatus aktualisieren</ActionButton> : <ActionButton variant="primary" onClick={resume} disabled={working}>{working ? "Checkout wird geöffnet…" : "Checkout fortsetzen"}</ActionButton>}<Link href={`/manage/${booking.id}/cancel?${slugQuery}`}>Buchung stornieren</Link></div><small className="reference">Buchungsreferenz · {booking.id}</small></main><PublicFooter branding={branding} /></div>;
}
function BookingManageSummary({ booking, branding }: { booking: BookingSummary; branding: WorkspaceBranding | null }) { return <div className="manage-summary"><BrandLogo branding={branding} /><div><strong>{booking.eventTitleSnapshot}</strong><span>{booking.inviteeName} · {booking.inviteeEmail}</span><small><Icon name="calendar" />{bookingDate(booking)} · {bookingTime(booking)}</small><small><Icon name="clock" />{booking.durationMinutes} Minuten · {booking.inviteeTimeZone}</small><small><Icon name="video" />{bookingLocation(booking)}</small></div></div>; }
function ManageFrame({ title, description, branding, children }: { title: string; description: string; branding: WorkspaceBranding | null; children: ReactNode }) { return <div className="public-page manage-page"><BrandHeader branding={branding} /><main className="manage-shell"><span className="outcome-eyebrow">Buchung verwalten</span><h1>{title}</h1><p>{description}</p>{children}</main><PublicFooter branding={branding} /></div>; }
function ManageLoading({ label, branding = null }: { label: string; branding?: WorkspaceBranding | null }) { return <div className="public-page manage-page"><BrandHeader branding={branding} /><main className="manage-shell" role="status"><span className="spinner" /><p>{label}</p></main><PublicFooter branding={branding} /></div>; }
function ManageRetry({ bookingId, description, onRetry, branding = null }: { bookingId: string; description: string; onRetry: () => Promise<void>; branding?: WorkspaceBranding | null }) { return <div className="public-page manage-page"><BrandHeader branding={branding} /><main className="manage-shell"><span className="outcome-eyebrow">Sichere Wiederherstellung pausiert</span><h1>Buchung nicht verifiziert</h1><p role="alert">{description}</p><p>Versuche es mit der bestehenden sicheren Sitzung erneut oder fordere einen neuen Verwaltungslink an.</p><div className="auth-actions"><ActionButton variant="primary" onClick={() => void onRetry()}>Sichere Verifizierung erneut versuchen</ActionButton></div><BookingRecoveryForm bookingId={bookingId} /></main><PublicFooter branding={branding} /></div>; }
function BookingRecoveryForm({ bookingId, onAccepted }: { bookingId: string; onAccepted?: () => void }) { const [email, setEmail] = useState(""); const [working, setWorking] = useState(false); const [accepted, setAccepted] = useState(false); const [error, setError] = useState(""); const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setWorking(true); setError(""); try { await frontendApi.requestBookingManageLink(bookingId, email.trim()); setAccepted(true); onAccepted?.(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Die Anfrage konnte nicht angenommen werden."); } finally { setWorking(false); } }; if (accepted) return <div className="notice notice-info" role="status"><Icon name="check" /><div><strong>Anfrage angenommen</strong><span>Wenn Buchung und E-Mail zu einem berechtigten Eintrag passen, werden Verwaltungsanweisungen über den konfigurierten E-Mail-Anbieter bereitgestellt. Eine Zustellung wird hier nicht zugesichert.</span></div></div>; return <form className="manage-recovery-form" onSubmit={submit}><Field label="Buchungs-E-Mail" required hint="Die Antwort bestätigt nicht, ob diese Buchung und E-Mail zusammenpassen."><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></Field>{error && <div className="form-error" role="alert">{error}</div>}<ActionButton variant="secondary" type="submit" disabled={working || !email.includes("@")} >{working ? "Wird gesendet…" : "Neuen Verwaltungslink anfordern"}</ActionButton></form>; }
function ManageError({ title, description, branding = null }: { title: string; description: string; branding?: WorkspaceBranding | null }) { return <div className="public-page manage-page"><BrandHeader branding={branding} /><main className="manage-shell"><span className="outcome-eyebrow">Fortsetzen nicht möglich</span><h1>{title}</h1><p role="alert">{description}</p></main><PublicFooter branding={branding} /></div>; }
function ManageOutcome({ title, description, branding = null }: { title: string; description: string; branding?: WorkspaceBranding | null }) { return <div className="public-page outcome-page"><BrandHeader branding={branding} /><main className="outcome-shell"><div className="success-mark" style={{ color: branding?.accentColor }}><Icon name="check" size={34} /></div><span className="outcome-eyebrow">Verifiziert</span><h1>{title}</h1><p>{description}</p></main><PublicFooter branding={branding} /></div>; }
function BrandLogo({ branding }: { branding: WorkspaceBranding | null }) { const initial = branding?.workspaceName.charAt(0).toUpperCase() || "T"; return <span className="public-logo" style={{ background: branding?.accentColor, color: foregroundForBackground(branding?.accentColor) }}>{branding?.logoUrl ? <span role="img" aria-label={`Logo von ${branding.workspaceName}`} style={{ display: "block", width: "100%", height: "100%", borderRadius: "inherit", background: `#fff center / contain no-repeat url(${JSON.stringify(branding.logoUrl)})` }} /> : initial}</span>; }
function BrandHeader({ branding }: { branding: WorkspaceBranding | null }) { return <header className="public-header"><div className="booking-brand"><BrandLogo branding={branding} /><div><strong>{branding?.workspaceName || "SnagTime"}</strong><span>{branding?.description || "Sichere Terminplanung"}</span></div></div></header>; }
function PublicFooter({ branding }: { branding: WorkspaceBranding | null }) { return <footer className="public-footer"><span>{branding?.footerText || "Bereitgestellt von SnagTime"}</span><span>Sichere Buchungsverwaltung</span></footer>; }
