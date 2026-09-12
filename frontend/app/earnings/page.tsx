"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import api from "@/lib/api/client";
import { useAuthStore } from "@/lib/auth/authStore";
import { StatusMessage } from "@/components/StatusMessage";
import { formatMoney } from "@/lib/format";
import type { Earnings } from "@/lib/types/api";

async function getEarnings(): Promise<Earnings> {
  const { data } = await api.get<Earnings>("/me/earnings");
  return data;
}

export default function EarningsPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["earnings"],
    queryFn: getEarnings,
    enabled: !!token,
  });

  if (!token) {
    return (
      <StatusMessage
        state="error"
        message="You need to sign in to view your earnings."
      />
    );
  }

  if (isLoading) {
    return <StatusMessage state="loading" />;
  }

  if (isError) {
    if (axios.isAxiosError(error) && !error.response) {
      return (
        <StatusMessage
          state="error"
          message="Could not reach the server. Check your connection and try again."
        />
      );
    }

    if (axios.isAxiosError(error) && error.response?.status === 403) {
      return (
        <StatusMessage
          state="error"
          message="Your account does not have access to earnings. Instructors only."
        />
      );
    }

    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return (
        <StatusMessage
          state="error"
          message="Your session has expired. Please sign in again."
        />
      );
    }

    return (
      <StatusMessage
        state="error"
        message="Something went wrong loading your earnings."
      />
    );
  }

  const earnings = data as Earnings;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">
          Earnings {user ? `— ${user.name}` : ""}
        </h1>
        <button
          onClick={signOut}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
        >
          Sign out
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-md border border-slate-200 bg-white p-4 text-sm">
        <div>
          <dt className="text-slate-500">Available</dt>
          <dd className="text-lg font-semibold text-slate-900">
            {formatMoney(earnings.availableMinor, earnings.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Pending</dt>
          <dd className="text-lg font-semibold text-slate-900">
            {formatMoney(earnings.pendingMinor, earnings.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Minimum withdrawal</dt>
          <dd className="text-slate-700">
            {formatMoney(earnings.minimumWithdrawalMinor, earnings.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Last withdrawal</dt>
          <dd className="text-slate-700">
            {earnings.lastWithdrawalAt ?? "—"}
          </dd>
        </div>
      </dl>

      <Link href="/withdrawals" className="text-sm text-slate-600 underline">
        Request a withdrawal →
      </Link>
    </div>
  );
}
