import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { WalkInForm } from "@/components/admin/walk-in/walk-in-form";
import { requireAdminPage } from "@/server/session";
import { listCategories } from "@/server/services/categories";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Sewa Manual" };

export default async function WalkInOrderPage() {
  await requireAdminPage();
  const [categories, settings] = await Promise.all([listCategories(), getSettings()]);

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <PageHeader title="Buat Sewa Manual" description="Untuk pelanggan yang datang langsung ke toko." />
      <WalkInForm categories={categories} settings={settings} />
    </div>
  );
}
