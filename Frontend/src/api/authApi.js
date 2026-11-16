import { api } from "./client";

export async function registerUser(payload) {
  const { data } = await api.post("/api/v1/users", payload);
  return data;
}

export async function loginUser(payload) {
  const { data } = await api.post("/api/v1/auth/login", payload);
  return data;
}

export async function logoutUser(refreshToken) {
  if (!refreshToken) return;
  await api.post("/api/v1/auth/logout", { refreshToken });
}