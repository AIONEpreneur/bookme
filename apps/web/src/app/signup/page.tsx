import type { Metadata } from "next";
import { AccountSignup } from "@/components/account-signup";

export const metadata: Metadata = { title: "Workspace erstellen" };
export default function SignupPage() { return <AccountSignup />; }
