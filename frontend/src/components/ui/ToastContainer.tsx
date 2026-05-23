'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Database, Megaphone, Info, X } from 'lucide-react'
import { useNotificationStore } from '@/stores/notificationStore'
import type { NotificationType } from '@/types/api'
import { cn } from '@/lib/utils'

const ICONS: Record<NotificationType, React.ReactNode> = {
  alert: <AlertTriangle size={15} className="text-red-400" />,
  etl: <Database size={15} className="text-cyan-400" />,
  announcement: <Megaphone size={15} className="text-amber-400" />,
  system: <Info size={15} className="text-slate-400" />,
}

const BORDERS: Record<NotificationType, string> = {
  alert: 'border-l-red-500',
  etl: 'border-l-cyan-500',
  announcement: 'border-l-amber-500',
  system: 'border-l-slate-500',
}

const AUTO_DISMISS_MS = 5_000

function Toast({ id, notification }: { id: number; notification: import('@/types/api').Notification }) {
  const dismissToast = useNotificationStore((s) => s.dismissToast)

  useEffect(() => {
    const t = setTimeout(() => dismissToast(id), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [id, dismissToast])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 60 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'flex items-start gap-3 bg-[var(--surface)] border border-[var(--border)] border-l-4 rounded-xl p-4 shadow-2xl w-80 max-w-full',
        BORDERS[notification.type]
      )}
    >
      <div className="shrink-0 mt-0.5">{ICONS[notification.type]}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{notification.title}</p>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">{notification.body}</p>
      </div>
      <button
        onClick={() => dismissToast(id)}
        className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
      >
        <X size={14} />
      </button>
    </motion.div>
  )
}

export function ToastContainer() {
  const toasts = useNotificationStore((s) => s.toasts)

  return (
    <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-2 items-end">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <Toast key={t.id} id={t.id} notification={t.notification} />
        ))}
      </AnimatePresence>
    </div>
  )
}
