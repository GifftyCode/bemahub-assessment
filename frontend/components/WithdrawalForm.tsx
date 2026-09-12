"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { useQueryClient } from "@tanstack/react-query";
import { createWithdrawalSchema, type WithdrawalFormValues } from "@/lib/validation/withdrawal";
import { createWithdrawal } from "@/lib/api/services/withdrawals";
import { formatMoney } from "@/lib/format";

export function WithdrawalForm({
  minimumMinor,
  availableMinor,
  currency,
}: {
  minimumMinor: number;
  availableMinor: number;
  currency: string;
}) {
  const queryClient = useQueryClient();
  const schema = createWithdrawalSchema(minimumMinor, availableMinor, currency);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<WithdrawalFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "" },
  });

  const [payoutReference, setPayoutReference] = useState(() => crypto.randomUUID());
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);

  async function onSubmit(values: WithdrawalFormValues) {
    setSuccessMessage(null);
    setBannerError(null);
    const amountMinor = Math.round(parseFloat(values.amount) * 100);

    try {
      const withdrawal = await createWithdrawal(amountMinor, payoutReference);
      setSuccessMessage(
        `Withdrawal of ${formatMoney(withdrawal.amountMinor, currency)} requested successfully.`
      );
      reset();
      setPayoutReference(crypto.randomUUID());
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        const code = error.response.data?.code;
        const message = error.response.data?.message;

        if (code === "below_minimum" || code === "insufficient_balance") {
          setError("amount", { message });
          return;
        }

        if (code === "withdrawal_in_progress") {
          setBannerError(message);
          return;
        }
      }

      setBannerError("Something went wrong submitting your withdrawal. Please try again.");
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-3 rounded-md border border-slate-200 bg-white p-4"
    >
      <h2 className="text-sm font-semibold text-slate-900">Request a withdrawal</h2>

      <div>
        <label htmlFor="amount" className="block text-sm text-slate-600">
          Amount ({currency})
        </label>
        <input
          id="amount"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          {...register("amount")}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {errors.amount && (
          <p className="mt-1 text-sm text-red-700">{errors.amount.message}</p>
        )}
      </div>

      {bannerError && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {bannerError}
        </div>
      )}
      {successMessage && (
        <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {isSubmitting ? "Submitting…" : "Request withdrawal"}
      </button>
    </form>
  );
}
