import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { createItem, resetDatabase, wib } from "@/test/db-fixtures";
import { createWalkInOrder } from "./admin-orders";
import { createQuickItem } from "./items";

const now = wib("2030-01-10T10:00");
const ADMIN = { id: "admin-1", name: "Admin", email: "admin@test.local", role: "ADMIN" as const, phone: null };

async function seedAdmin() {
  await db.user.create({ data: { id: ADMIN.id, name: ADMIN.name, email: ADMIN.email, role: "ADMIN" } });
}

beforeEach(async () => {
  await resetDatabase();
  await seedAdmin();
});

describe("createQuickItem (Req 13.4)", () => {
  it("selalu INTERNAL walau visibility lain dikirim", async () => {
    const category = await db.category.create({ data: { name: "Uji", slug: "uji" } });
    const item = await createQuickItem({
      name: "Kursi Lipat Uji",
      categoryId: category.id,
      pricePerDay: 10_000,
      depositPerUnit: 0,
      stock: 2,
      allowKtp: true,
      // @ts-expect-error -- memastikan input tak terpercaya tidak bisa memaksa PUBLIC
      visibility: "PUBLIC",
    });
    expect(item.visibility).toBe("INTERNAL");
    expect(item.isActive).toBe(true);
  });
});

describe("createWalkInOrder (Req 13.1–13.7)", () => {
  it("tamu tanpa akun: pesanan tersimpan tanpa userId", async () => {
    const item = await createItem({ stock: 3 });
    const order = await createWalkInOrder(
      ADMIN,
      {
        customer: { type: "GUEST", name: "Sari", phone: "081234567890" },
        items: [{ itemId: item.id, quantity: 1 }],
        startAt: now,
        endAt: wib("2030-01-11T10:00"),
        guaranteeType: "DEPOSIT",
        paymentMethod: "BAYAR_DI_TOKO",
        pickupNow: false,
      },
      now,
    );
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved).toMatchObject({ source: "WALK_IN", userId: null, customerName: "Sari", customerPhone: "081234567890", createdById: ADMIN.id });
  });

  it("pelanggan terdaftar: nama dan telepon diambil dari akun", async () => {
    const user = await db.user.create({ data: { id: "cust-1", name: "Budi Terdaftar", email: "budi@test.local", phone: "081200000000" } });
    const item = await createItem({ stock: 3 });
    const order = await createWalkInOrder(
      ADMIN,
      {
        customer: { type: "REGISTERED", userId: user.id },
        items: [{ itemId: item.id, quantity: 1 }],
        startAt: now,
        endAt: wib("2030-01-11T10:00"),
        guaranteeType: "DEPOSIT",
        paymentMethod: "BAYAR_DI_TOKO",
        pickupNow: false,
      },
      now,
    );
    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(saved).toMatchObject({ userId: user.id, customerName: "Budi Terdaftar", customerPhone: "081200000000" });
  });

  it("bisa memesan alat internal (Req 13.3)", async () => {
    const item = await createItem({ visibility: "INTERNAL", stock: 2 });
    const order = await createWalkInOrder(
      ADMIN,
      {
        customer: { type: "GUEST", name: "Sari", phone: "081234567890" },
        items: [{ itemId: item.id, quantity: 1 }],
        startAt: now,
        endAt: wib("2030-01-11T10:00"),
        guaranteeType: "DEPOSIT",
        paymentMethod: "BAYAR_DI_TOKO",
        pickupNow: false,
      },
      now,
    );
    expect(order.status).toBe("DIKONFIRMASI");
  });

  it("pelanggan tidak ditemukan ditolak dengan detail field", async () => {
    const item = await createItem();
    await expect(
      createWalkInOrder(
        ADMIN,
        {
          customer: { type: "REGISTERED", userId: "tidak-ada" },
          items: [{ itemId: item.id, quantity: 1 }],
          startAt: now,
          endAt: wib("2030-01-11T10:00"),
          guaranteeType: "DEPOSIT",
          paymentMethod: "BAYAR_DI_TOKO",
          pickupNow: false,
        },
        now,
      ),
    ).rejects.toMatchObject({ code: "VALIDASI_GAGAL" });
  });

  it("pickupNow: langsung lunas, jaminan diterima (jika KTP), dan DIAMBIL dalam satu langkah (Req 13.7)", async () => {
    const item = await createItem({ stock: 2, pricePerDay: 40_000, depositPerUnit: 0 });
    const order = await createWalkInOrder(
      ADMIN,
      {
        customer: { type: "GUEST", name: "Sari", phone: "081234567890" },
        items: [{ itemId: item.id, quantity: 1 }],
        startAt: now,
        endAt: wib("2030-01-11T10:00"),
        guaranteeType: "KTP",
        paymentMethod: "BAYAR_DI_TOKO",
        pickupNow: true,
        paymentChannel: "TUNAI",
      },
      now,
    );

    const saved = await db.order.findUniqueOrThrow({ where: { id: order.id }, include: { payments: true, guarantee: true } });
    expect(saved.status).toBe("DIAMBIL");
    expect(saved.pickedUpAt).toEqual(now);
    expect(saved.payments).toHaveLength(1);
    expect(saved.payments[0]).toMatchObject({ status: "LUNAS", channel: "TUNAI", amount: order.totalDue });
    expect(saved.guarantee).toMatchObject({ type: "KTP", status: "DITERIMA" });
  });

  it("pickupNow tanpa cukup stok tetap gagal di createOrder, tidak ada langkah lanjutan yang jalan", async () => {
    const item = await createItem({ stock: 1 });
    await createWalkInOrder(
      ADMIN,
      {
        customer: { type: "GUEST", name: "A", phone: "081234567890" },
        items: [{ itemId: item.id, quantity: 1 }],
        startAt: now,
        endAt: wib("2030-01-11T10:00"),
        guaranteeType: "DEPOSIT",
        paymentMethod: "BAYAR_DI_TOKO",
        pickupNow: false,
      },
      now,
    );
    await expect(
      createWalkInOrder(
        ADMIN,
        {
          customer: { type: "GUEST", name: "B", phone: "081200000001" },
          items: [{ itemId: item.id, quantity: 1 }],
          startAt: now,
          endAt: wib("2030-01-11T10:00"),
          guaranteeType: "DEPOSIT",
          paymentMethod: "BAYAR_DI_TOKO",
          pickupNow: true,
          paymentChannel: "TUNAI",
        },
        now,
      ),
    ).rejects.toMatchObject({ code: "STOK_TIDAK_CUKUP" });
    expect(await db.payment.count()).toBe(0);
  });
});
