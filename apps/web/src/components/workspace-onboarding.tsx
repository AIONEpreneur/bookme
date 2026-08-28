"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AccountSummary } from "@/lib/contracts";
import { frontendApi } from "./api-adapter";
import { Icon } from "./icons";
import { ActionButton, Badge, BrandMark } from "./ui";

export function WorkspaceOnboarding() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    frontendApi.getAccount().then((item) => {
      if (!active) return;
      if (item.workspace.onboardingCompleted) { window.location.replace("/dashboard"); return; }
      setAccount(item);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Dein Workspace konnte nicht geladen werden."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const complete = async () => {
    setCompleting(true); setError("");
    try { await frontendApi.completeOnboarding(); window.location.replace("/dashboard"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Dieser Workspace konnte nicht bestätigt werden."); setCompleting(false); }
  };

  if (loading) return <div className="auth-page"><main className="auth-card" role="status"><BrandMark /><span className="spinner" /><p>Dein Workspace wird geladen…</p></main></div>;
  if (!account) return <div className="auth-page"><main className="auth-card"><BrandMark /><div><span className="outcome-eyebrow">Workspace nicht verfügbar</span><h1>Wir konnten nicht fortfahren</h1><p role="alert">{error || "Melde dich an, um fortzufahren."}</p></div><Link className="button button-primary" href="/dashboard">Zur Anmeldung</Link></main></div>;

  return <div className="auth-page onboarding-page"><main className="auth-card onboarding-card"><BrandMark /><div className="onboarding-success"><Icon name="check" size={24} /></div><div><span className="outcome-eyebrow">Dein Workspace</span><h1>Alles sieht bereit aus</h1><p>Überprüfe die folgenden Angaben und öffne dann dein Planungs-Dashboard.</p></div><dl className="onboarding-summary"><div><dt>Workspace</dt><dd>{account.workspace.name}</dd></div><div><dt>Zeitzone</dt><dd>{account.workspace.timeZone}</dd></div><div><dt>Deine Rolle</dt><dd><Badge tone="brand">{account.workspace.role.toLowerCase()}</Badge></dd></div><div><dt>Gastgeber:in</dt><dd>{account.user.name}<small>{account.user.email}</small></dd></div></dl><div className="onboarding-next"><strong>Nächste Schritte</strong><span>Lege deine Verfügbarkeit fest, erstelle einen Buchungslink und verbinde die Tools, die du nutzt.</span></div>{error && <div className="form-error" role="alert" aria-live="assertive">{error}</div>}<ActionButton variant="primary" onClick={complete} disabled={completing}>{completing ? "Wird geöffnet…" : "Dashboard öffnen"}<Icon name="arrow-right" /></ActionButton></main></div>;
}
