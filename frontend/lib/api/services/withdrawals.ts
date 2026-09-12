/**
 * Withdrawals service.
 *
 * POST /me/withdrawals - instructor only.
 *
 * payoutReference is sent BOTH in the body and as the Idempotency-Key
 * header, per the API contract - the server uses it to recognise a repeat
 * of the same attempt and return the original result instead of creating a
 * second withdrawal.
 */
import api from "@/lib/api/client";
import type { Withdrawal } from "@/lib/types/api";

export async function createWithdrawal(
  amountMinor: number,
  payoutReference: string
): Promise<Withdrawal> {
  const { data } = await api.post<Withdrawal>(
    "/me/withdrawals",
    { amountMinor, payoutReference },
    { headers: { "Idempotency-Key": payoutReference } }
  );
  return data;
}
