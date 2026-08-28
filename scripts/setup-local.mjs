import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const templatePath = resolve(root, ".env.example");
const targetPath = resolve(root, ".env.local");
const args = process.argv.slice(2);

function valueAfter(flag) {
  const index = args.indexOf(flag);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${flag} benötigt einen Wert.`);
  return value;
}

const force = args.includes("--force");
const email = valueAfter("--email") || "owner@example.com";
const generatedPassword = `Book!7${randomBytes(12).toString("base64url")}`;
const password = valueAfter("--password") || generatedPassword;

if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("--email muss eine gültige E-Mail-Adresse sein.");
if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
  throw new Error("--password muss mindestens 12 Zeichen enthalten, mit Großbuchstaben, Kleinbuchstaben, einer Zahl und einem Sonderzeichen.");
}
if (!existsSync(templatePath)) throw new Error(".env.example wurde nicht gefunden. Führe diesen Befehl im Wurzelverzeichnis des Repositories aus.");
if (existsSync(targetPath) && !force) throw new Error(".env.local existiert bereits. Behalte die Datei, entferne sie selbst oder führe den Befehl mit --force erneut aus, um sie zu ersetzen.");

const replacements = new Map([
  ["replace-with-at-least-32-random-characters", randomBytes(32).toString("base64url")],
  ["replace-with-an-independent-32-byte-random-value", randomBytes(32).toString("base64url")],
  ["replace-with-64-random-hex-characters", randomBytes(32).toString("hex")],
  ["replace-with-a-strong-demo-password", password],
  ["owner@example.com", email],
]);

let environment = readFileSync(templatePath, "utf8");
for (const [placeholder, value] of replacements) environment = environment.replaceAll(placeholder, value);
writeFileSync(targetPath, environment, { encoding: "utf8", flag: "w" });

console.log(".env.local mit generierten Anwendungs-Secrets wurde erstellt.");
console.log(`Lokale Login-E-Mail: ${email}`);
console.log(`Lokales Login-Passwort: ${password}`);
console.log("Speichere die Zugangsdaten jetzt. Die Datei wird von Git ignoriert und darf niemals committet werden.");
