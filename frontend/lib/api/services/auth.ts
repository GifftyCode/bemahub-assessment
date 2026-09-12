/**
 * Auth service.
 *
 * POST /auth/login - public, no authentication required.
 */
import api from "@/lib/api/client";
import type { LoginResponse } from "@/lib/types/api";

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login", { email, password });
  return data;
}
