/**
 * Seed data awal: akun admin, kategori, alat (publik + internal), dan pengaturan toko.
 * Aman dijalankan berulang kali (idempotent): data dicocokkan lewat email/slug.
 *
 * Jalankan: npm run db:seed
 */
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient, type Visibility } from "../src/generated/prisma/client";
import { placeholderImage } from "../src/lib/image-hosts";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL belum diatur.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const categories = [
  { name: "Tenda", slug: "tenda" },
  { name: "Carrier", slug: "carrier" },
  { name: "Sleeping Bag", slug: "sleeping-bag" },
  { name: "Alat Masak", slug: "alat-masak" },
  { name: "Penerangan", slug: "penerangan" },
  { name: "Sepatu Hiking", slug: "sepatu-hiking" },
  { name: "Lainnya", slug: "lainnya" },
] as const;

type CategorySlug = (typeof categories)[number]["slug"];

type SeedItem = {
  name: string;
  slug: string;
  category: CategorySlug;
  description: string;
  specs: Record<string, string>;
  pricePerDay: number;
  depositPerUnit: number;
  stock: number;
  visibility?: Visibility;
  allowKtp?: boolean;
};

const items: SeedItem[] = [
  {
    name: "Tenda Dome 2 Orang",
    slug: "tenda-dome-2-orang",
    category: "tenda",
    description: "Tenda double layer yang ringan dan cepat dipasang. Cocok untuk pendakian berdua.",
    specs: { Kapasitas: "2 orang", Berat: "2,2 kg", Lapisan: "Double layer", "Tahan air": "2000 mm" },
    pricePerDay: 35_000,
    depositPerUnit: 100_000,
    stock: 6,
  },
  {
    name: "Tenda Dome 4 Orang",
    slug: "tenda-dome-4-orang",
    category: "tenda",
    description: "Tenda lega untuk rombongan kecil, dengan teras untuk menyimpan carrier.",
    specs: { Kapasitas: "4 orang", Berat: "3,8 kg", Lapisan: "Double layer", "Tahan air": "3000 mm" },
    pricePerDay: 50_000,
    depositPerUnit: 150_000,
    stock: 4,
  },
  {
    name: "Tenda Ultralight 1 Orang",
    slug: "tenda-ultralight-1-orang",
    category: "tenda",
    description: "Tenda solo ultralight untuk pendaki yang mengejar bobot minimal.",
    specs: { Kapasitas: "1 orang", Berat: "1,1 kg", Lapisan: "Double layer", "Tahan air": "3000 mm" },
    pricePerDay: 45_000,
    depositPerUnit: 250_000,
    stock: 2,
    allowKtp: false, // alat bernilai tinggi: hanya jaminan deposit
  },
  {
    name: "Carrier 45 Liter",
    slug: "carrier-45-liter",
    category: "carrier",
    description: "Carrier ukuran sedang untuk pendakian 1-2 hari, dilengkapi rain cover.",
    specs: { Kapasitas: "45 L", Berat: "1,4 kg", "Rain cover": "Ya" },
    pricePerDay: 25_000,
    depositPerUnit: 75_000,
    stock: 5,
  },
  {
    name: "Carrier 60 Liter",
    slug: "carrier-60-liter",
    category: "carrier",
    description: "Carrier besar dengan backsystem yang bisa diatur, untuk pendakian multi-hari.",
    specs: { Kapasitas: "60 L", Berat: "1,9 kg", "Rain cover": "Ya" },
    pricePerDay: 30_000,
    depositPerUnit: 100_000,
    stock: 5,
  },
  {
    name: "Sleeping Bag Polar",
    slug: "sleeping-bag-polar",
    category: "sleeping-bag",
    description: "Sleeping bag polar yang hangat dan ringan untuk suhu gunung tropis.",
    specs: { "Suhu nyaman": "10°C", Berat: "0,8 kg", Bentuk: "Envelope" },
    pricePerDay: 10_000,
    depositPerUnit: 30_000,
    stock: 10,
  },
  {
    name: "Sleeping Bag Down -5°C",
    slug: "sleeping-bag-down-minus-5",
    category: "sleeping-bag",
    description: "Sleeping bag isian bulu angsa untuk suhu dingin di puncak.",
    specs: { "Suhu nyaman": "0°C", "Suhu ekstrem": "-5°C", Berat: "1,0 kg", Bentuk: "Mummy" },
    pricePerDay: 25_000,
    depositPerUnit: 150_000,
    stock: 3,
  },
  {
    name: "Kompor Portable",
    slug: "kompor-portable",
    category: "alat-masak",
    description: "Kompor lipat berbahan bakar gas kaleng. Gas tidak termasuk.",
    specs: { "Bahan bakar": "Gas kaleng butane", Berat: "0,3 kg" },
    pricePerDay: 10_000,
    depositPerUnit: 30_000,
    stock: 8,
  },
  {
    name: "Nesting Set 2-3 Orang",
    slug: "nesting-set",
    category: "alat-masak",
    description: "Set panci dan wajan aluminium yang bisa disusun rapi.",
    specs: { Isi: "2 panci, 1 wajan, 1 mangkuk", Berat: "0,6 kg" },
    pricePerDay: 10_000,
    depositPerUnit: 30_000,
    stock: 6,
  },
  {
    name: "Headlamp",
    slug: "headlamp",
    category: "penerangan",
    description: "Headlamp LED dengan mode terang, redup, dan lampu merah.",
    specs: { Kecerahan: "300 lumen", Baterai: "3x AAA (termasuk)" },
    pricePerDay: 8_000,
    depositPerUnit: 25_000,
    stock: 10,
  },
  {
    name: "Lampu Tenda",
    slug: "lampu-tenda",
    category: "penerangan",
    description: "Lampu gantung isi ulang untuk penerangan di dalam tenda.",
    specs: { Kecerahan: "150 lumen", Daya: "USB rechargeable" },
    pricePerDay: 7_000,
    depositPerUnit: 20_000,
    stock: 8,
  },
  {
    name: "Trekking Pole (Sepasang)",
    slug: "trekking-pole",
    category: "lainnya",
    description: "Tongkat trekking aluminium yang bisa dipanjangkan, sepasang.",
    specs: { Panjang: "65-135 cm", Berat: "0,5 kg per pasang" },
    pricePerDay: 10_000,
    depositPerUnit: 30_000,
    stock: 6,
  },
  {
    name: "Matras Foam",
    slug: "matras-foam",
    category: "lainnya",
    description: "Matras foam lipat sebagai alas tidur di dalam tenda.",
    specs: { Ukuran: "180 x 55 cm", Tebal: "1 cm" },
    pricePerDay: 5_000,
    depositPerUnit: 15_000,
    stock: 12,
  },
  {
    name: "Sepatu Hiking Waterproof (Ukuran 41)",
    slug: "sepatu-hiking-waterproof-41",
    category: "sepatu-hiking",
    description: "Sepatu hiking mid-cut dengan lapisan tahan air dan sol bergerigi untuk jalur basah dan berbatu.",
    specs: { Ukuran: "41", Tipe: "Mid-cut", "Tahan air": "Ya", Berat: "1,1 kg per pasang" },
    pricePerDay: 35_000,
    depositPerUnit: 150_000,
    stock: 3,
    allowKtp: false, // alat bernilai tinggi dan dipakai langsung: hanya deposit
  },
  {
    name: "Sepatu Hiking Waterproof (Ukuran 43)",
    slug: "sepatu-hiking-waterproof-43",
    category: "sepatu-hiking",
    description: "Sepatu hiking mid-cut dengan lapisan tahan air dan sol bergerigi untuk jalur basah dan berbatu.",
    specs: { Ukuran: "43", Tipe: "Mid-cut", "Tahan air": "Ya", Berat: "1,2 kg per pasang" },
    pricePerDay: 35_000,
    depositPerUnit: 150_000,
    stock: 3,
    allowKtp: false,
  },
  // --- Alat internal: tidak tampil di katalog, hanya untuk sewa walk-in ---
  {
    name: "Kursi Lipat Camping",
    slug: "kursi-lipat-camping",
    category: "lainnya",
    description: "Kursi lipat ringan untuk camping ground.",
    specs: { Beban: "maks. 100 kg", Berat: "0,9 kg" },
    pricePerDay: 10_000,
    depositPerUnit: 30_000,
    stock: 4,
    visibility: "INTERNAL",
  },
  {
    name: "Hammock",
    slug: "hammock",
    category: "lainnya",
    description: "Hammock parasut lengkap dengan tali webbing.",
    specs: { Beban: "maks. 150 kg", Berat: "0,5 kg" },
    pricePerDay: 12_000,
    depositPerUnit: 40_000,
    stock: 3,
    visibility: "INTERNAL",
  },
];

async function seedAdmin() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@sewahiking.test").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "admin12345";
  if (password.length < 8) throw new Error("SEED_ADMIN_PASSWORD minimal 8 karakter.");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    // Pastikan tetap admin, tapi jangan timpa password yang mungkin sudah diganti.
    await db.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
    console.log(`• Admin sudah ada: ${email}`);
    return;
  }

  const userId = randomUUID();
  await db.user.create({
    data: {
      id: userId,
      name: "Admin Toko",
      email,
      emailVerified: true,
      role: "ADMIN",
      accounts: {
        // Format akun email/password milik Better Auth
        create: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          password: await hashPassword(password),
        },
      },
    },
  });
  console.log(`• Admin dibuat: ${email}`);
}

async function seedCatalog() {
  const categoryIds = new Map<string, string>();
  for (const c of categories) {
    const row = await db.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: c,
    });
    categoryIds.set(c.slug, row.id);
  }
  console.log(`• ${categories.length} kategori`);

  for (const { category, ...item } of items) {
    const data = {
      ...item,
      categoryId: categoryIds.get(category)!,
      visibility: item.visibility ?? "PUBLIC",
      allowKtp: item.allowKtp ?? true,
    };
    const row = await db.item.upsert({
      where: { slug: item.slug },
      update: data,
      create: data,
      include: { _count: { select: { images: true } } },
    });
    // Placeholder hanya untuk alat tanpa foto, supaya foto yang diunggah admin tidak tertimpa
    if (row._count.images === 0) {
      await db.itemImage.create({ data: { itemId: row.id, url: placeholderImage(item.name), order: 0 } });
    }
  }
  const internal = items.filter((i) => i.visibility === "INTERNAL").length;
  console.log(`• ${items.length} alat (${items.length - internal} publik, ${internal} internal)`);
}

async function seedSettings() {
  // Hanya buat jika belum ada, supaya pengaturan yang sudah diubah admin tidak tertimpa.
  await db.setting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  console.log("• Pengaturan toko");
}

async function main() {
  console.log("Menjalankan seed...");
  await seedAdmin();
  await seedCatalog();
  await seedSettings();
  console.log("Seed selesai.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
