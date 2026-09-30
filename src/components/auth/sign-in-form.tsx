"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { signInSchema, type SignInInput } from "@/lib/validation/auth";
import { AuthDivider } from "./auth-divider";
import { GoogleButton } from "./google-button";

interface Props {
  next: string | null;
  googleEnabled: boolean;
}

export function SignInForm({ next, googleEnabled }: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof signInSchema>, unknown, SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const { data, error } = await authClient.signIn.email(values);
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    const role = (data?.user as { role?: string } | undefined)?.role;
    router.replace(next ?? (role === "ADMIN" ? "/admin" : "/"));
    router.refresh();
  });

  const signUpHref = next ? `/daftar?next=${encodeURIComponent(next)}` : "/daftar";

  return (
    <div className="grid gap-5">
      {googleEnabled && (
        <>
          <GoogleButton next={next} />
          <AuthDivider />
        </>
      )}

      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          error={errors.password?.message}
          {...register("password")}
        />

        {formError && (
          <p role="alert" className="rounded-lg bg-danger-muted px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          Masuk
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Belum punya akun?{" "}
        <Link href={signUpHref} className="font-medium text-primary underline-offset-4 hover:underline">
          Daftar
        </Link>
      </p>
    </div>
  );
}
