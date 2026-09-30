import { fail } from "@/server/http";

/** Endpoint /api/v1 yang tidak ada tetap dijawab dengan format error JSON yang sama. */
const notFound = () => fail("TIDAK_DITEMUKAN", "Endpoint tidak ditemukan.", 404);

export { notFound as GET, notFound as POST, notFound as PUT, notFound as PATCH, notFound as DELETE };
