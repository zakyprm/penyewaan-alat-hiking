"use client";

import {
  ClipboardList,
  LayoutDashboard,
  Package,
  PlusCircle,
  Settings,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** false = halaman belum dibuat (task berikutnya) */
  ready: boolean;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, ready: true, exact: true },
  { href: "/admin/pesanan", label: "Pesanan", icon: ClipboardList, ready: true, exact: true },
  { href: "/admin/pesanan/baru", label: "Sewa Manual", icon: PlusCircle, ready: true },
  { href: "/admin/alat", label: "Alat", icon: Package, ready: true },
  { href: "/admin/kategori", label: "Kategori", icon: Tags, ready: true },
  { href: "/admin/pelanggan", label: "Pelanggan", icon: Users, ready: true, exact: true },
  { href: "/admin/pengaturan", label: "Pengaturan", icon: Settings, ready: true },
];

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Menu admin">
      <ul className="grid gap-1">
        {NAV.map(({ href, label, icon: Icon, ready, exact }) => {
          const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          const className = cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            active
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent",
          );

          if (!ready) {
            return (
              <li key={href}>
                <span className={cn(className, "cursor-not-allowed opacity-50 hover:bg-transparent")} aria-disabled="true">
                  <Icon className="size-4" aria-hidden="true" />
                  {label}
                  <span className="ml-auto text-xs font-normal">Segera</span>
                </span>
              </li>
            );
          }

          return (
            <li key={href}>
              <Link href={href} className={className} aria-current={active ? "page" : undefined} onClick={onNavigate}>
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
