"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, apiFieldErrors, errorMessage } from "@/lib/api-client";
import { slugify } from "@/lib/slug";
import { slugSchema } from "@/lib/validation/common";
import { ConfirmDialog } from "./confirm-dialog";
import { PageHeader } from "./page-header";

interface Category {
  id: string;
  name: string;
  slug: string;
  itemCount: number;
}

// Slug boleh dikosongkan di form: server membuatnya dari nama.
const formSchema = z.object({
  name: z.string().trim().min(2, "Nama kategori minimal 2 karakter").max(50, "Nama kategori maksimal 50 karakter"),
  slug: z.union([z.literal(""), slugSchema]),
});
type FormValues = z.infer<typeof formSchema>;

export function CategoryManager({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  async function handleDelete() {
    if (!deleting) return;
    try {
      await api(`/admin/categories/${deleting.id}`, { method: "DELETE" });
      toast.success(`Kategori "${deleting.name}" dihapus.`);
      router.refresh();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Kategori"
        description="Kelompokkan alat supaya pelanggan mudah mencari di katalog."
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus aria-hidden="true" />
            Tambah Kategori
          </Button>
        }
      />

      <Card className="py-0">
        {categories.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">Belum ada kategori.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Nama</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead className="text-right">Jumlah alat</TableHead>
                <TableHead className="pr-4 text-right">
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categories.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-4 font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.slug}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.itemCount}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button variant="ghost" size="icon-sm" onClick={() => setEditing(c)} aria-label={`Ubah ${c.name}`}>
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(c)}
                      aria-label={`Hapus ${c.name}`}
                      disabled={c.itemCount > 0}
                      title={c.itemCount > 0 ? "Kategori masih berisi alat" : undefined}
                    >
                      <Trash2 />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CategoryDialog
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        category={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Hapus kategori?"
        description={`Kategori "${deleting?.name}" akan dihapus permanen.`}
        confirmLabel="Hapus"
        destructive
        onConfirm={handleDelete}
      />
    </div>
  );
}

function CategoryDialog({
  category,
  open,
  onOpenChange,
  onSaved,
}: {
  category: Category | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: category?.name ?? "", slug: category?.slug ?? "" },
  });

  const onSubmit = handleSubmit(async ({ name, slug }) => {
    const json = { name, ...(slug ? { slug } : {}) };
    try {
      if (category) await api(`/admin/categories/${category.id}`, { method: "PATCH", json });
      else await api("/admin/categories", { json });
      toast.success(category ? "Kategori diperbarui." : "Kategori ditambahkan.");
      onSaved();
    } catch (error) {
      const fields = apiFieldErrors(error);
      if (fields.length === 0) toast.error(errorMessage(error));
      for (const f of fields) {
        if (f.path === "name" || f.path === "slug") setError(f.path, { message: f.message });
      }
    }
  });

  const [nameValue, slugValue] = useWatch({ control, name: ["name", "slug"] });
  const slugPreview = slugValue || slugify(nameValue ?? "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{category ? "Ubah kategori" : "Tambah kategori"}</DialogTitle>
          </DialogHeader>
          <FormField id="category-name" label="Nama" error={errors.name?.message} {...register("name")} />
          <FormField
            id="category-slug"
            label="Slug (opsional)"
            hint={
              category
                ? "Dipakai di URL katalog. Mengubahnya membuat tautan lama tidak berlaku."
                : `Dipakai di URL katalog. Kosongkan untuk otomatis: ${slugPreview || "-"}`
            }
            error={errors.slug?.message}
            {...register("slug")}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              Simpan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
