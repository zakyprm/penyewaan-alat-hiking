import { Mountain } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2 font-semibold text-primary">
          <Mountain className="size-5" aria-hidden="true" />
          Sewa Alat Hiking
        </Link>
        {children}
      </div>
    </main>
  );
}
