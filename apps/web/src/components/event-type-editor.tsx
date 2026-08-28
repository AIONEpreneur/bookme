"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DurationOption, EventType } from "./demo-data";
import { frontendApi } from "./api-adapter";
import { foregroundForBackground } from "./brand-contrast";
import { Icon } from "./icons";
import { ActionButton, Badge, Field, Toggle } from "./ui";
import { useWorkspaceAccess } from "./workspace-access";

const defaultEvent: EventType = {
  id: "new", title: "", slug: "", description: "", color: "#2563eb", status: "draft", location: "Google Meet",
  locationType: "GOOGLE_MEET", locationValue: null,
  durations: [{ minutes: 30, label: "30 min", isDefault: true, currency: "USD" }], questions: [],
  bookingWindowDays: 60, bufferBeforeMinutes: 15, bufferAfterMinutes: 15, minimumNoticeMinutes: 240,
  bookingCount: 0, hostName: "",
};

const tabs = ["Basics", "Availability", "Questions"] as const;
const tabLabels: Record<(typeof tabs)[number], string> = { Basics: "Grundlagen", Availability: "Verfügbarkeit", Questions: "Fragen" };

export function EventTypeEditor({ eventId, mode = "edit" }: { eventId?: string; mode?: "edit" | "create" }) {
  const router = useRouter();
  const { canManage } = useWorkspaceAccess();
  const [event, setEvent] = useState(defaultEvent);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Basics");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(mode === "edit");
  const [loaded, setLoaded] = useState(mode === "create");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [persistedSlug, setPersistedSlug] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const revision = useRef(0);
  const isPaid = event.durations.some((duration) => duration.price);
  const currency = event.durations.find((duration) => duration.price)?.currency ?? event.durations[0]?.currency ?? "USD";
  const publicUrl = `/book/${event.slug || "your-link"}`;
  const locationComplete = event.locationType === "GOOGLE_MEET" || Boolean(event.locationValue?.trim());

  useEffect(() => {
    if (mode !== "edit" || !eventId) return;
    let active = true;
    const startingRevision = revision.current;
    frontendApi.getEventType(eventId).then((item) => {
      if (!active || revision.current !== startingRevision) return;
      setEvent(item);
      setPersistedSlug(item.status === "published" && item.slug ? item.slug : null);
      setLoaded(true);
    }).catch((reason) => { if (active) setSaveError(reason instanceof Error ? reason.message : "Diese Terminart konnte nicht geladen werden."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [eventId, loadAttempt, mode]);

  const update = <K extends keyof EventType>(key: K, value: EventType[K]) => { if (!loaded) return; revision.current += 1; setSaved(false); setEvent((item) => ({ ...item, [key]: value })); };
  const updateDuration = (index: number, patch: Partial<DurationOption>) => update("durations", event.durations.map((item, i) => i === index ? { ...item, ...patch, label: patch.minutes ? `${patch.minutes} min` : item.label } : patch.isDefault ? { ...item, isDefault: false } : item));
  const addDuration = () => update("durations", [...event.durations, { minutes: 60, label: "60 min", isDefault: false, currency }]);
  const canPublish = Boolean(event.title.trim() && event.slug.trim() && event.durations.length > 0 && locationComplete && (!isPaid || currency));
  const completion = useMemo(() => [Boolean(event.title), Boolean(event.slug), event.durations.length > 0, locationComplete].filter(Boolean).length, [event.title, event.slug, event.durations.length, locationComplete]);
  const moveTab = (tab: (typeof tabs)[number], direction: -1 | 1) => { const index = tabs.indexOf(tab); const next = tabs[(index + direction + tabs.length) % tabs.length]!; setActiveTab(next); window.requestAnimationFrame(() => document.getElementById(`event-tab-${next.toLowerCase()}`)?.focus()); };

  async function save(publish = false) {
    if (!loaded) return;
    setSaving(true); setSaveError("");
    const savingRevision = revision.current;
    const next = { ...event, status: publish ? "published" as const : event.status };
    try {
      const persisted = await frontendApi.saveEventType(next, mode, publish);
      setPersistedSlug(persisted.status === "published" && persisted.slug ? persisted.slug : null);
      if (revision.current === savingRevision) {
        setEvent(persisted);
        revision.current += 1;
        setSaved(true);
        window.setTimeout(() => setSaved(false), 2600);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Diese Terminart konnte nicht gespeichert werden.");
    } finally { setSaving(false); }
  }

  async function remove() {
    if (mode !== "edit" || !eventId || deleting) return;
    if (!window.confirm(`„${event.title || "Diese Terminart"}“ löschen? Bestehende Buchungen bleiben in der Historie erhalten, aber die öffentliche Buchungsseite nimmt keine Buchungen mehr an.`)) return;
    setDeleting(true); setSaveError("");
    try { await frontendApi.deleteEventType(eventId); router.replace("/event-types"); }
    catch (reason) { setSaveError(reason instanceof Error ? reason.message : "Diese Terminart konnte nicht gelöscht werden."); setDeleting(false); }
  }

  if (!canManage) return <div className="editor-page"><section className="empty-state" role="alert"><span className="empty-icon"><Icon name="x" /></span><h1>Gastgeber-Zugang erforderlich</h1><p>Deine Workspace-Rolle kann keine Terminarten erstellen oder ändern.</p><Link href="/dashboard" className="button button-secondary">Zurück zum Dashboard</Link></section></div>;
  if (mode === "edit" && loading) return <div className="editor-page"><div className="sync-note" role="status"><span className="spinner" />Terminart wird geladen…</div></div>;
  if (mode === "edit" && !loaded) return <div className="editor-page"><section className="empty-state" role="alert"><span className="empty-icon"><Icon name="x" /></span><h1>Terminart nicht verfügbar</h1><p>{saveError || "Diese Terminart konnte nicht geladen werden."}</p><ActionButton variant="primary" onClick={() => { setLoading(true); setSaveError(""); setLoadAttempt((attempt) => attempt + 1); }}>Erneut versuchen</ActionButton><Link href="/event-types" className="button button-secondary">Zurück zu den Terminarten</Link></section></div>;

  return <div className="editor-page">
    <header className="editor-topbar">
      <div className="editor-title"><Link href="/event-types" className="icon-button" aria-label="Zurück zu den Terminarten"><Icon name="arrow-left" /></Link><div><span>{mode === "create" ? "Neue Terminart" : "Terminart bearbeiten"}</span><strong>{event.title || "Unbenannter Termin"}</strong></div><Badge tone={event.status === "published" ? "success" : "neutral"} dot>{event.status === "published" ? "veröffentlicht" : event.status === "draft" ? "Entwurf" : "archiviert"}</Badge></div>
      <div className="editor-actions">{mode === "edit" && <ActionButton onClick={() => void remove()} variant="danger" disabled={deleting || saving}>{deleting ? "Wird gelöscht…" : "Löschen"}</ActionButton>}{persistedSlug ? <Link href={`/book/${persistedSlug}`} className="button button-secondary"><Icon name="external" size={16} />Veröffentlichte Seite ansehen</Link> : <button type="button" className="button button-secondary" disabled title="Speichere und veröffentliche diesen Termin, bevor du ihn ansiehst"><Icon name="external" size={16} />Vorschau nicht verfügbar</button>}{event.status !== "published" && <ActionButton onClick={() => save(false)} variant="secondary" disabled={saving || deleting}>{saving ? "Wird gespeichert…" : "Entwurf speichern"}</ActionButton>}<ActionButton onClick={() => save(true)} variant="primary" disabled={!canPublish || saving || deleting}>{saving ? "Wird gespeichert…" : event.status === "published" ? "Änderungen speichern" : "Termin veröffentlichen"}</ActionButton></div>
    </header>
    {saved && <div className="toast" role="status"><span><Icon name="check" /></span>Änderungen gespeichert</div>}
    {saveError && <div className="toast toast-error" role="alert"><span><Icon name="x" /></span>{saveError}</div>}
    <div className="editor-layout">
      <aside className="editor-progress"><div className="progress-ring" style={{ "--progress": `${completion * 25}%` } as React.CSSProperties}><strong>{completion * 25}%</strong></div><div><strong>Termin-Einrichtung</strong><span>{completion === 4 ? "Bereit zur Veröffentlichung" : `${4 - completion} ${4 - completion === 1 ? "Punkt offen" : "Punkte offen"}`}</span></div></aside>
      <section className="editor-content">
        <nav className="editor-tabs" aria-label="Termin-Einstellungen" role="tablist">{tabs.map((tab) => <button type="button" role="tab" id={`event-tab-${tab.toLowerCase()}`} aria-controls="event-settings-panel" aria-selected={activeTab === tab} tabIndex={activeTab === tab ? 0 : -1} key={tab} className={activeTab === tab ? "is-active" : ""} onClick={() => setActiveTab(tab)} onKeyDown={(event) => { if (event.key === "ArrowLeft") { event.preventDefault(); moveTab(tab, -1); } else if (event.key === "ArrowRight") { event.preventDefault(); moveTab(tab, 1); } else if (event.key === "Home") { event.preventDefault(); setActiveTab(tabs[0]); window.requestAnimationFrame(() => document.getElementById("event-tab-basics")?.focus()); } else if (event.key === "End") { event.preventDefault(); setActiveTab(tabs.at(-1)!); window.requestAnimationFrame(() => document.getElementById("event-tab-questions")?.focus()); } }}>{tabLabels[tab]}</button>)}</nav>
        <div id="event-settings-panel" role="tabpanel" aria-labelledby={`event-tab-${activeTab.toLowerCase()}`}>
        {activeTab === "Basics" && <div className="editor-sections">
          <section className="form-card"><div className="form-card-title"><span className="number-chip">1</span><div><h2>Termindetails</h2><p>Gib Gästen einen klaren Grund zu buchen.</p></div></div><div className="form-grid">
            <Field label="Terminname" required><input value={event.title} onChange={(e) => update("title", e.target.value)} placeholder="z. B. Erstgespräch" /></Field>
            <Field label="Buchungslink" required hint={publicUrl}><div className="input-prefix"><span suppressHydrationWarning>{typeof window === "undefined" ? "/book/" : `${window.location.origin}/book/`}</span><input value={event.slug} onChange={(e) => update("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="erstgespraech" /></div></Field>
            <Field label="Beschreibung"><textarea rows={4} value={event.description} onChange={(e) => update("description", e.target.value)} placeholder="Erkläre Gästen, worum es in diesem Meeting geht und wie sie sich vorbereiten können." /></Field>
            <Field label="Terminfarbe"><div className="color-options" role="radiogroup" aria-label="Terminfarbe">{["#2563eb", "#16a394", "#3978d4", "#ed7a5f", "#e2a93b", "#8f5db7"].map((color) => <button type="button" role="radio" aria-checked={event.color === color} key={color} className={event.color === color ? "is-selected" : ""} style={{ background: color, color: foregroundForBackground(color) }} onClick={() => update("color", color)} aria-label={`Farbe ${color} verwenden`}><Icon name="check" size={14} /></button>)}</div></Field>
          </div></section>
          <section className="form-card"><div className="form-card-title"><span className="number-chip">2</span><div><h2>Dauer-Optionen</h2><p>Gäste wählen eine Dauer, bevor sie die Verfügbarkeit sehen.</p></div></div><div className="duration-list" role="radiogroup" aria-label="Standarddauer">
            {event.durations.map((duration, index) => <div className="duration-row" key={duration.id ?? `new-${index}`}>
              <button type="button" role="radio" aria-checked={duration.isDefault} className={`radio ${duration.isDefault ? "is-selected" : ""}`} aria-label={`${duration.label} als Standard festlegen`} onClick={() => updateDuration(index, { isDefault: true })}><span /></button>
              <div className="duration-input"><input aria-label={`Dauer ${index + 1} in Minuten`} type="number" min="15" max="480" value={duration.minutes} onChange={(e) => updateDuration(index, { minutes: Number(e.target.value) })} /><span>Minuten</span></div>
              <select aria-label={`Zahlungsart für ${duration.label}`} value={duration.price ? "paid" : "free"} onChange={(e) => updateDuration(index, { price: e.target.value === "paid" ? 250 : undefined, currency })}><option value="free">Kostenlos</option><option value="paid">Kostenpflichtig</option></select>
              {duration.price ? <div className="money-input"><span>$</span><input aria-label={`Preis für ${duration.label}`} type="number" value={duration.price} onChange={(e) => updateDuration(index, { price: Number(e.target.value) })} /></div> : <span className="muted">Keine Zahlung</span>}
              <button type="button" className="icon-button" onClick={() => event.durations.length > 1 && update("durations", event.durations.filter((_, i) => i !== index))} aria-label={`${duration.label} entfernen`} disabled={event.durations.length === 1}><Icon name="trash" /></button>
              {duration.isDefault && <Badge tone="brand">Standard</Badge>}
            </div>)}
            <button type="button" className="add-row" onClick={addDuration}><Icon name="plus" />Weitere Dauer hinzufügen</button>
          </div>{isPaid && <div className="inline-fields"><Field label="Währung des Angebots" required><select value={currency} onChange={(e) => update("durations", event.durations.map((duration) => ({ ...duration, currency: e.target.value })))}><option>USD</option><option>CAD</option><option>GBP</option><option>EUR</option></select></Field><div className="notice notice-info"><Icon name="sparkles" /><div><strong>Der Zahlungsanbieter wird serverseitig verwaltet</strong><span>Veröffentlichung und Checkout unterliegen weiterhin der verifizierten Server-Konfiguration.</span></div></div></div>}</section>
          <section className="form-card"><div className="form-card-title"><span className="number-chip">3</span><div><h2>Ort</h2><p>Lege fest, wo das Meeting stattfindet, und gib die Details an, die Gäste brauchen.</p></div></div><Field label="Ort" required><select value={event.locationType} onChange={(item) => { const locationType = item.target.value as EventType["locationType"]; update("locationType", locationType); update("locationValue", locationType === "GOOGLE_MEET" ? null : event.locationValue); update("location", locationType === "GOOGLE_MEET" ? "Google Meet" : event.locationValue || (locationType === "PHONE" ? "Telefonanruf" : locationType === "IN_PERSON" ? "Vor Ort" : "Individueller Ort")); }}><option value="GOOGLE_MEET">Google Meet</option><option value="PHONE">Telefonanruf</option><option value="IN_PERSON">Vor Ort</option><option value="CUSTOM">Individuell</option></select></Field>{event.locationType !== "GOOGLE_MEET" && <Field label={event.locationType === "PHONE" ? "Telefonhinweise" : event.locationType === "IN_PERSON" ? "Meeting-Adresse" : "Ortsdetails"} required hint="Diese Details werden mit der Buchung gespeichert und Gästen angezeigt."><input value={event.locationValue ?? ""} onChange={(item) => { update("locationValue", item.target.value); update("location", item.target.value || (event.locationType === "PHONE" ? "Telefonanruf" : event.locationType === "IN_PERSON" ? "Vor Ort" : "Individueller Ort")); }} required /></Field>}</section>
        </div>}
        {activeTab === "Availability" && <div className="editor-sections"><section className="form-card"><div className="form-card-title"><span className="number-chip">1</span><div><h2>Wann kann man buchen?</h2><p>Deine wöchentlichen Zeiten werden mit diesen terminspezifischen Regeln kombiniert.</p></div></div><div className="two-column"><Field label="Buchungsfenster"><select value={event.bookingWindowDays} onChange={(e) => update("bookingWindowDays", Number(e.target.value))}>{![30, 60, 90].includes(event.bookingWindowDays) && <option value={event.bookingWindowDays}>{event.bookingWindowDays} Tage im Voraus</option>}<option value={30}>30 Tage im Voraus</option><option value={60}>60 Tage im Voraus</option><option value={90}>90 Tage im Voraus</option></select></Field><Field label="Mindestvorlauf"><select value={event.minimumNoticeMinutes} onChange={(e) => update("minimumNoticeMinutes", Number(e.target.value))}>{![0, 240, 1440, 2880].includes(event.minimumNoticeMinutes) && <option value={event.minimumNoticeMinutes}>{event.minimumNoticeMinutes} Minuten</option>}<option value={0}>Kein Mindestvorlauf</option><option value={240}>4 Stunden</option><option value={1440}>24 Stunden</option><option value={2880}>48 Stunden</option></select></Field><Field label="Pufferzeit davor"><select value={event.bufferBeforeMinutes} onChange={(e) => update("bufferBeforeMinutes", Number(e.target.value))}>{![0, 15, 30, 60].includes(event.bufferBeforeMinutes) && <option value={event.bufferBeforeMinutes}>{event.bufferBeforeMinutes} Minuten</option>}<option value={0}>Keine Pufferzeit</option><option value={15}>15 Minuten</option><option value={30}>30 Minuten</option><option value={60}>60 Minuten</option></select></Field><Field label="Pufferzeit danach"><select value={event.bufferAfterMinutes} onChange={(e) => update("bufferAfterMinutes", Number(e.target.value))}>{![0, 15, 30, 60].includes(event.bufferAfterMinutes) && <option value={event.bufferAfterMinutes}>{event.bufferAfterMinutes} Minuten</option>}<option value={0}>Keine Pufferzeit</option><option value={15}>15 Minuten</option><option value={30}>30 Minuten</option><option value={60}>60 Minuten</option></select></Field></div><div className="notice notice-info"><Icon name="availability" /><div><strong>Wöchentliche Zeiten und Datumsausnahmen</strong><span>Verwalte deinen Basis-Zeitplan auf der Seite „Verfügbarkeit“.</span></div></div></section></div>}
        {activeTab === "Questions" && <div className="editor-sections"><section className="form-card"><div className="form-card-title"><span className="number-chip">1</span><div><h2>Fragen an Gäste</h2><p>Name und E-Mail werden immer erfasst. Ergänze den Kontext, den du brauchst.</p></div></div><div className="question-list"><div className="question-row"><span className="drag-handle">⋮⋮</span><div><strong>Name</strong><span>Kurze Antwort · Pflicht</span></div><Badge tone="neutral">System</Badge></div><div className="question-row"><span className="drag-handle">⋮⋮</span><div><strong>E-Mail</strong><span>E-Mail · Pflicht</span></div><Badge tone="neutral">System</Badge></div>{event.questions.map((question, index) => <div className="question-row" key={question.id ?? `${question.label}-${index}`}><span className="drag-handle">⋮⋮</span><div><input value={question.label} onChange={(item) => update("questions", event.questions.map((current, position) => position === index ? { ...current, label: item.target.value } : current))} aria-label={`Frage ${index + 1}`} /><span>{question.kind === "TEXTAREA" ? "Lange Antwort" : "Kurze Antwort"} · {question.required ? "Pflicht" : "Optional"}</span></div><Toggle checked={question.required} onChange={(required) => update("questions", event.questions.map((current, position) => position === index ? { ...current, required } : current))} label={`${question.label} als Pflichtfrage festlegen`} /><button className="icon-button" onClick={() => update("questions", event.questions.filter((_, position) => position !== index))} aria-label={`${question.label} entfernen`}><Icon name="trash" /></button></div>)}<button className="add-row" onClick={() => update("questions", [...event.questions, { label: "Was sollten wir vor dem Meeting wissen?", kind: "TEXTAREA", required: false, options: [] }])}><Icon name="plus" />Frage hinzufügen</button></div></section></div>}
        </div>
      </section>
      <aside className="editor-preview"><span className="preview-label">Live-Vorschau</span><div className="mini-booking-card"><div className="mini-brand"><span className="mini-logo">T</span><strong>Workspace-Branding</strong></div><span className="mini-host">Gastgeber:in</span><h2>{event.title || "Dein Termintitel"}</h2><p>{event.description || "Eine klare, hilfreiche Beschreibung dessen, was Gäste erwartet."}</p><div className="mini-meta"><span><Icon name="clock" />{event.durations.map((d) => d.label).join(" or ")}</span><span><Icon name="video" />{event.location}</span><span><Icon name="globe" />Zeitzone des Gasts</span></div><button type="button" disabled aria-label="Nur Vorschau">Wähle eine Zeit <Icon name="arrow-right" /></button></div><small>Änderungen erscheinen hier, während du bearbeitest.</small></aside>
    </div>
  </div>;
}
