"use client";

import { useEffect, useState } from "react";
import type { LocalInboxMessage } from "@/lib/contracts";
import { frontendApi } from "./api-adapter";
import { Icon } from "./icons";
import { ActionButton, Badge, PageHeader } from "./ui";
import { useWorkspaceAccess } from "./workspace-access";

type IntegrationStatus = Awaited<ReturnType<typeof frontendApi.getIntegrationStatus>>;
function inboxAction(message: LocalInboxMessage) { const match = message.text.match(/https?:\/\/\S+/); if (!match) return null; try { const url = new URL(match[0]); const label = url.pathname === "/verify-email" ? "E-Mail bestätigen" : url.pathname === "/reset-password" ? "Passwort zurücksetzen" : url.pathname === "/invite/accept" ? "Einladung annehmen" : url.pathname.includes("/manage/") ? "Buchungsverwaltung öffnen" : "Aktion öffnen"; return { href: url.toString(), label }; } catch { return null; } }
function GoogleCalendarLogo() { return <svg viewBox="0 0 40 40" aria-hidden="true"><rect x="3" y="3" width="34" height="34" rx="7" fill="#fff"/><path fill="#4285f4" d="M3 12h34v18l-7 7H10a7 7 0 0 1-7-7V12Z"/><path fill="#34a853" d="M3 25h12v12h-5a7 7 0 0 1-7-7v-5Z"/><path fill="#fbbc04" d="M30 25h7v5a7 7 0 0 1-7 7v-12Z"/><path fill="#ea4335" d="M10 3h20a7 7 0 0 1 7 7v3H3v-3a7 7 0 0 1 7-7Z"/><text x="20" y="28" textAnchor="middle" fill="#fff" fontSize="15" fontWeight="800" fontFamily="Arial,sans-serif">31</text></svg>; }
function StripeLogo() { return <svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#635bff"/><text x="20" y="24" textAnchor="middle" fill="#fff" fontSize="10.5" fontWeight="800" fontStyle="italic" fontFamily="Arial,sans-serif">stripe</text></svg>; }
function DeliveryLogo() { return <svg viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="8" fill="#123f46"/><path d="M10.5 13.5h19v14h-19z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round"/><path d="m11.5 15 8.5 7 8.5-7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><circle cx="30" cy="10" r="4" fill="#78d4c3"/></svg>; }

export function IntegrationsView() {
  const { canManage } = useWorkspaceAccess();
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [inbox, setInbox] = useState<LocalInboxMessage[] | null>(null);
  const [retryingEmail, setRetryingEmail] = useState(false);
  const load = () => frontendApi.getIntegrationStatus().then(setStatus).catch((reason) => setError(reason instanceof Error ? reason.message : "Der Integrationsstatus konnte nicht geladen werden.")).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => { frontendApi.listLocalEmailInbox().then(setInbox).catch(() => setInbox(null)); }, []);
  const connect = async () => {
    setWorking(true); setError("");
    try {
      const response = await fetch(frontendApi.googleAuthorizePath, { method: "POST", credentials: "same-origin", headers: { accept: "application/json" } });
      const body = await response.json() as { data?: { authorizationUrl?: string }; error?: { message?: string } };
      const authorizationUrl = body.data?.authorizationUrl;
      if (!response.ok || !authorizationUrl) throw new Error(body.error?.message || "Die Google-Autorisierung konnte nicht gestartet werden.");
      window.location.assign(authorizationUrl);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Die Google-Autorisierung konnte nicht gestartet werden."); setWorking(false); }
  };
  const disconnect = async () => {
    setWorking(true); setError("");
    try { await frontendApi.disconnectGoogle(); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Google Kalender konnte nicht getrennt werden."); }
    finally { setWorking(false); }
  };
  const retryEmail = async () => { setRetryingEmail(true); setError(""); try { await frontendApi.retryEmailOutbox(); setInbox(await frontendApi.listLocalEmailInbox()); } catch (reason) { setError(reason instanceof Error ? reason.message : "Der lokale E-Mail-Postausgang konnte nicht erneut verarbeitet werden."); } finally { setRetryingEmail(false); } };
  const google = status?.google ?? null;
  const stripe = status?.stripe ?? null;
  const outboxWorker = status?.outboxWorker ?? null;
  const localFallback = Boolean(google && google.requestedProvider === "google" && google.provider === "local");
  const reconnectRequired = Boolean(google && google.requestedProvider === "google" && google.scopeHealth === "insufficient");
  const googleUnavailable = Boolean(google && google.requestedProvider === "google" && google.scopeHealth === "unavailable");
  return <div className="page-stack">
    <PageHeader title="Integrationen" description="Verbinde die Dienste für Terminplanung, Zahlungen und Zustellung." />
    {loading && <div className="sync-note" role="status"><span className="spinner" />Integrationen werden geladen…</div>}
    {error && <div className="toast toast-error" role="alert"><span><Icon name="x" /></span>{error}</div>}
    <div className="integration-groups"><section><div className="group-title"><h2>Kalender</h2><span>1 Integration</span></div><div className="integration-grid">
      <article className="integration-card"><div className="integration-mark mark-google"><GoogleCalendarLogo /></div><div className="integration-copy"><div><h3>Google Kalender</h3>{google && <Badge tone={google.disconnectPending || reconnectRequired || googleUnavailable || localFallback ? "warning" : google.connected ? "success" : google.configured ? "neutral" : "warning"} dot>{google.disconnectPending ? "Trennung ausstehend" : reconnectRequired ? "Neu verbinden erforderlich" : googleUnavailable ? "Nicht verfügbar" : localFallback ? "Getrennt" : google.connected ? "Verbunden" : google.configured ? "Verfügbar" : "Nicht konfiguriert"}</Badge>}</div><p>{google?.connected && google.provider === "google" ? "Konfliktprüfung und Buchungsaktualisierungen sind bereit." : reconnectRequired ? "Verbinde Google Kalender neu, um Konfliktprüfung und Terminaktualisierungen wiederherzustellen." : googleUnavailable ? "Google Kalender war nicht erreichbar. Neue Buchungen pausieren, bis der Zugriff wiederhergestellt ist." : localFallback ? "Verbinde Google Kalender, um Konflikte zu prüfen und Termine automatisch hinzuzufügen." : "Verbinde Google Kalender, um Verfügbarkeit und Termine synchron zu halten."}</p>{google && <span className="integration-detail">{google.connected ? `Kalender ${google.calendarId} · ${google.scopeHealth === "complete" ? "Voller Kalenderzugriff" : "Zugriff erfordert Aufmerksamkeit"}` : google.missingScopes.length ? `${google.missingScopes.length} ${google.missingScopes.length === 1 ? "Berechtigung" : "Berechtigungen"} erforderlich` : "Kein Kalender verbunden"}</span>}</div>{canManage && (google?.disconnectPending ? <ActionButton variant="secondary" disabled>Trennung ausstehend</ActionButton> : google?.connected ? google.disconnectSupported ? <ActionButton variant="secondary" onClick={disconnect} disabled={working}>{working ? "Wird getrennt…" : "Trennen"}</ActionButton> : <Badge tone="neutral">Extern verwaltet</Badge> : <ActionButton variant="primary" onClick={connect} disabled={working || !google?.configured}>{working ? "Wird geöffnet…" : reconnectRequired ? "Neu verbinden" : "Verbinden"}</ActionButton>)}</article>
    </div></section><section><div className="group-title"><h2>Zahlungen</h2><span>Test-Checkout</span></div><div className="integration-grid"><article className="integration-card"><div className="integration-mark mark-stripe"><StripeLogo /></div><div className="integration-copy"><div><h3>Stripe</h3>{stripe && <Badge tone={stripe.configured ? "success" : "warning"} dot>{stripe.configured ? "Testmodus bereit" : "Einrichtung erforderlich"}</Badge>}</div><p>{stripe?.configured ? "Der Test-Checkout ist für kostenpflichtige Terminarten bereit." : "Hinterlege deine Stripe-Testzugangsdaten, bevor du kostenpflichtige Terminarten veröffentlichst."}</p>{stripe && <span className="integration-detail">{stripe.mode === "test" ? "Nur Testzahlungen" : stripe.mode}</span>}</div></article></div></section>
    <section><div className="group-title"><h2>Zustellung</h2><span>Hintergrundverarbeitung</span></div><div className="integration-grid"><article className="integration-card"><div className="integration-mark mark-worker"><DeliveryLogo /></div><div className="integration-copy"><div><h3>Buchungszustellung</h3>{outboxWorker && <Badge tone={outboxWorker.enabled ? "success" : "warning"} dot>{outboxWorker.enabled ? "Läuft" : "Pausiert"}</Badge>}</div><p>{outboxWorker?.enabled ? "Kalenderänderungen und Buchungs-E-Mails werden im Hintergrund verarbeitet." : "Die Hintergrundzustellung ist pausiert. Ausstehende Aktualisierungen warten, bis sie aktiviert wird."}</p></div></article></div></section>{inbox && <section><div className="group-title"><h2>Demo-Posteingang</h2><span>Lokale Vorschau</span></div><div className="panel local-inbox"><div className="settings-heading"><div><h3>E-Mail-Vorschauen</h3><p>Sieh dir die von dieser lokalen Demo erzeugten E-Mails an, ohne sie extern zu versenden.</p></div>{canManage && <ActionButton variant="secondary" onClick={retryEmail} disabled={retryingEmail}>{retryingEmail ? "Wird wiederholt…" : "Ausstehende wiederholen"}</ActionButton>}</div><div className="inbox-list">{inbox.map((message) => { const action = inboxAction(message); return <article className="inbox-message" key={message.id}><div><strong>{message.subject}</strong><span>{message.recipientEmail} · {new Date(message.createdAt).toLocaleString("de-DE")}</span></div>{action ? <button className="button button-secondary button-sm" type="button" onClick={() => window.location.assign(action.href)}>{action.label}</button> : <Badge tone="neutral">Keine Aktion</Badge>}</article>; })}{inbox.length === 0 && <p className="muted">Noch keine E-Mail-Vorschauen.</p>}</div></div></section>}</div>
  </div>;
}
