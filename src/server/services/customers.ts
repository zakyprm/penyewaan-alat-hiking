import "server-only";
import { z } from "zod";
import { DomainError } from "@/lib/domain/errors";
import type { OrderStatus } from "@/lib/domain/types";
import { normalizePhone } from "@/lib/validation/common";
import { db } from "../db";

export const customerSearchQuerySchema = z.object({
  q: z.string().trim().max(100).default(""),
});

export interface CustomerOption {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

export interface CustomerSummary extends CustomerOption {
  createdAt: Date;
  orderCount: number;
  totalFines: number;
}

/**
 * Daftar/cari pelanggan terdaftar (Req 15.1). Kata kunci kosong mengembalikan semua pelanggan.
 * Dipakai juga oleh pemilih pelanggan di form sewa walk-in (Req 13.2) — di sana pencarian baru
 * dijalankan setelah 2 karakter, tapi itu dibatasi di klien, bukan di sini.
 */
export async function listCustomers(q = ""): Promise<CustomerSummary[]> {
  const term = q.trim();
  const rows = await db.user.findMany({
    where: {
      role: "CUSTOMER",
      ...(term
        ? {
            OR: [
              { name: { contains: term, mode: "insensitive" } },
              { email: { contains: term, mode: "insensitive" } },
              { phone: { contains: normalizePhone(term) } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      orders: { select: { charges: { select: { amount: true } } } },
    },
    orderBy: { name: "asc" },
    take: 200,
  });
  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    createdAt: u.createdAt,
    orderCount: u.orders.length,
    totalFines: u.orders.reduce((sum, o) => sum + o.charges.reduce((s, c) => s + c.amount, 0), 0),
  }));
}

/** @deprecated Alias lama; pakai `listCustomers`. */
export const searchCustomers = listCustomers;

export interface CustomerOrderSummary {
  code: string;
  status: OrderStatus;
  startAt: Date;
  endAt: Date;
  totalDue: number;
  totalFines: number;
}

export interface CustomerDetail {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: Date;
  orders: CustomerOrderSummary[];
  totalFines: number;
}

/** Detail pelanggan: riwayat pesanan dan total denda (Req 15.2). */
export async function getCustomerDetail(id: string): Promise<CustomerDetail> {
  const user = await db.user.findFirst({
    where: { id, role: "CUSTOMER" },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          code: true,
          status: true,
          startAt: true,
          endAt: true,
          rentalSubtotal: true,
          depositTotal: true,
          charges: { select: { amount: true } },
        },
      },
    },
  });
  if (!user) throw new DomainError("TIDAK_DITEMUKAN", "Pelanggan tidak ditemukan.");

  const orders = user.orders.map((o) => ({
    code: o.code,
    status: o.status,
    startAt: o.startAt,
    endAt: o.endAt,
    totalDue: o.rentalSubtotal + o.depositTotal,
    totalFines: o.charges.reduce((sum, c) => sum + c.amount, 0),
  }));

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.createdAt,
    orders,
    totalFines: orders.reduce((sum, o) => sum + o.totalFines, 0),
  };
}
