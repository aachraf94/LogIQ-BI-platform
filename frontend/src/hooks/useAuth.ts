"use client";

import { useAuthStore } from "@/stores/authStore";

export function useAuth() {
  const { isAuthenticated, userName, userEmail, userRole, login, logout } =
    useAuthStore();
  return { isAuthenticated, userName, userEmail, userRole, login, logout };
}
