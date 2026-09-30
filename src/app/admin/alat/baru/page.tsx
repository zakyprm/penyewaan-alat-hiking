import type { Metadata } from "next";
import { ItemForm } from "@/components/admin/item-form";
import { PageHeader } from "@/components/admin/page-header";
import { requireAdminPage } from "@/server/session";
import { listCategories } from "@/server/services/categories";

export const metadata: Metadata = { title: "Tambah Alat" };

export default async function NewItemPage() {
  await requireAdminPage();
  const categories = await listCategories();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <PageHeader title="Tambah alat" />
      <ItemForm categories={categories} />
    </div>
  );
}
