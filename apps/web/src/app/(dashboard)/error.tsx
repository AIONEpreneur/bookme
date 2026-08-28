"use client";
import { Icon } from "@/components/icons";
export default function DashboardError({ reset }: { reset: () => void }) { return <div className="error-state"><span><Icon name="x" /></span><h1>Etwas wurde nicht geladen</h1><p>Deine Daten sind sicher. Versuche, diese Ansicht erneut zu laden.</p><button className="button button-primary" onClick={reset}>Erneut versuchen</button></div>; }
