import type { Metadata } from "next";
import { CategoryManager } from "@/components/admin/category-manager";
import { requireAdminPage } from "@/server/session";
import { listCategories } from "@/server/services/categories";

export const metadata: Metadata = { title: "Kategori" };

export default async function AdminCategoriesPage() {
  await requireAdminPage();
  return <CategoryManager categories={await listCategories()} />;
}
