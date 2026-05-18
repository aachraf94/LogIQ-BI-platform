import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/api'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isFirstLogin: boolean

  // Derived display fields (kept for backward compat with components)
  userName: string
  userEmail: string
  userRole: string

  setAuth: (user: User, access: string, refresh: string, isFirstLogin?: boolean) => void
  updateUser: (user: Partial<User>) => void
  setTokens: (access: string, refresh: string) => void
  logout: () => void
}

function deriveDisplay(user: User) {
  return {
    userName: [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username,
    userEmail: user.email,
    userRole: user.role?.display_name ?? (user.is_superuser ? 'Superadmin' : ''),
  }
}

const EMPTY: Pick<AuthState, 'user' | 'accessToken' | 'refreshToken' | 'isAuthenticated' | 'isFirstLogin' | 'userName' | 'userEmail' | 'userRole'> = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isFirstLogin: false,
  userName: '',
  userEmail: '',
  userRole: '',
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      ...EMPTY,

      setAuth: (user, access, refresh, isFirstLogin = false) =>
        set({
          user,
          accessToken: access,
          refreshToken: refresh,
          isAuthenticated: true,
          isFirstLogin,
          ...deriveDisplay(user),
        }),

      updateUser: (partial) =>
        set((state) => {
          if (!state.user) return state
          const user = { ...state.user, ...partial }
          return { user, ...deriveDisplay(user) }
        }),

      setTokens: (access, refresh) =>
        set({ accessToken: access, refreshToken: refresh }),

      logout: () => set({ ...EMPTY }),
    }),
    {
      name: 'logiq-auth',
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        refreshToken: s.refreshToken,
        isAuthenticated: s.isAuthenticated,
        userName: s.userName,
        userEmail: s.userEmail,
        userRole: s.userRole,
      }),
    }
  )
)
