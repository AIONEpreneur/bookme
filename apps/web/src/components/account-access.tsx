"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { SnagTimeApiError } from "@/lib/api-client";
import { frontendApi } from "./api-adapter";
import { claimOneUseLinkAuthority, shareOneUseAction } from "./one-use-link-authority";
import { BrandMark } from "./ui";

const strongPassword = (value: string) => value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

function AccessFrame({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: ReactNode }) {
  return <div className="auth-page"><main className="auth-card recovery-card"><BrandMark /><div><span className="outcome-eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{children}</main></div>;
}

function GenericRequestForm({ kind }: { kind: "password" | "verification" }) {
  const [email, setEmail] = useState("");
  const [working, setWorking] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setWorking(true); setError("");
    try {
      if (kind === "password") await frontendApi.requestPasswordReset(email.trim());
      else await frontendApi.requestEmailVerification(email.trim());
      setAccepted(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Die Anfrage konnte nicht angenommen werden."); }
    finally { setWorking(false); }
  };
  if (accepted) return <div className="recovery-result" role="status" aria-live="polite"><strong>Anfrage angenommen</strong><p>Wenn die Adresse berechtigt ist, stellt SnagTime Anweisungen über den konfigurierten E-Mail-Anbieter bereit. Diese Seite bestätigt weder ein Konto noch eine Zustellung.</p><Link className="button button-primary" href="/dashboard">Zurück zur Anmeldung</Link></div>;
  return <form onSubmit={submit}><label>E-Mail-Adresse<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>{error && <div className="form-error" role="alert" aria-live="assertive">{error}</div>}<button className="button button-primary" type="submit" disabled={working || !email.includes("@")}>{working ? "Wird gesendet…" : kind === "password" ? "Anweisungen zum Zurücksetzen anfordern" : "Anweisungen zur Bestätigung anfordern"}</button></form>;
}

export function ForgotPasswordView() {
  return <AccessFrame eyebrow="Kontowiederherstellung" title="Setze dein Passwort zurück" description="Gib deine E-Mail-Adresse ein. Die Antwort ist identisch, unabhängig davon, ob ein berechtigtes Konto existiert."><GenericRequestForm kind="password" /><p className="auth-switch"><Link href="/dashboard">Zurück zur Anmeldung</Link></p></AccessFrame>;
}

export function ResetPasswordView() {
  const [authority, setAuthority] = useState("");
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [working, setWorking] = useState(false);
  const [reset, setReset] = useState(false);
  const [error, setError] = useState("");
  const started = useRef(false);
  useEffect(() => {
    const claim = () => {
      const claimed = claimOneUseLinkAuthority("token");
      setAuthority(claimed);
      setError(claimed ? "" : "Dieser Link zum Zurücksetzen des Passworts ist unvollständig.");
      setPassword(""); setReset(false); setReady(true);
    };
    if (!started.current) { started.current = true; claim(); }
    window.addEventListener("hashchange", claim);
    return () => window.removeEventListener("hashchange", claim);
  }, []);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authority || !strongPassword(password)) { setError("Verwende einen vollständigen Link zum Zurücksetzen und ein Passwort, das alle Anforderungen erfüllt."); return; }
    setWorking(true); setError("");
    try { await shareOneUseAction("password-reset", authority, () => frontendApi.resetPassword(authority, password)); setPassword(""); setReset(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Dieser Link ist ungültig oder abgelaufen."); }
    finally { setWorking(false); }
  };
  if (!ready) return <AccessFrame eyebrow="Kontowiederherstellung" title="Zurücksetzen wird vorbereitet" description="Die einmalige Berechtigung wird aus der Browser-Adresse entfernt."><div className="sync-note" role="status"><span className="spinner" />Wird vorbereitet…</div></AccessFrame>;
  if (reset) return <AccessFrame eyebrow="Passwort zurückgesetzt" title="Passwort aktualisiert" description="Dein Passwort wurde zurückgesetzt und bisherige Sitzungen wurden beendet. Melde dich mit dem neuen Passwort erneut an."><Link className="button button-primary" href="/dashboard">Anmelden</Link></AccessFrame>;
  return <AccessFrame eyebrow="Kontowiederherstellung" title="Wähle ein neues Passwort" description="Die einmalige Berechtigung wurde aus der Browser-Adresse entfernt, bevor dieses Formular angezeigt wurde."><form onSubmit={submit}><label>Neues Passwort<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={200} aria-describedby="reset-password-rules" required /></label><p className="password-rules" id="reset-password-rules">Verwende mindestens 12 Zeichen mit Groß- und Kleinbuchstaben, einer Zahl und einem Sonderzeichen.</p>{error && <div className="form-error" role="alert" aria-live="assertive">{error}</div>}<button className="button button-primary" type="submit" disabled={working || !authority || !strongPassword(password)}>{working ? "Wird zurückgesetzt…" : "Passwort zurücksetzen"}</button></form><p className="auth-switch"><Link href="/forgot-password">Neuen Link anfordern</Link></p></AccessFrame>;
}

export function VerifyEmailView() {
  const started = useRef(false);
  const [status, setStatus] = useState<"booting" | "idle" | "working" | "verified" | "error">("booting");
  const [error, setError] = useState("");
  useEffect(() => {
    const verify = () => {
      const authority = claimOneUseLinkAuthority("token");
      if (!authority) { queueMicrotask(() => setStatus("idle")); return; }
      queueMicrotask(() => { setError(""); setStatus("working"); });
      void shareOneUseAction("email-verification", authority, () => frontendApi.verifyEmail(authority)).then(() => setStatus("verified")).catch((reason) => { setError(reason instanceof Error ? reason.message : "Dieser Link ist ungültig oder abgelaufen."); setStatus("error"); });
    };
    if (!started.current) { started.current = true; verify(); }
    window.addEventListener("hashchange", verify);
    return () => window.removeEventListener("hashchange", verify);
  }, []);
  if (status === "booting" || status === "working") return <AccessFrame eyebrow="E-Mail-Bestätigung" title="Deine E-Mail wird bestätigt" description="Die einmalige Berechtigung wird aus der Browser-Adresse entfernt, bevor die Bestätigung beginnt."><div className="sync-note" role="status"><span className="spinner" />Wird bestätigt…</div></AccessFrame>;
  if (status === "idle") return <AccessFrame eyebrow="E-Mail-Bestätigung" title="Anweisungen zur Bestätigung anfordern" description="Gib deine Adresse ein. Die Antwort verrät nicht, ob ein Konto existiert oder eine Bestätigung erfordert."><GenericRequestForm kind="verification" /><p className="auth-switch"><Link href="/dashboard">Zurück zur Anmeldung</Link></p></AccessFrame>;
  if (status === "verified") return <AccessFrame eyebrow="E-Mail bestätigt" title="Deine E-Mail ist bestätigt" description="Du kannst dich jetzt im Workspace anmelden, der für diese Adresse erstellt wurde."><Link className="button button-primary" href="/dashboard">Anmelden</Link></AccessFrame>;
  return <AccessFrame eyebrow="Bestätigung nicht möglich" title="Dieser Link kann nicht verwendet werden" description="Bestätigungslinks sind nur einmal gültig und laufen ab."><div className="form-error" role="alert">{error}</div><Link className="button button-secondary" href="/verify-email">Neuen Link anfordern</Link></AccessFrame>;
}

export function AcceptInvitationView() {
  const authority = useRef("");
  const [status, setStatus] = useState<"working" | "login" | "accepted" | "error">("working");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const started = useRef(false);
  const accept = useCallback(async () => {
    if (!authority.current) return;
    setStatus("working"); setError("");
    try { await shareOneUseAction("workspace-invitation", authority.current, () => frontendApi.acceptWorkspaceInvitation(authority.current)); setStatus("accepted"); }
    catch (reason) {
      if (reason instanceof SnagTimeApiError && reason.status === 401) { setStatus("login"); return; }
      setError(reason instanceof Error ? reason.message : "Diese Einladung ist ungültig oder abgelaufen."); setStatus("error");
    }
  }, []);
  useEffect(() => {
    const claim = () => {
      authority.current = claimOneUseLinkAuthority("token");
      if (!authority.current) { setError("Dieser Einladungslink ist unvollständig."); setStatus("error"); return; }
      void accept();
    };
    if (!started.current) { started.current = true; claim(); }
    window.addEventListener("hashchange", claim);
    return () => window.removeEventListener("hashchange", claim);
  }, [accept]);
  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    try { await frontendApi.login(email, password); setPassword(""); await accept(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Anmeldung fehlgeschlagen."); setStatus("login"); }
  };
  if (status === "working") return <AccessFrame eyebrow="Workspace-Einladung" title="Deine Einladung wird geprüft" description="Die einmalige Berechtigung wurde aus der Browser-Adresse entfernt."><div className="sync-note" role="status"><span className="spinner" />Wird geprüft…</div></AccessFrame>;
  if (status === "accepted") return <AccessFrame eyebrow="Einladung angenommen" title="Du bist dabei" description="Dieser Workspace ist jetzt über dein Konto verfügbar."><Link className="button button-primary" href="/dashboard">SnagTime öffnen</Link></AccessFrame>;
  if (status === "login") return <AccessFrame eyebrow="Workspace-Einladung" title="Melde dich an, um fortzufahren" description="Verwende das bestätigte Konto, das zur Einladung passt. Die Berechtigung verbleibt nur im Speicher dieser Seite."><form onSubmit={login}><label>E-Mail-Adresse<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required /></label><label>Passwort<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>{error && <div className="form-error" role="alert">{error}</div>}<button className="button button-primary" type="submit">Anmelden und annehmen</button></form></AccessFrame>;
  return <AccessFrame eyebrow="Annahme nicht möglich" title="Diese Einladung kann nicht verwendet werden" description="Einladungslinks sind an ein bestätigtes Konto gebunden, nur einmal gültig und laufen ab."><div className="form-error" role="alert">{error}</div><Link className="button button-secondary" href="/dashboard">Zur Anmeldung</Link></AccessFrame>;
}
