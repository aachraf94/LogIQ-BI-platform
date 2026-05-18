import { create } from 'zustand'
import type { Notification } from '@/types/api'

export interface Toast {
  id: number
  notification: Notification
}

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  toasts: Toast[]

  setNotifications: (notifs: Notification[]) => void
  prependNotification: (notif: Notification) => void
  setUnreadCount: (count: number) => void
  markRead: (id: number) => void
  markAllRead: () => void
  addToast: (notif: Notification) => void
  dismissToast: (id: number) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  toasts: [],

  setNotifications: (notifications) => set({ notifications }),

  prependNotification: (notif) =>
    set((s) => ({
      notifications: [notif, ...s.notifications],
      unreadCount: s.unreadCount + 1,
    })),

  setUnreadCount: (unreadCount) => set({ unreadCount }),

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, is_read: true } : n
      ),
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, is_read: true })),
      unreadCount: 0,
    })),

  addToast: (notification) =>
    set((s) => ({
      toasts: [...s.toasts, { id: notification.id, notification }].slice(-5),
    })),

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
