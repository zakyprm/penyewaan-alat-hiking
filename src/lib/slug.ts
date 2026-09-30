/** "Sleeping Bag Down -5°C" → "sleeping-bag-down-5c" */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // hapus tanda diakritik
    .toLowerCase()
    .replace(/[°'’]/g, "") // simbol yang menempel pada kata: "-5°C" → "-5c"
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}
