import "server-only";
import { settingsSchema, type SettingsInput } from "@/lib/validation/settings";
import { db } from "../db";

export type ShopSettings = SettingsInput;

const SETTINGS_ID = 1;

function pick(row: ShopSettings): ShopSettings {
  return {
    graceHours: row.graceHours,
    lateFinePercent: row.lateFinePercent,
    depositEnabled: row.depositEnabled,
    ktpEnabled: row.ktpEnabled,
    onlinePaymentExpiryMin: row.onlinePaymentExpiryMin,
    payAtStoreCancelHours: row.payAtStoreCancelHours,
    openHour: row.openHour,
    closeHour: row.closeHour,
  };
}

/** Pengaturan toko. Jika baris belum ada (misal seed belum dijalankan), dibuat dengan nilai default. */
export async function getSettings(): Promise<ShopSettings> {
  const row = await db.setting.upsert({ where: { id: SETTINGS_ID }, update: {}, create: { id: SETTINGS_ID } });
  return pick(row);
}

/**
 * Ubah sebagian pengaturan (Req 17.1). Hasil gabungan divalidasi utuh, sehingga aturan
 * lintas-field (minimal satu jaminan aktif, jam tutup > jam buka) tetap berlaku (Req 17.2).
 * Pesanan yang sudah dibuat tidak terpengaruh karena kebijakannya disalin ke pesanan (Req 10.5).
 */
export async function updateSettings(changes: Partial<ShopSettings>): Promise<ShopSettings> {
  const merged = settingsSchema.parse({ ...(await getSettings()), ...changes });
  const row = await db.setting.update({ where: { id: SETTINGS_ID }, data: merged });
  return pick(row);
}

/** Pengaturan yang aman ditampilkan ke pelanggan (semua berupa kebijakan toko, tanpa data sensitif). */
export type PublicSettings = ShopSettings;
export const toPublicSettings = (settings: ShopSettings): PublicSettings => pick(settings);
