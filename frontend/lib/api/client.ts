/**
 * Shared axios instance.
 *
 * The request interceptor is wired for you: it attaches the stored bearer
 * token. You should not need to set the Authorization header by hand anywhere
 * else in the app.
 */
import axios from "axios";
import { getStoredToken, useAuthStore } from "@/lib/auth/authStore";

const baseURL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/wp-json/bemalearn/v1";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A transport failure (server unreachable, DNS, CORS, timeout) never gets
    // an error.response at all. A business refusal (401, 403, 422...) always
    // does. We deliberately do NOT collapse these into one shape here - the
    // caller needs error.response to tell them apart, so we pass the
    // original axios error straight through and only handle the ONE side
    // effect that belongs globally: if the server says our token is no
    // longer valid (401), that token is dead everywhere in the app, so we
    // clear it here once rather than making every page remember to do it.
    if (error.response?.status === 401) {
      useAuthStore.getState().signOut();
    }
    return Promise.reject(error);
  }
);

export default api;
