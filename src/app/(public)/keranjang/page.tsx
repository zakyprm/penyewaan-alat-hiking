import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Keranjang", robots: { index: false } };

/** Keranjang tidak butuh login; login diminta saat checkout (Req 1.3). */
export default async function CartPage() {
  const settings = await getSettings();
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Keranjang</h1>
      <CartView openHour={settings.openHour} closeHour={settings.closeHour} />
    </main>
  );
}
