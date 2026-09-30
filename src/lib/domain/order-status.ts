import { DomainError } from "./errors";
import type { GuaranteeStatus, GuaranteeType, OrderStatus } from "./types";

export type Actor = "CUSTOMER" | "ADMIN" | "SYSTEM";

/** Fakta tentang pesanan yang dibutuhkan untuk memutuskan transisi (design 5.6). */
export interface TransitionContext {
  actor: Actor;
  guaranteeType: GuaranteeType;
  guaranteeStatus: GuaranteeStatus;
  /** Pembayaran SEWA_DAN_DEPOSIT sudah LUNAS */
  rentalPaid: boolean;
  /** Denda yang masih harus ditagih ke pelanggan dan belum lunas */
  outstandingCharges: number;
  /** Khusus deposit: pengembalian sisa deposit sudah dicatat (atau sisanya 0) */
  depositSettled: boolean;
  /** Pembayaran Midtrans sukses yang tiba setelah pesanan dibatalkan karena kedaluwarsa (design 6.1) */
  latePaymentRecovery?: boolean;
}

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

type Guard = (ctx: TransitionContext) => string | null;

const ok = null;

/** Hanya transisi yang terdaftar di sini yang valid. Guard mengembalikan alasan penolakan atau null. */
const TRANSITIONS: Partial<Record<OrderStatus, Partial<Record<OrderStatus, Guard>>>> = {
  MENUNGGU_PEMBAYARAN: {
    DIKONFIRMASI: (c) => {
      if (c.actor === "CUSTOMER") return "Pesanan dikonfirmasi otomatis setelah pembayaran berhasil.";
      if (!c.rentalPaid) return "Pembayaran belum lunas.";
      return ok;
    },
    DIBATALKAN: () => ok,
  },
  DIKONFIRMASI: {
    DIAMBIL: (c) => {
      if (c.actor !== "ADMIN") return "Hanya admin yang dapat menyerahkan alat.";
      if (!c.rentalPaid) return "Pembayaran sewa belum lunas.";
      if (c.guaranteeType === "KTP" && c.guaranteeStatus !== "DITERIMA") {
        return "KTP pelanggan belum diterima."; // Req 7.7
      }
      return ok;
    },
    DIBATALKAN: (c) => {
      if (c.actor === "ADMIN") return ok; // pesanan lunas butuh refund manual oleh admin
      if (c.rentalPaid) return "Pesanan yang sudah dibayar hanya bisa dibatalkan oleh admin.";
      return ok;
    },
  },
  DIAMBIL: {
    DIKEMBALIKAN: (c) => (c.actor === "ADMIN" ? ok : "Hanya admin yang dapat mencatat pengembalian."),
  },
  DIKEMBALIKAN: {
    SELESAI: (c) => {
      if (c.actor !== "ADMIN") return "Hanya admin yang dapat menyelesaikan pesanan.";
      if (c.outstandingCharges > 0) return "Masih ada denda yang belum dibayar.";
      if (c.guaranteeType === "DEPOSIT" && !c.depositSettled) return "Pengembalian sisa deposit belum dicatat.";
      if (c.guaranteeType === "KTP" && c.guaranteeStatus !== "DIKEMBALIKAN") return "KTP belum dikembalikan ke pelanggan.";
      return ok;
    },
  },
  DIBATALKAN: {
    DIKONFIRMASI: (c) => {
      if (c.actor !== "SYSTEM" || !c.latePaymentRecovery) return "Pesanan yang dibatalkan tidak dapat dipulihkan.";
      if (!c.rentalPaid) return "Pembayaran belum lunas.";
      return ok;
    },
  },
};

export function checkTransition(from: OrderStatus, to: OrderStatus, ctx: TransitionContext): TransitionCheck {
  const guard = TRANSITIONS[from]?.[to];
  if (!guard) return { ok: false, reason: `Status tidak bisa diubah dari ${from} ke ${to}.` };
  const reason = guard(ctx);
  return reason ? { ok: false, reason } : { ok: true };
}

/** Lempar `TRANSISI_TIDAK_VALID` jika transisi tidak diizinkan (Req 14.3). */
export function assertTransition(from: OrderStatus, to: OrderStatus, ctx: TransitionContext): void {
  const result = checkTransition(from, to, ctx);
  if (!result.ok) {
    throw new DomainError("TRANSISI_TIDAK_VALID", result.reason, { from, to });
  }
}

/** Status tujuan yang valid saat ini, untuk menampilkan tombol aksi yang relevan saja. */
export function availableTransitions(from: OrderStatus, ctx: TransitionContext): OrderStatus[] {
  return (Object.keys(TRANSITIONS[from] ?? {}) as OrderStatus[]).filter(
    (to) => checkTransition(from, to, ctx).ok,
  );
}

/**
 * Status yang menahan stok (Req 5.2). MENUNGGU_PEMBAYARAN hanya jika belum kedaluwarsa;
 * DIKONFIRMASI "bayar di toko" berhenti menahan stok setelah batas bayar lewat tanpa pembayaran (Req 8.7).
 * Versi query database: `holdingOrderWhere` di server/services/availability.ts.
 */
export function holdsStock(status: OrderStatus, paymentDueAt: Date | null, now: Date, rentalPaid = false): boolean {
  if (status === "DIAMBIL") return true;
  if (status === "DIKONFIRMASI") return rentalPaid || paymentDueAt === null || paymentDueAt.getTime() > now.getTime();
  if (status === "MENUNGGU_PEMBAYARAN") return paymentDueAt !== null && paymentDueAt.getTime() > now.getTime();
  return false;
}
