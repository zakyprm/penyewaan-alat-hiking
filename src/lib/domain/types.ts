/**
 * Daftar nilai enum untuk logika domain.
 *
 * Sengaja tidak mengimpor dari Prisma supaya modul domain tetap murni dan bisa dipakai
 * bersama mobile app nanti. Kesesuaian dengan enum Prisma dijaga oleh `types.test.ts`.
 */

export const ROLES = ["CUSTOMER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const VISIBILITIES = ["PUBLIC", "INTERNAL"] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const ORDER_SOURCES = ["ONLINE", "WALK_IN"] as const;
export type OrderSource = (typeof ORDER_SOURCES)[number];

export const ORDER_STATUSES = [
  "MENUNGGU_PEMBAYARAN",
  "DIKONFIRMASI",
  "DIAMBIL",
  "DIKEMBALIKAN",
  "SELESAI",
  "DIBATALKAN",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_METHODS = ["ONLINE", "BAYAR_DI_TOKO"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["MENUNGGU", "LUNAS", "GAGAL", "KEDALUWARSA"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_PURPOSES = ["SEWA_DAN_DEPOSIT", "DENDA", "REFUND_DEPOSIT"] as const;
export type PaymentPurpose = (typeof PAYMENT_PURPOSES)[number];

export const PAYMENT_CHANNELS = ["MIDTRANS", "TUNAI", "TRANSFER", "QRIS"] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

/** Cara bayar yang bisa dicatat manual oleh admin (tanpa Midtrans). */
export const MANUAL_PAYMENT_CHANNELS = ["TUNAI", "TRANSFER", "QRIS"] as const;
export type ManualPaymentChannel = (typeof MANUAL_PAYMENT_CHANNELS)[number];

export const GUARANTEE_TYPES = ["DEPOSIT", "KTP"] as const;
export type GuaranteeType = (typeof GUARANTEE_TYPES)[number];

export const GUARANTEE_STATUSES = ["BELUM_DITERIMA", "DITERIMA", "DIKEMBALIKAN"] as const;
export type GuaranteeStatus = (typeof GUARANTEE_STATUSES)[number];

export const CHARGE_TYPES = ["TELAT", "KERUSAKAN", "KEHILANGAN"] as const;
export type ChargeType = (typeof CHARGE_TYPES)[number];

/** Denda yang diinput manual oleh admin. Denda TELAT selalu dihitung sistem. */
export const MANUAL_CHARGE_TYPES = ["KERUSAKAN", "KEHILANGAN"] as const;
export type ManualChargeType = (typeof MANUAL_CHARGE_TYPES)[number];
