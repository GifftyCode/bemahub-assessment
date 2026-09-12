/**
 * Withdrawal form validation.
 *
 * The schema is built fresh from the CURRENT minimumWithdrawalMinor and
 * availableMinor on every render, rather than a fixed constant, because both
 * numbers come from the API and can change server-side (e.g. a balance that
 * updates, or a minimum the business changes). Hardcoding either would drift
 * from the real rule silently.
 */
import { z } from "zod";
import { formatMoney } from "@/lib/format";

export function createWithdrawalSchema(
  minimumMinor: number,
  availableMinor: number,
  currency: string
) {
  return z.object({
    amount: z
      .string()
      .min(1, "Enter an amount.")
      .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount, e.g. 500.00")
      .superRefine((value, ctx) => {
        const minor = Math.round(parseFloat(value) * 100);

        if (!Number.isInteger(minor) || minor <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Enter a positive amount.",
          });
          return;
        }

        if (minor < minimumMinor) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Minimum withdrawal is ${formatMoney(minimumMinor, currency)}.`,
          });
        }

        if (minor > availableMinor) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `You only have ${formatMoney(availableMinor, currency)} available.`,
          });
        }
      }),
  });
}

export type WithdrawalFormValues = z.infer<ReturnType<typeof createWithdrawalSchema>>;
