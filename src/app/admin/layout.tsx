import { ExternalLink, Mountain } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminMobileNav } from "@/components/admin/admin-mobile-nav";
import { AdminNav } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireAdminPage } from "@/server/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Admin Sewa Alat Hiking" },
  robots: { index: false },
};

// Setiap page admin tetap wajib memanggil requireAdminPage() sendiri (lihat server/session.ts).
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdminPage();

  return (
    <div className="flex min-h-dvh flex-1">
      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r bg-sidebar p-4 lg:flex">
        <Link href="/admin" className="flex items-center gap-2 px-3 font-semibold text-primary">
          <Mountain className="size-5" aria-hidden="true" />
          Admin Toko
        </Link>
        <AdminNav />
        <div className="mt-auto grid gap-1 border-t pt-4 text-sm">
          <Link href="/" className="flex items-center gap-2 px-3 py-1 text-muted-foreground hover:text-foreground">
            <ExternalLink className="size-4" aria-hidden="true" />
            Lihat situs
          </Link>
          <p className="truncate px-3 text-muted-foreground" title={user.email}>
            {user.name}
          </p>
          <SignOutButton className="justify-start" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Bar atas mobile */}
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b bg-sidebar px-2 py-1 lg:hidden">
          <AdminMobileNav />
          <span className="font-semibold text-primary">Admin Toko</span>
          <SignOutButton className="ml-auto" />
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
