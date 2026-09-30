import { expect, it } from "vitest";
import * as prisma from "@/generated/prisma/enums";
import * as domain from "./types";

// Menjaga daftar enum domain tetap sama dengan enum di prisma/schema.prisma.
it.each([
  ["Role", domain.ROLES],
  ["Visibility", domain.VISIBILITIES],
  ["OrderSource", domain.ORDER_SOURCES],
  ["OrderStatus", domain.ORDER_STATUSES],
  ["PaymentMethod", domain.PAYMENT_METHODS],
  ["PaymentStatus", domain.PAYMENT_STATUSES],
  ["PaymentPurpose", domain.PAYMENT_PURPOSES],
  ["PaymentChannel", domain.PAYMENT_CHANNELS],
  ["GuaranteeType", domain.GUARANTEE_TYPES],
  ["GuaranteeStatus", domain.GUARANTEE_STATUSES],
  ["ChargeType", domain.CHARGE_TYPES],
] as const)("enum %s sesuai skema Prisma", (name, values) => {
  expect([...values].sort()).toEqual(Object.values(prisma[name]).sort());
});
