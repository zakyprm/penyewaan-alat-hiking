import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { SettingsForm } from "@/components/admin/settings-form";
import { requireAdminPage } from "@/server/session";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Pengaturan" };

export default async function AdminSettingsPage() {
  await requireAdminPage();
  const settings = await getSettings();

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <PageHeader title="Pengaturan Toko" description="Ubah kebijakan toko tanpa perlu mengubah kode." />
      <SettingsForm settings={settings} />
    </div>
  );
}
