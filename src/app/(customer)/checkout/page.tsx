import type { Metadata } from "next";
import { CheckoutForm, CheckoutSummary } from "@/components/checkout/checkout-form";
import { isMidtransEnabled } from "@/server/midtrans";
import { requireUserPage } from "@/server/session";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage() {
  const user = await requireUserPage();

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Checkout</h1>
      <CheckoutSummary />
      <CheckoutForm defaultName={user.name} defaultPhone={user.phone ?? ""} midtransEnabled={isMidtransEnabled()} />
    </main>
  );
}
