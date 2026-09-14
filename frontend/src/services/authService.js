import apiClient from "./apiClient";

const AUTH_TOKEN_KEY = "revalue_auth_token";
const USER_STORAGE_KEY = "revalue_user";

function persistAuth(token, user) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_TOKEN_KEY, token);
  if (user) {
    window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(USER_STORAGE_KEY);
  }
}

function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_TOKEN_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

function normalizeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    location: user.location,
    createdAt: user.createdAt
  };
}

export async function register(userData) {
  const response = await apiClient.post("/auth/register", userData);
  const payload = response?.data || response;
  const user = normalizeUser(payload?.user || payload);
  const loginResult = await login({ email: userData.email, password: userData.password });
  if (loginResult?.token) {
    persistAuth(loginResult.token, loginResult.user || user);
  }
  return loginResult || { user, token: null };
}

export async function login(credentials) {
  const response = await apiClient.post("/auth/login", credentials);
  const payload = response?.data || response;
  const token = payload?.token || null;
  const user = normalizeUser(payload?.user || payload);
  if (token) {
    persistAuth(token, user);
  }
  return { user, token };
}

export function logout() {
  clearAuth();
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}

export function getCurrentUser() {
  if (typeof window === "undefined") return null;
  const rawUser = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!rawUser) return null;
  try {
    return JSON.parse(rawUser);
  } catch {
    return null;
  }
}

export async function getProfile() {
  const response = await apiClient.get("/profile");
  const payload = response?.data || response;
  return normalizeUser(payload?.user || payload?.profile || payload);
}

export async function refreshUser() {
  const token = getToken();
  if (!token) {
    clearAuth();
    return null;
  }

  try {
    const user = await getProfile();
    if (user) {
      persistAuth(token, user);
      return user;
    }
    clearAuth();
    return null;
  } catch (error) {
    clearAuth();
    throw error;
  }
}
