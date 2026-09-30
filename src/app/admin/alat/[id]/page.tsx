import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ItemDeleteButton } from "@/components/admin/item-delete-button";
import { ItemForm } from "@/components/admin/item-form";
import { PageHeader } from "@/components/admin/page-header";
import { isDomainError } from "@/lib/domain/errors";
import { requireAdminPage } from "@/server/session";
import { listCategories } from "@/server/services/categories";
import { getAdminItem } from "@/server/services/items";

export const metadata: Metadata = { title: "Ubah Alat" };

export default async function EditItemPage({ params }: PageProps<"/admin/alat/[id]">) {
  await requireAdminPage();
  const { id } = await params;

  const item = await getAdminItem(id).catch((error) => {
    if (isDomainError(error) && error.code === "TIDAK_DITEMUKAN") notFound();
    throw error;
  });
  const categories = await listCategories();

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <PageHeader
        title={item.name}
        description={item.visibility === "PUBLIC" ? `Katalog: /alat/${item.slug}` : "Alat internal (tidak tampil di katalog)"}
        actions={<ItemDeleteButton id={item.id} name={item.name} />}
      />
      <ItemForm item={item} categories={categories} />
    </div>
  );
}
