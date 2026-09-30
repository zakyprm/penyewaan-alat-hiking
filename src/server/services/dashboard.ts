import "server-only";
import { TZDate } from "@date-fns/tz";
import { returnTimeliness } from "@/lib/domain/fine";
import { BUSINESS_TIME_ZONE } from "@/lib/domain/schedule";
import { db } from "../db";

export interface DashboardPeriod {
  from: Date;
  to: Date;
}

/** Periode default: 30 hari terakhir sampai sekarang. */
export function defaultPeriod(now = new Date()): DashboardPeriod {
  return { from: new Date(now.getTime() - 30 * 24 * 3_600_000), to: now };
}

export interface DashboardData {
  period: DashboardPeriod;
  /** Pendapatan sewa + denda dalam periode (Req 16.1). Deposit TIDAK dihitung (Req 16.3). */
  revenue: { rental: number; fines: number; total: number };
  statusCounts: Record<string, number>;
  itemsCurrentlyRented: number;
  pickupsToday: DashboardOrderRow[];
  returnsToday: DashboardOrderRow[];
  lateOrders: DashboardOrderRow[];
  topItems: { itemId: string; name: string; timesRented: number; unitsRented: number }[];
}

export interface DashboardOrderRow {
  id: string;
  code: string;
  customerName: string;
  startAt: Date;
  endAt: Date;
}

/**
 * Ringkasan dashboard admin (Req 16.1, 16.2, 16.3).
 * Pendapatan dihitung dari `rentalSubtotal` pesanan yang tidak dibatalkan (dipotong tanggal dibuat)
 * ditambah `OrderCharge` (denda) yang dicatat dalam periode. Deposit (`depositTotal`) tidak dihitung.
 */
export async function getDashboard(period: DashboardPeriod, now = new Date()): Promise<DashboardData> {
  const notCancelled = { status: { not: "DIBATALKAN" as const } };

  const [rentalAgg, fineAgg, statusRows, itemsRentedNow, pickupsToday, returnsToday, lateCandidates, topItemsRaw] =
    await Promise.all([
      db.order.aggregate({
        _sum: { rentalSubtotal: true },
        where: { ...notCancelled, createdAt: { gte: period.from, lte: period.to } },
      }),
      db.orderCharge.aggregate({
        _sum: { amount: true },
        where: { createdAt: { gte: period.from, lte: period.to } },
      }),
      db.order.groupBy({ by: ["status"], _count: { _all: true } }),
      db.orderItem.aggregate({
        _sum: { quantity: true },
        where: { order: { status: "DIAMBIL" } },
      }),
      db.order.findMany({
        where: { ...notCancelled, status: { in: ["DIKONFIRMASI"] }, startAt: dayRangeOf(now) },
        select: { id: true, code: true, customerName: true, startAt: true, endAt: true },
        orderBy: { startAt: "asc" },
        take: 50,
      }),
      db.order.findMany({
        where: { status: "DIAMBIL", endAt: dayRangeOf(now) },
        select: { id: true, code: true, customerName: true, startAt: true, endAt: true },
        orderBy: { endAt: "asc" },
        take: 50,
      }),
      db.order.findMany({
        where: { status: "DIAMBIL", endAt: { lt: now } },
        select: { id: true, code: true, customerName: true, startAt: true, endAt: true, graceHours: true },
      }),
      db.orderItem.groupBy({
        by: ["itemId", "itemName"],
        where: { order: { ...notCancelled, createdAt: { gte: period.from, lte: period.to } } },
        _count: { _all: true },
        _sum: { quantity: true },
        orderBy: { _count: { itemId: "desc" } },
        take: 5,
      }),
    ]);

  const statusCounts = Object.fromEntries(statusRows.map((r) => [r.status, r._count._all]));
  const lateOrders = lateCandidates.filter((o) => returnTimeliness(o.endAt, o.graceHours, now) === "TERLAMBAT");

  return {
    period,
    revenue: {
      rental: rentalAgg._sum.rentalSubtotal ?? 0,
      fines: fineAgg._sum.amount ?? 0,
      total: (rentalAgg._sum.rentalSubtotal ?? 0) + (fineAgg._sum.amount ?? 0),
    },
    statusCounts,
    itemsCurrentlyRented: itemsRentedNow._sum.quantity ?? 0,
    pickupsToday,
    returnsToday,
    lateOrders: lateOrders.map(({ id, code, customerName, startAt, endAt }) => ({ id, code, customerName, startAt, endAt })),
    topItems: topItemsRaw.map((r) => ({
      itemId: r.itemId,
      name: r.itemName,
      timesRented: r._count._all,
      unitsRented: r._sum.quantity ?? 0,
    })),
  };
}

/** Rentang waktu "hari ini" dalam WIB, dinyatakan sebagai batas UTC untuk query database. */
function dayRangeOf(now: Date): { gte: Date; lt: Date } {
  const local = new TZDate(now.getTime(), BUSINESS_TIME_ZONE);
  const startOfDay = new TZDate(local.getFullYear(), local.getMonth(), local.getDate(), 0, 0, 0, BUSINESS_TIME_ZONE);
  return { gte: new Date(startOfDay.getTime()), lt: new Date(startOfDay.getTime() + 24 * 3_600_000) };
}
