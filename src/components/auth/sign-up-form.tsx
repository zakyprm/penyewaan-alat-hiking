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
import { signUpSchema, type SignUpInput } from "@/lib/validation/auth";
import { AuthDivider } from "./auth-divider";
import { GoogleButton } from "./google-button";

interface Props {
  next: string | null;
  googleEnabled: boolean;
}

export function SignUpForm({ next, googleEnabled }: Props) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof signUpSchema>, unknown, SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", phone: "", password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async ({ name, email, phone, password }) => {
    setFormError(null);
    const { error } = await authClient.signUp.email({ name, email, phone, password });
    if (error) {
      setFormError(authErrorMessage(error));
      return;
    }
    router.replace(next ?? "/");
    router.refresh();
  });

  const signInHref = next ? `/masuk?next=${encodeURIComponent(next)}` : "/masuk";

  return (
    <div className="grid gap-5">
      {googleEnabled && (
        <>
          <GoogleButton next={next} />
          <AuthDivider />
        </>
      )}

      <form onSubmit={onSubmit} noValidate className="grid gap-4">
        <FormField id="name" label="Nama lengkap" autoComplete="name" error={errors.name?.message} {...register("name")} />
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          error={errors.email?.message}
          {...register("email")}
        />
        <FormField
          id="phone"
          label="Nomor HP (WhatsApp)"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="081234567890"
          hint="Dipakai toko untuk menghubungi kamu soal pesanan."
          error={errors.phone?.message}
          {...register("phone")}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="Minimal 8 karakter."
          error={errors.password?.message}
          {...register("password")}
        />
        <FormField
          id="confirmPassword"
          label="Ulangi password"
          type="password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register("confirmPassword")}
        />

        {formError && (
          <p role="alert" className="rounded-lg bg-danger-muted px-3 py-2 text-sm text-destructive">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          Buat Akun
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Sudah punya akun?{" "}
        <Link href={signInHref} className="font-medium text-primary underline-offset-4 hover:underline">
          Masuk
        </Link>
      </p>
    </div>
  );
}
