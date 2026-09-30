import { z } from "zod";
import { dateTimeSchema } from "./common";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

/** GET /admin/dashboard?from&to. Rentang tidak valid (from > to) diabaikan, jatuh ke default. */
export const dashboardQuerySchema = z.object({
  from: z.preprocess(emptyToUndefined, z.string().optional()).transform((v) => (v ? dateTimeSchema.safeParse(v).data : undefined)).catch(undefined),
  to: z.preprocess(emptyToUndefined, z.string().optional()).transform((v) => (v ? dateTimeSchema.safeParse(v).data : undefined)).catch(undefined),
});
export type DashboardQuery = z.output<typeof dashboardQuerySchema>;
