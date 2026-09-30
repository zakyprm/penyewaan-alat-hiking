import { z } from "zod";
import { ORDER_SOURCES, ORDER_STATUSES, PAYMENT_METHODS } from "../domain/types";
import { dateTimeSchema } from "./common";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

/** GET /admin/orders — filter dan pencarian (Req 14.1, 14.2). Nilai tidak valid diabaikan. */
export const adminOrderListQuerySchema = z.object({
  status: z.preprocess(emptyToUndefined, z.enum(ORDER_STATUSES).optional()).catch(undefined),
  source: z.preprocess(emptyToUndefined, z.enum(ORDER_SOURCES).optional()).catch(undefined),
  method: z.preprocess(emptyToUndefined, z.enum(PAYMENT_METHODS).optional()).catch(undefined),
  q: z.preprocess(emptyToUndefined, z.string().trim().max(100).optional()).catch(undefined),
  from: z.preprocess(emptyToUndefined, z.string().optional()).transform((v) => (v ? dateTimeSchema.safeParse(v).data : undefined)).catch(undefined),
  to: z.preprocess(emptyToUndefined, z.string().optional()).transform((v) => (v ? dateTimeSchema.safeParse(v).data : undefined)).catch(undefined),
});
export type AdminOrderListQuery = z.output<typeof adminOrderListQuerySchema>;
