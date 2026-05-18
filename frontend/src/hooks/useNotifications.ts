'use client'

import { useEffect, useRef, useCallback } from 'react'
import { notificationsApi } from '@/lib/api'
import { useNotificationStore } from '@/stores/notificationStore'
import { useAuthStore } from '@/stores/authStore'
import type { Notification } from '@/types/api'

export function useNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const { setNotifications, setUnreadCount, prependNotification, addToast } =
    useNotificationStore()
  const esRef = useRef<EventSource | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadInitial = useCallback(async () => {
    try {
      const [notifs, counts] = await Promise.all([
        notificationsApi.list(),
        notificationsApi.count(),
      ])
      setNotifications(notifs)
      setUnreadCount(counts.unread)
    } catch {
      // silently ignore — SSE count event will sync later
    }
  }, [setNotifications, setUnreadCount])

  const connect = useCallback(() => {
    if (!isAuthenticated) return

    const url = notificationsApi.streamUrl()
    const es = new EventSource(url)
    esRef.current = es

    es.addEventListener('notification', (e: MessageEvent) => {
      const notif: Notification = JSON.parse(e.data)
      prependNotification(notif)
      addToast(notif)
    })

    es.addEventListener('count', (e: MessageEvent) => {
      const { unread }: { unread: number } = JSON.parse(e.data)
      setUnreadCount(unread)
    })

    es.onerror = () => {
      es.close()
      esRef.current = null
      // Exponential-ish reconnect: 5 s
      reconnectTimer.current = setTimeout(connect, 5_000)
    }
  }, [isAuthenticated, prependNotification, addToast, setUnreadCount])

  useEffect(() => {
    if (!isAuthenticated) return

    loadInitial()
    connect()

    return () => {
      esRef.current?.close()
      esRef.current = null
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
  }, [isAuthenticated, loadInitial, connect])
}
