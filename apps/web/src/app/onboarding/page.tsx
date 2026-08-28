import type { Metadata } from "next";
import { WorkspaceOnboarding } from "@/components/workspace-onboarding";

export const metadata: Metadata = { title: "Workspace bestätigen" };
export default function OnboardingPage() { return <WorkspaceOnboarding />; }
