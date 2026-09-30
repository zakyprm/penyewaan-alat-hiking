import { z } from "zod";
import { GUARANTEE_TYPES, PAYMENT_METHODS } from "../domain/types";
import { noteSchema, personNameSchema, phoneSchema } from "./common";

/**
 * Form checkout sisi klien. Waktu dan alat sudah tervalidasi di keranjang, jadi di sini
 * hanya data yang benar-benar diisi ulang oleh pelanggan (Req 8.1). Server (checkoutSchema)
 * tetap memvalidasi ulang semuanya secara utuh.
 */
export const checkoutFormSchema = z.object({
  customerName: personNameSchema,
  customerPhone: phoneSchema,
  guaranteeType: z.enum(GUARANTEE_TYPES, "Pilih jenis jaminan"),
  paymentMethod: z.enum(PAYMENT_METHODS, "Pilih metode pembayaran"),
  note: noteSchema.optional().or(z.literal("")),
});
export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;
