import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function AccessDenied({ message = "Halaman ini khusus admin toko." }: { message?: string }) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <ShieldAlert className="size-10 text-destructive" aria-hidden="true" />
      <h1 className="text-xl font-semibold">Akses ditolak</h1>
      <p className="text-muted-foreground">{message}</p>
      <Button asChild variant="outline">
        <Link href="/">Kembali ke beranda</Link>
      </Button>
    </main>
  );
}
