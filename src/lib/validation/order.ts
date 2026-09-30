import { z } from "zod";
import {
  GUARANTEE_TYPES,
  MANUAL_CHARGE_TYPES,
  MANUAL_PAYMENT_CHANNELS,
  PAYMENT_METHODS,
  PAYMENT_PURPOSES,
} from "../domain/types";
import { dateTimeSchema, idSchema, noteSchema, personNameSchema, phoneSchema, rupiahSchema } from "./common";

// ---------- Bagian yang dipakai bersama ----------

export const orderLineSchema = z.object({
  itemId: idSchema,
  quantity: z.int("Jumlah harus bilangan bulat").min(1, "Jumlah minimal 1").max(99, "Jumlah maksimal 99"),
});

export const orderLinesSchema = z
  .array(orderLineSchema)
  .min(1, "Pilih minimal satu alat")
  .max(30, "Maksimal 30 jenis alat per pesanan")
  .refine((lines) => new Set(lines.map((l) => l.itemId)).size === lines.length, {
    error: "Alat yang sama tidak boleh muncul dua kali",
  });

const rentalWindow = { startAt: dateTimeSchema, endAt: dateTimeSchema };

/**
 * Aturan waktu yang tidak butuh pengaturan toko. Jam operasional dicek di service.
 * Refinement tetap dijalankan Zod walau format waktu gagal, jadi cek tipe dulu.
 */
const endAfterStart = (v: { startAt: unknown; endAt: unknown }) =>
  !(v.startAt instanceof Date && v.endAt instanceof Date) || v.endAt.getTime() > v.startAt.getTime();
const endAfterStartParams = { error: "Waktu kembali harus setelah waktu ambil", path: ["endAt"] };

// ---------- Pelanggan ----------

/** POST /quote — rincian biaya keranjang (Req 4.3). */
export const quoteSchema = z
  .object({ items: orderLinesSchema, ...rentalWindow, guaranteeType: z.enum(GUARANTEE_TYPES).optional() })
  .refine(endAfterStart, endAfterStartParams);
export type QuoteInput = z.infer<typeof quoteSchema>;

/** POST /orders — checkout online (Req 7.1, 8.1). Harga selalu dihitung ulang di server. */
export const checkoutSchema = z
  .object({
    items: orderLinesSchema,
    ...rentalWindow,
    guaranteeType: z.enum(GUARANTEE_TYPES, "Pilih jenis jaminan"),
    paymentMethod: z.enum(PAYMENT_METHODS, "Pilih metode pembayaran"),
    customerName: personNameSchema,
    customerPhone: phoneSchema,
    note: noteSchema.optional(),
  })
  .refine(endAfterStart, endAfterStartParams);
export type CheckoutInput = z.infer<typeof checkoutSchema>;

// ---------- Admin: sewa walk-in (Req 13) ----------

export const walkInCustomerSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("REGISTERED"), userId: idSchema }),
  z.object({ type: z.literal("GUEST"), name: personNameSchema, phone: phoneSchema }),
]);

export const walkInOrderSchema = z
  .object({
    customer: walkInCustomerSchema,
    items: orderLinesSchema,
    ...rentalWindow,
    guaranteeType: z.enum(GUARANTEE_TYPES, "Pilih jenis jaminan"),
    paymentMethod: z.enum(PAYMENT_METHODS).default("BAYAR_DI_TOKO"),
    note: noteSchema.optional(),
    /** Bayar lunas + jaminan diterima + DIAMBIL dalam satu langkah (Req 13.7) */
    pickupNow: z.boolean().default(false),
    paymentChannel: z.enum(MANUAL_PAYMENT_CHANNELS).optional(),
  })
  .refine(endAfterStart, endAfterStartParams)
  .refine((v) => !v.pickupNow || v.paymentChannel !== undefined, {
    error: "Pilih cara bayar untuk pengambilan langsung",
    path: ["paymentChannel"],
  })
  .refine((v) => !v.pickupNow || v.paymentMethod === "BAYAR_DI_TOKO", {
    error: "Pengambilan langsung hanya untuk pembayaran di toko",
    path: ["paymentMethod"],
  });
export type WalkInOrderInput = z.infer<typeof walkInOrderSchema>;

// ---------- Admin: proses pesanan ----------

/** Catat pembayaran manual: sewa di toko, denda, atau refund deposit (Req 8.8, 11.4). */
export const recordPaymentSchema = z.object({
  purpose: z.enum(PAYMENT_PURPOSES),
  channel: z.enum(MANUAL_PAYMENT_CHANNELS, "Pilih cara bayar"),
  amount: rupiahSchema.min(1, "Nominal minimal Rp 1"),
  note: noteSchema.optional(),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const guaranteeActionSchema = z.object({ action: z.enum(["RECEIVE", "RETURN"]) });
export type GuaranteeActionInput = z.infer<typeof guaranteeActionSchema>;

/** Catat pengembalian alat (Req 11.1–11.3). Denda telat dihitung sistem, tidak dikirim klien. */
export const returnOrderSchema = z.object({
  returnedAt: dateTimeSchema.optional(),
  charges: z
    .array(
      z.object({
        type: z.enum(MANUAL_CHARGE_TYPES),
        orderItemId: idSchema,
        amount: rupiahSchema.min(1, "Nominal denda minimal Rp 1"),
        note: z.string().trim().min(3, "Jelaskan kerusakan/kehilangan").max(300),
      }),
    )
    .max(50)
    .default([]),
});
export type ReturnOrderInput = z.infer<typeof returnOrderSchema>;

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(3, "Alasan minimal 3 karakter").max(300),
});
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
