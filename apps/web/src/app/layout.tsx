import type { Metadata } from "next";
import { AccessibilityFocusManager } from "@/components/accessibility-focus";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: { default: "SnagTime", template: "%s · SnagTime" },
  description: "Schnapp dir einen Termin. Werde gebucht.",
  applicationName: "SnagTime",
  icons: { icon: "/icon.svg" },
  manifest: "/manifest.webmanifest",
  openGraph: { title: "SnagTime", description: "Schnapp dir einen Termin. Werde gebucht.", type: "website" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de" data-scroll-behavior="smooth"><body><AccessibilityFocusManager />{children}</body></html>;
}
