import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/safe-redirect";
import { googleAuthEnabled } from "@/server/auth";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Daftar" };

export default async function SignUpPage({ searchParams }: PageProps<"/daftar">) {
  const next = safeNextPath((await searchParams).next, "") || null;

  if (await getCurrentUser()) redirect(next ?? "/");

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold">Buat akun</h1>
        </CardTitle>
        <CardDescription>Gratis, cukup sekali untuk semua penyewaan.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm next={next} googleEnabled={googleAuthEnabled} />
      </CardContent>
    </Card>
  );
}
