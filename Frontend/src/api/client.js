
import axios from "axios";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

export const WS_URL =
  import.meta.env.VITE_WS_URL || "ws://localhost:8080/ws";

export const AUTH_STORAGE_KEY = "hushtalk_auth";

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

let refreshPromise = null;

function readStoredAuth() {
  try {
    return JSON.parse(
      localStorage.getItem(AUTH_STORAGE_KEY) || "null"
    );
  } catch {
    return null;
  }
}

function notifyAuthUpdated(auth) {
  window.dispatchEvent(
    new CustomEvent("hushtalk:auth-updated", {
      detail: auth
    })
  );
}

function expireSession() {
  localStorage.removeItem(AUTH_STORAGE_KEY);
  applyAccessToken(null);

  window.dispatchEvent(
    new Event("hushtalk:auth-expired")
  );
}

export function applyAccessToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization =
      `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export async function refreshAccessToken() {
  const auth = readStoredAuth();

  if (!auth?.refreshToken) {
    expireSession();
    throw new Error("Your session has expired. Please log in again.");
  }

  if (!refreshPromise) {
    refreshPromise = axios.post(
      `${API_BASE_URL}/api/v1/auth/refresh`,
      {
        refreshToken: auth.refreshToken
      },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    )
      .then(({ data }) => {
        if (!data.accessToken || !data.refreshToken) {
          throw new Error("Invalid token refresh response.");
        }

        localStorage.setItem(
          AUTH_STORAGE_KEY,
          JSON.stringify(data)
        );

        applyAccessToken(data.accessToken);
        notifyAuthUpdated(data);

        return data;
      })
      .catch((error) => {
        expireSession();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const auth = readStoredAuth();

  if (auth?.accessToken) {
    config.headers.Authorization =
      `Bearer ${auth.accessToken}`;
  }

  return config;
});

function isAuthenticationRequest(config) {
  const url = config.url || "";

  return (
    url.includes("/api/v1/auth/login") ||
    url.includes("/api/v1/auth/refresh") ||
    url.includes("/api/v1/auth/logout") ||
    (
      url.includes("/api/v1/users") &&
      (config.method || "get").toLowerCase() === "post"
    )
  );
}

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      isAuthenticationRequest(originalRequest)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const refreshedAuth = await refreshAccessToken();

      originalRequest.headers.Authorization =
        `Bearer ${refreshedAuth.accessToken}`;

      return api(originalRequest);

    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  }
);

export function getErrorMessage(error) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.detail ||
    error?.message ||
    "Something went wrong."
  );
}

export function getUserIdFromToken(token) {
  try {
    const payload = token.split(".")[1];

    const base64 = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const padded = base64.padEnd(
      Math.ceil(base64.length / 4) * 4,
      "="
    );

    const decoded = JSON.parse(atob(padded));

    return decoded.userId ?? null;

  } catch {
    return null;
  }
}
