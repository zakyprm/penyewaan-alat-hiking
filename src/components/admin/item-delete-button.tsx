"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/api-client";
import { ConfirmDialog } from "./confirm-dialog";

export function ItemDeleteButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" />
        Hapus
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`Hapus ${name}?`}
        description="Alat hilang dari daftar dan katalog. Riwayat pesanan lama tetap tersimpan."
        confirmLabel="Hapus alat"
        destructive
        onConfirm={async () => {
          try {
            await api(`/admin/items/${id}`, { method: "DELETE" });
            toast.success(`${name} dihapus.`);
            router.push("/admin/alat");
            router.refresh();
          } catch (error) {
            toast.error(errorMessage(error));
          }
        }}
      />
    </>
  );
}
