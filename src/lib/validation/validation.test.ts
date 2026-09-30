import { describe, expect, it } from "vitest";
import { slugify } from "../slug";
import {
  checkoutSchema,
  imageUrlSchema,
  itemCreateSchema,
  itemUpdateSchema,
  normalizePhone,
  phoneSchema,
  quickItemSchema,
  returnOrderSchema,
  settingsSchema,
  walkInOrderSchema,
} from ".";

const firstError = (result: { success: boolean; error?: { issues: { message: string; path: PropertyKey[] }[] } }) =>
  result.error?.issues[0];

describe("slugify", () => {
  it.each([
    ["Tenda Dome 2 Orang", "tenda-dome-2-orang"],
    ["Sleeping Bag Down -5°C", "sleeping-bag-down-5c"],
    ["  Kompor  Portable!! ", "kompor-portable"],
    ["Café Ñandú", "cafe-nandu"],
  ])("%s → %s", (input, expected) => expect(slugify(input)).toBe(expected));
});

describe("nomor HP", () => {
  it.each([
    ["081234567890", "081234567890"],
    ["+62 812-3456-7890", "081234567890"],
    ["6281234567890", "081234567890"],
  ])("%s → %s", (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
    expect(phoneSchema.parse(input)).toBe(expected);
  });

  it.each(["12345", "0212345678", "08abc", ""])("menolak %s", (input) => {
    expect(phoneSchema.safeParse(input).success).toBe(false);
  });
});

describe("checkoutSchema", () => {
  const valid = {
    items: [{ itemId: "tenda", quantity: 1 }],
    startAt: "2026-09-27T10:00:00+07:00",
    endAt: "2026-09-29T10:00:00+07:00",
    guaranteeType: "KTP",
    paymentMethod: "BAYAR_DI_TOKO",
    customerName: "Budi",
    customerPhone: "+62 812 3456 7890",
  };

  it("menerima input valid dan mengonversi waktu ke Date UTC", () => {
    const out = checkoutSchema.parse(valid);
    expect(out.startAt).toBeInstanceOf(Date);
    expect(out.startAt.toISOString()).toBe("2026-09-27T03:00:00.000Z");
    expect(out.customerPhone).toBe("081234567890");
  });

  it("menolak waktu tanpa zona waktu", () => {
    expect(checkoutSchema.safeParse({ ...valid, startAt: "2026-09-27T10:00:00" }).success).toBe(false);
  });

  it("menolak waktu kembali sebelum waktu ambil", () => {
    const r = checkoutSchema.safeParse({ ...valid, endAt: "2026-09-26T10:00:00+07:00" });
    expect(firstError(r)?.path).toEqual(["endAt"]);
  });

  it("menolak keranjang kosong, jumlah 0, dan alat duplikat", () => {
    expect(checkoutSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, items: [{ itemId: "tenda", quantity: 0 }] }).success).toBe(false);
    const dup = checkoutSchema.safeParse({
      ...valid,
      items: [
        { itemId: "tenda", quantity: 1 },
        { itemId: "tenda", quantity: 2 },
      ],
    });
    expect(firstError(dup)?.message).toBe("Alat yang sama tidak boleh muncul dua kali");
  });

  it("menolak jaminan dan metode bayar yang tidak dikenal", () => {
    expect(checkoutSchema.safeParse({ ...valid, guaranteeType: "SIM" }).success).toBe(false);
    expect(checkoutSchema.safeParse({ ...valid, paymentMethod: "KREDIT" }).success).toBe(false);
  });
});

describe("walkInOrderSchema", () => {
  const base = {
    customer: { type: "GUEST", name: "Sari", phone: "081234567890" },
    items: [{ itemId: "hammock", quantity: 1 }],
    startAt: "2026-09-26T10:00:00+07:00",
    endAt: "2026-09-27T10:00:00+07:00",
    guaranteeType: "KTP",
  };

  it("default: bayar di toko, tidak diambil langsung", () => {
    const out = walkInOrderSchema.parse(base);
    expect(out.paymentMethod).toBe("BAYAR_DI_TOKO");
    expect(out.pickupNow).toBe(false);
  });

  it("pelanggan terdaftar cukup userId", () => {
    expect(walkInOrderSchema.safeParse({ ...base, customer: { type: "REGISTERED", userId: "u1" } }).success).toBe(
      true,
    );
  });

  it("ambil langsung wajib memilih cara bayar", () => {
    const r = walkInOrderSchema.safeParse({ ...base, pickupNow: true });
    expect(firstError(r)?.path).toEqual(["paymentChannel"]);
    expect(walkInOrderSchema.safeParse({ ...base, pickupNow: true, paymentChannel: "TUNAI" }).success).toBe(true);
  });

  it("cara bayar manual tidak boleh MIDTRANS", () => {
    expect(walkInOrderSchema.safeParse({ ...base, pickupNow: true, paymentChannel: "MIDTRANS" }).success).toBe(false);
  });
});

describe("skema alat", () => {
  const item = { name: "Tenda Dome 2 Orang", categoryId: "cat1", pricePerDay: 35_000, stock: 6 };

  it("create mengisi nilai default", () => {
    expect(itemCreateSchema.parse(item)).toMatchObject({
      depositPerUnit: 0,
      visibility: "PUBLIC",
      allowKtp: true,
      isActive: true,
    });
  });

  it("update tidak mengisi default (PATCH tidak mengubah field lain)", () => {
    expect(itemUpdateSchema.parse({ stock: 3 })).toEqual({ stock: 3 });
    expect(itemUpdateSchema.safeParse({}).success).toBe(false);
  });

  it("menolak harga pecahan, harga terlalu kecil, dan stok negatif", () => {
    expect(itemCreateSchema.safeParse({ ...item, pricePerDay: 35_000.5 }).success).toBe(false);
    expect(itemCreateSchema.safeParse({ ...item, pricePerDay: 500 }).success).toBe(false);
    expect(itemCreateSchema.safeParse({ ...item, stock: -1 }).success).toBe(false);
  });

  it("tambah alat cepat butuh stok minimal 1", () => {
    expect(quickItemSchema.safeParse({ ...item, stock: 0 }).success).toBe(false);
    expect(quickItemSchema.parse(item)).toMatchObject({ depositPerUnit: 0, allowKtp: true });
  });
});

describe("imageUrlSchema", () => {
  it.each([
    "/uploads/items/dc6285cf-5186-4de3-980e-85c8113f1f99.png",
    "https://placehold.co/800x600/2F5D50/FFFFFF.png?text=Tenda",
  ])("menerima %s", (url) => expect(imageUrlSchema.safeParse(url).success).toBe(true));

  it.each([
    "https://situs-lain.test/a.jpg",
    "http://placehold.co/a.png", // bukan https
    "https://placehold.co.evil.test/a.png",
    "javascript:alert(1)",
    "/uploads/items/../../.env",
  ])("menolak %s", (url) => expect(imageUrlSchema.safeParse(url).success).toBe(false));
});

describe("returnOrderSchema", () => {
  it("denda manual hanya kerusakan/kehilangan, TELAT dihitung sistem", () => {
    expect(returnOrderSchema.parse({})).toEqual({ charges: [] });
    const charge = { orderItemId: "oi1", amount: 50_000, note: "Frame patah" };
    expect(returnOrderSchema.safeParse({ charges: [{ ...charge, type: "KERUSAKAN" }] }).success).toBe(true);
    expect(returnOrderSchema.safeParse({ charges: [{ ...charge, type: "TELAT" }] }).success).toBe(false);
  });
});

describe("settingsSchema (Req 17)", () => {
  const settings = {
    graceHours: 12,
    lateFinePercent: 100,
    depositEnabled: true,
    ktpEnabled: true,
    onlinePaymentExpiryMin: 60,
    payAtStoreCancelHours: 24,
    openHour: 8,
    closeHour: 21,
  };

  it("menerima pengaturan default", () => {
    expect(settingsSchema.safeParse(settings).success).toBe(true);
  });

  it("minimal satu jaminan aktif", () => {
    const r = settingsSchema.safeParse({ ...settings, depositEnabled: false, ktpEnabled: false });
    expect(firstError(r)?.message).toBe("Minimal satu jenis jaminan harus aktif");
  });

  it("jam tutup harus setelah jam buka", () => {
    expect(settingsSchema.safeParse({ ...settings, openHour: 21, closeHour: 8 }).success).toBe(false);
  });
});
