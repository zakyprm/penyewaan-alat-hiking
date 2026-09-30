import type { Metadata } from "next";
import { AccessDenied } from "@/components/access-denied";

export const metadata: Metadata = { title: "Akses ditolak", robots: { index: false } };

export default function AccessDeniedPage() {
  return <AccessDenied />;
}
