import { z } from "zod";
import { personNameSchema, phoneSchema } from "./common";

// Rapikan dulu (spasi, huruf besar), baru validasi formatnya.
const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Format email tidak valid"));

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password wajib diisi"),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = z
  .object({
    name: personNameSchema,
    email: emailSchema,
    phone: phoneSchema,
    password: z.string().min(8, "Password minimal 8 karakter").max(128, "Password maksimal 128 karakter"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    error: "Konfirmasi password tidak sama",
    path: ["confirmPassword"],
  });
export type SignUpInput = z.infer<typeof signUpSchema>;
