'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Truck, Package, Route, Bell, ArrowRight, CheckCircle } from 'lucide-react'
import { meApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const STEPS = [
  {
    icon: <LayoutDashboard size={32} className="text-primary" />,
    title: 'Welcome to LOGIQ',
    description:
      'Your Logistics Intelligence Platform. Get real-time insights across transport, parcels, and routes — all in one place.',
  },
  {
    icon: <Truck size={32} className="text-cyan-400" />,
    title: 'Transport Dashboard',
    description:
      'Monitor demand volumes, cost trends, and status breakdowns. Filter by date range and compare across periods.',
  },
  {
    icon: <Package size={32} className="text-emerald-400" />,
    title: 'Parcel Costs (CCC)',
    description:
      'Analyze cost composition per parcel — transport, handling, storage. Track deviations and identify cost drivers.',
  },
  {
    icon: <Route size={32} className="text-amber-400" />,
    title: 'Route Analysis',
    description:
      'Optimize routes by efficiency score. Compare actual vs. optimized costs and identify high-savings opportunities.',
  },
  {
    icon: <Bell size={32} className="text-red-400" />,
    title: 'Smart Alerts',
    description:
      'Threshold-based alerts fire automatically when KPIs breach limits. Acknowledge and track all incidents in real time.',
  },
]

interface Props {
  open: boolean
  onDone: () => void
}

export function OnboardingModal({ open, onDone }: Props) {
  const [step, setStep] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const updateUser = useAuthStore((s) => s.updateUser)

  const isLast = step === STEPS.length - 1
  const current = STEPS[step]

  const handleNext = async () => {
    if (!isLast) {
      setStep((s) => s + 1)
      return
    }

    setFinishing(true)
    try {
      await meApi.completeOnboarding()
      updateUser({ has_completed_onboarding: true })
    } catch {
      // not critical — just close
    } finally {
      onDone()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="w-full max-w-md bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Progress bar */}
            <div className="h-1 bg-[var(--surface-tertiary)]">
              <motion.div
                className="h-full bg-primary"
                animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>

            {/* Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
                className="p-8 flex flex-col items-center text-center"
              >
                <div className="w-20 h-20 rounded-2xl bg-[var(--surface-secondary)] flex items-center justify-center mb-6">
                  {current.icon}
                </div>
                <h2 className="text-xl font-bold text-[var(--text-primary)] mb-3">{current.title}</h2>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{current.description}</p>
              </motion.div>
            </AnimatePresence>

            {/* Footer */}
            <div className="px-8 pb-8 flex items-center justify-between">
              {/* Dots */}
              <div className="flex gap-1.5">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={`rounded-full transition-all duration-300 ${
                      i === step ? 'w-4 h-1.5 bg-primary' : 'w-1.5 h-1.5 bg-[var(--toggle-off)]'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={handleNext}
                disabled={finishing}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/80 transition-colors disabled:opacity-60"
              >
                {finishing ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isLast ? (
                  <>
                    <CheckCircle size={15} />
                    Get Started
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
