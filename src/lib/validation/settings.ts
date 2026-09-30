import { z } from "zod";

const int = (min: number, max: number, label: string) =>
  z.int(`${label} harus bilangan bulat`).min(min, `${label} minimal ${min}`).max(max, `${label} maksimal ${max}`);

/** Field pengaturan toko tanpa aturan lintas-field, supaya bisa dipakai ulang untuk PATCH. */
const settingsFields = z.object({
  graceHours: int(0, 72, "Grace period"),
  lateFinePercent: int(0, 500, "Persentase denda"),
  depositEnabled: z.boolean(),
  ktpEnabled: z.boolean(),
  onlinePaymentExpiryMin: int(15, 1440, "Batas bayar online"),
  payAtStoreCancelHours: int(0, 168, "Batas bayar di toko"),
  openHour: int(0, 23, "Jam buka"),
  closeHour: int(1, 24, "Jam tutup"),
});

/** Pengaturan toko lengkap (Req 17). */
export const settingsSchema = settingsFields
  .refine((s) => s.depositEnabled || s.ktpEnabled, {
    error: "Minimal satu jenis jaminan harus aktif", // Req 17.2
    path: ["ktpEnabled"],
  })
  .refine((s) => s.openHour < s.closeHour, { error: "Jam tutup harus setelah jam buka", path: ["closeHour"] });
export type SettingsInput = z.infer<typeof settingsSchema>;

/**
 * PATCH /admin/settings: field apa pun boleh dikirim, field asing ditolak.
 * Aturan lintas-field divalidasi setelah digabung dengan pengaturan saat ini (services/settings.ts).
 */
export const settingsPatchSchema = settingsFields
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { error: "Tidak ada perubahan yang dikirim" });
export type SettingsPatchInput = z.infer<typeof settingsPatchSchema>;
