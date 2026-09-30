import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { safeNextPath } from "@/lib/safe-redirect";
import { googleAuthEnabled } from "@/server/auth";
import { getCurrentUser } from "@/server/session";

export const metadata: Metadata = { title: "Masuk" };

export default async function SignInPage({ searchParams }: PageProps<"/masuk">) {
  const next = safeNextPath((await searchParams).next, "") || null;

  const user = await getCurrentUser();
  if (user) redirect(next ?? (user.role === "ADMIN" ? "/admin" : "/"));

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1 className="text-xl font-semibold">Masuk</h1>
        </CardTitle>
        <CardDescription>
          {next === "/checkout" ? "Masuk dulu untuk melanjutkan pesanan." : "Masuk untuk menyewa dan melihat pesananmu."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignInForm next={next} googleEnabled={googleAuthEnabled} />
      </CardContent>
    </Card>
  );
}
