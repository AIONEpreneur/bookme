"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { frontendApi } from "./api-adapter";
import { BrandMark } from "./ui";

const fallbackTimeZones = ["UTC", "America/Chicago", "America/New_York", "America/Los_Angeles", "Europe/London"];
const supportedTimeZones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : fallbackTimeZones;
const timeZones = ["UTC", ...supportedTimeZones.filter((zone) => zone !== "UTC")];

function strongPassword(value: string) {
  return value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
}

export function AccountSignup() {
  const detectedZone = useMemo(() => { const detected = Intl.DateTimeFormat().resolvedOptions().timeZone; return timeZones.includes(detected) ? detected : "UTC"; }, []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [timeZone, setTimeZone] = useState(detectedZone);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    frontendApi.session().then(({ user, workspace }) => {
      if (!active || !user) return;
      window.location.replace(workspace?.onboardingCompleted ? "/dashboard" : "/onboarding");
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const valid = name.trim().length >= 2 && workspaceName.trim().length >= 2 && email.includes("@") && strongPassword(password) && Boolean(timeZone);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid) { setError("Fülle jedes Feld aus und verwende ein Passwort, das alle Anforderungen erfüllt."); return; }
    setSubmitting(true); setError("");
    try {
      await frontendApi.signup({ name: name.trim(), email: email.trim(), password, workspaceName: workspaceName.trim(), timeZone });
      setPassword("");
      setAccepted(true);
      setSubmitting(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Die Kontoanfrage konnte nicht abgeschlossen werden.");
      setSubmitting(false);
    }
  };

  if (accepted) return <div className="auth-page"><main className="auth-card signup-card"><BrandMark /><div className="onboarding-success" aria-hidden="true">✓</div><div role="status" aria-live="polite"><span className="outcome-eyebrow">Anfrage angenommen</span><h1>Prüfe auf Anweisungen zur Bestätigung</h1><p>Deine Registrierungsanfrage wurde angenommen, und für jedes neu erstellte Konto steht die E-Mail-Bestätigung aus. Aus Datenschutzgründen bestätigt SnagTime nicht, ob ein Konto erstellt wurde oder bereits existierte.</p></div><p>Anweisungen werden ausschließlich über den konfigurierten E-Mail-Anbieter bereitgestellt. Diese Seite bestätigt keine Zustellung.</p><div className="auth-actions"><Link className="button button-primary" href="/dashboard">Zur Anmeldung</Link><Link className="button button-secondary" href="/verify-email">Bestätigung erneut anfordern</Link></div></main></div>;

  return <div className="auth-page"><main className="auth-card signup-card"><BrandMark /><div><span className="outcome-eyebrow">Erstelle deinen Workspace</span><h1>Starte deine Terminplanung mit SnagTime</h1><p>Richte deinen Workspace ein und verschicke in wenigen Minuten ansprechende Buchungslinks.</p></div><form onSubmit={submit}><div className="signup-grid"><label>Dein Name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={100} required /></label><label>E-Mail-Adresse<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label><label>Workspace-Name<input value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} autoComplete="organization" minLength={2} maxLength={100} required /></label><label>Workspace-Zeitzone<select value={timeZone} onChange={(event) => setTimeZone(event.target.value)} required>{timeZones.map((zone) => <option value={zone} key={zone}>{zone}</option>)}</select></label></div><label>Passwort<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={200} aria-describedby="signup-password-rules" required /></label><p className="password-rules" id="signup-password-rules">Verwende mindestens 12 Zeichen mit Groß- und Kleinbuchstaben, einer Zahl und einem Sonderzeichen.</p>{error && <div className="form-error" role="alert" aria-live="assertive">{error}</div>}<button className="button button-primary" type="submit" disabled={submitting || !valid}>{submitting ? "Workspace wird erstellt…" : "Workspace erstellen"}</button></form><p className="auth-switch">Du hast schon ein Konto? <Link href="/dashboard">Anmelden</Link></p></main></div>;
}
