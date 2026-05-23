'use client'

import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, CheckCheck, AlertTriangle, Database, Megaphone, Info } from 'lucide-react'
import { useNotificationStore } from '@/stores/notificationStore'
import { notificationsApi, ApiError } from '@/lib/api'
import type { Notification, NotificationType } from '@/types/api'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  open: boolean
  onClose: () => void
}

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  alert: <AlertTriangle size={14} className="text-red-400" />,
  etl: <Database size={14} className="text-cyan-400" />,
  announcement: <Megaphone size={14} className="text-amber-400" />,
  system: <Info size={14} className="text-slate-400" />,
}

const TYPE_COLOR: Record<NotificationType, string> = {
  alert: 'bg-red-500/10 border-red-500/20',
  etl: 'bg-cyan-500/10 border-cyan-500/20',
  announcement: 'bg-amber-500/10 border-amber-500/20',
  system: 'bg-slate-500/10 border-slate-500/20',
}

function NotifItem({ notif }: { notif: Notification }) {
  const { markRead } = useNotificationStore()

  const handleMarkRead = async () => {
    if (notif.is_read) return
    try {
      await notificationsApi.markRead(notif.id)
      markRead(notif.id)
    } catch {
      // silently ignore
    }
  }

  return (
    <div
      onClick={handleMarkRead}
      className={cn(
        'px-4 py-3 border-b border-[var(--border)] last:border-0 cursor-pointer transition-colors hover:bg-[var(--surface-secondary-60)]',
        !notif.is_read && 'bg-[var(--surface-secondary-40)]'
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 p-1.5 rounded-md border', TYPE_COLOR[notif.type])}>
          {TYPE_ICON[notif.type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn('text-sm', notif.is_read ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)] font-medium')}>
              {notif.title}
            </p>
            {!notif.is_read && (
              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5 line-clamp-2">{notif.body}</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-1">
            {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
          </p>
        </div>
      </div>
    </div>
  )
}

export function NotificationPanel({ open, onClose }: Props) {
  const { notifications, unreadCount, markAllRead } = useNotificationStore()
  const panelRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  const handleMarkAll = async () => {
    try {
      await notificationsApi.markAllRead()
      markAllRead()
    } catch (err) {
      if (!(err instanceof ApiError)) throw err
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 8, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.18 }}
          className="absolute right-0 top-full mt-2 w-96 bg-[var(--surface)] border border-[var(--border)] rounded-xl shadow-2xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-primary" />
              <span className="text-sm font-semibold text-[var(--text-primary)]">Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-primary text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-primary transition-colors"
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-[var(--text-muted)]">
                <Bell size={28} className="mb-2 opacity-40" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => <NotifItem key={n.id} notif={n} />)
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
