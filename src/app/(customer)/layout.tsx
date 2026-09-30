import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { requireUserPage } from "@/server/session";

/** Semua halaman di grup ini butuh login (Req 1.3). Setiap page tetap memanggil requireUserPage(). */
export default async function CustomerLayout({ children }: LayoutProps<"/">) {
  await requireUserPage();
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col">{children}</div>
      <SiteFooter />
    </>
  );
}
