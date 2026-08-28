"use client";
/* eslint-disable @next/next/no-img-element -- persisted external workspace logos cannot use a fixed Next image host allowlist */

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { AccountSummary, WorkspaceBranding, WorkspaceInvitation } from "@/lib/contracts";
import { frontendApi } from "./api-adapter";
import { foregroundForBackground } from "./brand-contrast";
import { Icon } from "./icons";
import { ActionButton, Avatar, Badge, Field, PageHeader } from "./ui";

const emptyBranding: WorkspaceBranding = { workspaceName: "", logoUrl: null, accentColor: "#2563eb", description: null, footerText: null };
const acceptedLogoTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
const maxLogoSourceBytes = 5 * 1024 * 1024;
const maxStoredLogoCharacters = 700_000;

async function optimizeLogo(file: File) {
  if (!acceptedLogoTypes.has(file.type)) throw new Error("Wähle ein Logo als PNG, JPG oder WebP.");
  if (file.size > maxLogoSourceBytes) throw new Error("Wähle ein Logo, das kleiner als 5 MB ist.");
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image(); image.decoding = "async";
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Dieses Bild konnte nicht gelesen werden.")); image.src = objectUrl; });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth > 8192 || image.naturalHeight > 8192) throw new Error("Wähle ein gültiges Logo mit höchstens 8192 × 8192 Pixeln.");
    const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d"); if (!context) throw new Error("Dieser Browser kann das Logo nicht aufbereiten.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.88, 0.72, 0.56]) {
      const dataUrl = canvas.toDataURL("image/webp", quality);
      if (dataUrl.startsWith("data:image/webp;base64,") && dataUrl.length <= maxStoredLogoCharacters) return dataUrl;
    }
    throw new Error("Das optimierte Logo ist immer noch zu groß. Wähle ein einfacheres Bild.");
  } finally { URL.revokeObjectURL(objectUrl); }
}

export function SettingsView() {
  const [branding, setBranding] = useState<WorkspaceBranding>(emptyBranding);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [inviting, setInviting] = useState(false);
  const [inviteMessage, setInviteMessage] = useState("");
  const [logoProcessing, setLogoProcessing] = useState(false);
  const [logoFileName, setLogoFileName] = useState("");
  const [profileProcessing, setProfileProcessing] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [memberWorkingId, setMemberWorkingId] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);
  const profileInputRef = useRef<HTMLInputElement>(null);
  const editRevision = useRef(0);
  const loadRevision = useRef(0);
  const [error, setError] = useState("");
  const loadSettings = useCallback(() => {
    const requestRevision = ++loadRevision.current;
    const startingEditRevision = editRevision.current;
    return Promise.all([frontendApi.getWorkspaceBranding(), frontendApi.getAccount()]).then(([workspaceBranding, summary]) => {
      if (loadRevision.current !== requestRevision || editRevision.current !== startingEditRevision) return;
      setBranding(workspaceBranding); setAccount(summary); setDirty(false); setLoadState("loaded");
    }).catch((reason) => { if (loadRevision.current === requestRevision) { setError(reason instanceof Error ? reason.message : "Workspace-Einstellungen konnten nicht geladen werden."); setLoadState("error"); } });
  }, []);
  useEffect(() => { void loadSettings(); return () => { loadRevision.current += 1; }; }, [loadAttempt, loadSettings]);
  useEffect(() => { if (!account || account.workspace.role === "MEMBER") return; frontendApi.listWorkspaceInvitations().then(setInvitations).catch((reason) => setError(reason instanceof Error ? reason.message : "Workspace-Einladungen konnten nicht geladen werden.")); }, [account]);
  const patch = <K extends keyof WorkspaceBranding>(key: K, value: WorkspaceBranding[K]) => { if (loadState !== "loaded") return; editRevision.current += 1; setDirty(true); setSaved(false); setBranding((current) => ({ ...current, [key]: value })); };
  const uploadLogo = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setLogoProcessing(true); setError("");
    try { patch("logoUrl", await optimizeLogo(file)); setLogoFileName(file.name); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Das Logo konnte nicht aufbereitet werden."); }
    finally { setLogoProcessing(false); event.target.value = ""; }
  };
  const removeLogo = () => { patch("logoUrl", null); setLogoFileName(""); if (logoInputRef.current) logoInputRef.current.value = ""; };
  const persistProfileImage = async (imageUrl: string | null) => {
    setProfileProcessing(true); setProfileMessage(""); setError("");
    try {
      const user = await frontendApi.updateProfileImage({ imageUrl });
      setAccount((current) => current ? { ...current, user } : current);
      window.dispatchEvent(new CustomEvent("snagtime:profile-image", { detail: user }));
      setProfileMessage(imageUrl ? "Profilfoto aktualisiert." : "Profilfoto entfernt. Stattdessen werden Initialen angezeigt.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Dein Profilfoto konnte nicht aktualisiert werden."); }
    finally { setProfileProcessing(false); if (profileInputRef.current) profileInputRef.current.value = ""; }
  };
  const uploadProfileImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    setProfileProcessing(true); setProfileMessage(""); setError("");
    try { await persistProfileImage(await optimizeLogo(file)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Das Profilfoto konnte nicht aufbereitet werden."); setProfileProcessing(false); event.target.value = ""; }
  };
  const save = async () => {
    if (loadState !== "loaded" || !dirty) return;
    const submittedRevision = editRevision.current;
    const submittedBranding = branding;
    setSaving(true); setError("");
    try {
      const persisted = await frontendApi.updateWorkspaceBranding(submittedBranding);
      if (editRevision.current !== submittedRevision) return;
      setBranding(persisted); setDirty(false);
      setAccount((current) => current ? { ...current, workspace: { ...current.workspace, name: persisted.workspaceName }, workspaces: current.workspaces.map((workspace) => workspace.id === current.workspace.id ? { ...workspace, name: persisted.workspaceName } : workspace) } : current);
      window.dispatchEvent(new CustomEvent("snagtime:workspace-branding", { detail: { workspaceName: persisted.workspaceName, logoUrl: persisted.logoUrl } }));
      setSaved(true); window.setTimeout(() => setSaved(false), 2200);
    }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Workspace-Einstellungen konnten nicht gespeichert werden."); }
    finally { setSaving(false); }
  };
  const switchWorkspace = async (workspaceId: string) => {
    if (!account || workspaceId === account.workspace.id) return;
    setSwitching(true); setError("");
    try { await frontendApi.switchWorkspace(workspaceId); window.location.replace("/settings"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Der Workspace konnte nicht gewechselt werden."); setSwitching(false); }
  };
  const passwordValid = newPassword.length >= 12 && /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) && /\d/.test(newPassword) && /[^A-Za-z0-9]/.test(newPassword);
  const changePassword = async () => {
    if (!currentPassword || !passwordValid) { setError("Gib dein aktuelles Passwort und ein neues Passwort ein, das alle Anforderungen erfüllt."); return; }
    setChangingPassword(true); setError(""); setPasswordMessage("");
    try {
      const result = await frontendApi.changePassword(currentPassword, newPassword);
      setCurrentPassword(""); setNewPassword("");
      setPasswordMessage(result.signedOutOtherSessions ? "Passwort geändert. Andere angemeldete Sitzungen wurden beendet; dieses Gerät bleibt mit einer erneuerten Sitzung angemeldet." : "Passwort geändert.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Das Passwort konnte nicht geändert werden."); }
    finally { setChangingPassword(false); }
  };
  const invite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setInviting(true); setError(""); setInviteMessage("");
    try {
      await frontendApi.createWorkspaceInvitation(inviteEmail.trim(), inviteRole);
      setInviteEmail("");
      setInviteMessage("Die Einladung ist bereit. Du kannst ihren Status unten verfolgen.");
      setInvitations(await frontendApi.listWorkspaceInvitations());
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Die Einladungsanfrage konnte nicht angenommen werden."); }
    finally { setInviting(false); }
  };
  const updateMember = async (membershipId: string, role: "ADMIN" | "MEMBER", status: "ACTIVE" | "REMOVED") => {
    setMemberWorkingId(membershipId); setError("");
    try { await frontendApi.updateWorkspaceMember(membershipId, role, status); setAccount(await frontendApi.getAccount()); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Dieses Workspace-Mitglied konnte nicht aktualisiert werden."); }
    finally { setMemberWorkingId(""); }
  };
  if (loadState === "loading") return <div className="page-stack settings-page"><PageHeader title="Workspace-Einstellungen" description="Verwalte Identität, Teamzugriff, Sicherheit und das Erscheinungsbild der Buchungsseite deines Workspace." /><div className="sync-note" role="status"><span className="spinner" />Workspace-Einstellungen werden geladen…</div></div>;
  if (loadState === "error") return <div className="page-stack settings-page"><PageHeader title="Workspace-Einstellungen" /><section className="panel error-state" role="alert"><span><Icon name="x" /></span><h2>Workspace-Einstellungen wurden nicht geladen</h2><p>{error || "Workspace-Einstellungen konnten nicht geladen werden."}</p><ActionButton variant="primary" onClick={() => { setError(""); setLoadState("loading"); setLoadAttempt((attempt) => attempt + 1); }}>Erneut versuchen</ActionButton></section></div>;
  return <div className="page-stack settings-page">
    <PageHeader title="Workspace-Einstellungen" description="Verwalte Identität, Teamzugriff, Sicherheit und das Erscheinungsbild der Buchungsseite deines Workspace." />
    {saved && <div className="toast" role="status"><span><Icon name="check" /></span>Workspace-Einstellungen gespeichert</div>}
    {error && <div className="toast toast-error" role="alert"><span><Icon name="x" /></span>{error}</div>}
    {account && <div className="account-settings-grid"><section className="panel settings-content"><div className="settings-heading"><div><h2>Aktiver Workspace</h2><p>Der Workspace, den du gerade verwaltest.</p></div><Badge tone="brand">{account.workspace.role.toLowerCase()}</Badge></div><div className="workspace-overview">{branding.logoUrl ? <img src={branding.logoUrl} alt={`Logo von ${branding.workspaceName || account.workspace.name}`} className="workspace-dot workspace-logo" /> : <span className="workspace-dot">{(branding.workspaceName || account.workspace.name).charAt(0).toUpperCase()}</span>}<div><strong>{branding.workspaceName || account.workspace.name}</strong><span>{account.workspace.timeZone}</span></div></div>{account.workspaces.length > 1 && <Field label="Workspace wechseln"><select value={account.workspace.id} onChange={(event) => void switchWorkspace(event.target.value)} disabled={switching}>{account.workspaces.map((workspace) => <option value={workspace.id} key={workspace.id}>{workspace.name} · {workspace.role.toLowerCase()}</option>)}</select></Field>}<dl className="workspace-facts"><div><dt>Workspace-ID</dt><dd>{account.workspace.id}</dd></div><div><dt>Einrichtung</dt><dd>{account.workspace.onboardingCompleted ? "Abgeschlossen" : "Unvollständig"}</dd></div></dl></section><section className="panel settings-content"><div className="settings-heading"><div><h2>Kontosicherheit</h2><p>Aktualisiere dein Passwort und melde andere aktive Sitzungen ab.</p></div></div><div className="security-form"><Field label="Aktuelles Passwort" required><input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" /></Field><Field label="Neues Passwort" required hint="Mindestens 12 Zeichen mit Groß- und Kleinbuchstaben, einer Zahl und einem Sonderzeichen."><input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={200} /></Field>{passwordMessage && <div className="notice notice-info" role="status"><Icon name="check" /><div><strong>Passwort aktualisiert</strong><span>{passwordMessage}</span></div></div>}<ActionButton variant="primary" onClick={changePassword} disabled={changingPassword || !currentPassword || !passwordValid}>{changingPassword ? "Passwort wird geändert…" : "Passwort ändern"}</ActionButton></div></section></div>}
    {account && <section className="panel settings-content"><div className="settings-heading"><div><h2>Profilfoto</h2><p>Wird in deiner Gastgeber-Navigation und neben deinem Konto angezeigt.</p></div></div><div className="profile-photo"><Avatar name={account.user.name} imageUrl={account.user.imageUrl} size="lg" /><div><input ref={profileInputRef} id="profile-photo-upload" className="visually-hidden-file" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Profilfoto-Datei" onChange={(event) => void uploadProfileImage(event)} disabled={profileProcessing} /><div className="logo-upload-actions"><ActionButton variant="secondary" onClick={() => profileInputRef.current?.click()} disabled={profileProcessing}>{profileProcessing ? "Wird aktualisiert…" : account.user.imageUrl ? "Foto ersetzen" : "Foto auswählen"}</ActionButton>{account.user.imageUrl && <ActionButton variant="ghost" onClick={() => void persistProfileImage(null)} disabled={profileProcessing}>Entfernen</ActionButton>}</div><span>PNG, JPG oder WebP bis 5 MB. Das gespeicherte Bild wird skaliert und normalisiert.</span></div></div>{profileMessage && <div className="notice notice-info" role="status"><Icon name="check" /><div><strong>Profil aktualisiert</strong><span>{profileMessage}</span></div></div>}</section>}
    {account && <section className="panel settings-content"><div className="settings-heading"><div><h2>Workspace-Mitglieder</h2><p>Personen mit Zugriff auf {account.workspace.name}.</p></div><Badge tone="neutral">{account.members.length} {account.members.length === 1 ? "Mitglied" : "Mitglieder"}</Badge></div><div className="member-list">{account.members.map((member) => <div className="member-row" key={member.id}><Avatar name={member.name} imageUrl={member.userId === account.user.id ? account.user.imageUrl : null} /><div><strong>{member.name}{member.userId === account.user.id ? " · Du" : ""}</strong><span>{member.email}</span></div>{account.workspace.role === "OWNER" && member.status === "ACTIVE" && member.userId !== account.user.id && member.role !== "OWNER" ? <div className="member-controls"><select aria-label={`Rolle für ${member.name}`} value={member.role} disabled={memberWorkingId === member.id} onChange={(event) => void updateMember(member.id, event.target.value as "ADMIN" | "MEMBER", "ACTIVE")}><option value="ADMIN">Admin</option><option value="MEMBER">Mitglied</option></select><ActionButton variant="danger" disabled={memberWorkingId === member.id} onClick={() => { if (window.confirm(`${member.name} aus diesem Workspace entfernen?`)) void updateMember(member.id, member.role as "ADMIN" | "MEMBER", "REMOVED"); }}>Entfernen</ActionButton></div> : <Badge tone={member.status === "ACTIVE" ? "success" : "neutral"}>{member.role.toLowerCase()} · {member.status.toLowerCase()}</Badge>}</div>)}</div></section>}
    {account && account.workspace.role !== "MEMBER" && <section className="panel settings-content"><div className="settings-heading"><div><h2>Workspace-Einladungen</h2><p>Lade Teammitglieder ein und lege fest, was sie verwalten können.</p></div><Badge tone="neutral">{invitations.length} gesamt</Badge></div><form className="invitation-form" onSubmit={invite}><Field label="E-Mail der eingeladenen Person" required><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} autoComplete="email" required /></Field><Field label="Workspace-Rolle" required><select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as "ADMIN" | "MEMBER")}><option value="MEMBER">Mitglied</option><option value="ADMIN">Admin</option></select></Field><ActionButton variant="primary" disabled={inviting || !inviteEmail.includes("@")} type="submit">{inviting ? "Wird gesendet…" : "Einladung senden"}</ActionButton></form>{inviteMessage && <div className="notice notice-info" role="status"><Icon name="check" /><div><strong>Einladung erstellt</strong><span>{inviteMessage}</span></div></div>}<div className="invitation-list" aria-label="Einträge zu Workspace-Einladungen">{invitations.map((invitation) => <div className="invitation-row" key={invitation.id}><div><strong>{invitation.email}</strong><span>Läuft ab am {new Date(invitation.expiresAt).toLocaleString("de-DE")}</span></div><Badge tone={invitation.status === "PENDING" ? "warning" : invitation.status === "ACCEPTED" ? "success" : "neutral"}>{invitation.role.toLowerCase()} · {invitation.status.toLowerCase()}</Badge></div>)}{invitations.length === 0 && <p className="muted">Noch keine Einladungen.</p>}</div></section>}
    {account?.workspace.role !== "MEMBER" && <section className="panel settings-content">
      <div className="settings-heading"><div><h2>Branding der Buchungsseite</h2><p>Passe an, wie dein Workspace für Gäste erscheint.</p></div></div>
      <div className="brand-editor">
        <div className="brand-form">
          <Field label="Workspace-Name" required><input value={branding.workspaceName} onChange={(event) => patch("workspaceName", event.target.value)} /></Field>
          <Field label="Logo" hint="Lade ein PNG, JPG oder WebP bis 5 MB hoch. BookMe optimiert es für Buchungsseiten."><div className="upload-box">{branding.logoUrl ? <img src={branding.logoUrl} alt="Aktuelles Workspace-Logo" className="brand-logo-thumb" /> : <div className="brand-logo-thumb brand-logo-fallback" style={{ background: branding.accentColor, color: foregroundForBackground(branding.accentColor) }}>{branding.workspaceName.charAt(0).toUpperCase() || "T"}</div>}<div><input ref={logoInputRef} id="workspace-logo-upload" className="visually-hidden-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadLogo(event)} disabled={logoProcessing || saving} /><div className="logo-upload-actions"><label className="button button-secondary button-sm" htmlFor="workspace-logo-upload" aria-disabled={logoProcessing || saving}>{logoProcessing ? "Wird aufbereitet…" : branding.logoUrl ? "Bild ersetzen" : "Bild auswählen"}</label>{branding.logoUrl && <button className="button button-ghost button-sm" type="button" onClick={removeLogo} disabled={logoProcessing || saving}>Entfernen</button>}</div><small>{logoFileName || (branding.logoUrl ? "Aktuell gespeichertes Logo" : "Kein Logo hochgeladen")}</small></div></div></Field>
          <Field label="Akzentfarbe"><div className="brand-color-row" role="group" aria-label="Akzentfarbe"><input type="color" aria-label="Akzentfarbe auswählen" value={branding.accentColor} onChange={(event) => patch("accentColor", event.target.value)} /><input aria-label="Hex-Wert der Akzentfarbe" value={branding.accentColor} onChange={(event) => patch("accentColor", event.target.value)} pattern="#[0-9A-Fa-f]{6}" /></div></Field>
          <Field label="Unternehmensbeschreibung"><textarea rows={4} value={branding.description ?? ""} onChange={(event) => patch("description", event.target.value || null)} /></Field>
          <Field label="Fußzeile der Buchungsseite"><input value={branding.footerText ?? ""} onChange={(event) => patch("footerText", event.target.value || null)} /></Field>
        </div>
        <div className="brand-preview"><span>Vorschau</span><div className="brand-preview-card">{branding.logoUrl ? <img src={branding.logoUrl} alt={`Logo von ${branding.workspaceName || "Workspace"}`} className="mini-logo uploaded-brand-logo" /> : <div className="mini-logo" style={{ background: branding.accentColor, color: foregroundForBackground(branding.accentColor) }}>{branding.workspaceName.charAt(0).toUpperCase() || "T"}</div>}<strong>{branding.workspaceName || "Workspace-Name"}</strong><h3>Buchungsseite</h3><p>{branding.description || "Deine Unternehmensbeschreibung erscheint hier."}</p><button type="button" disabled aria-label="Nur Vorschau" style={{ background: branding.accentColor, color: foregroundForBackground(branding.accentColor) }}>Wähle eine Zeit</button><small>{branding.footerText || "Bereitgestellt von BookMe"}</small></div></div>
      </div>
      <footer className="settings-footer"><ActionButton variant="primary" onClick={save} disabled={saving || !dirty || !branding.workspaceName.trim()}>{saving ? "Wird gespeichert…" : dirty ? "Einstellungen speichern" : "Gespeichert"}</ActionButton></footer>
    </section>}
  </div>;
}
