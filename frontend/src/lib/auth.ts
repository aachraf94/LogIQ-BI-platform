/**
 * Auth helpers — mock implementation.
 * Replace with real JWT handling when backend is ready.
 */

export function mockLogin(email: string, password: string): boolean {
  return email.endsWith("@yalidine.dz") && password.length >= 6;
}

export function getStoredUser() {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("logiq_user");
  return stored ? JSON.parse(stored) : null;
}

export function storeUser(user: object) {
  localStorage.setItem("logiq_user", JSON.stringify(user));
}

export function clearUser() {
  localStorage.removeItem("logiq_user");
}
