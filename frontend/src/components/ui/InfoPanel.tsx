"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Calculator, Database, RefreshCw, AlertTriangle, BookOpen, Filter, Info, Table2 } from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export interface KpiInfo {
  title: string;
  meaning: string;
  formula?: string;
  source: string[];
  dimensions?: string[];
  updateFreq?: string;
  calcNotes?: string;
  warning?: string;
}

interface InfoPanelProps {
  info: KpiInfo | null;
  onClose: () => void;
  onViewDataTable?: () => void;
}

export function InfoPanel({ info, onClose, onViewDataTable }: InfoPanelProps) {
  const { t, isRTL } = useTranslation();
  const ip = t.pages.common.infoPanel;

  useEffect(() => {
    if (!info) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [info, onClose]);

  const panelSide = isRTL ? "left-0" : "right-0";
  const slideFrom = isRTL ? "-100%" : "100%";
  const borderSide = isRTL ? "border-r" : "border-l";

  return (
    <AnimatePresence>
      {info && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.aside
            dir={isRTL ? "rtl" : "ltr"}
            className={`fixed ${panelSide} top-0 bottom-0 z-50 w-[360px] max-w-[90vw] bg-[var(--surface)] ${borderSide} border-[var(--border)] shadow-2xl flex flex-col overflow-hidden`}
            initial={{ x: slideFrom }}
            animate={{ x: 0 }}
            exit={{ x: slideFrom }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[var(--border)] shrink-0">
              <Info size={14} className="text-primary shrink-0" />
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex-1 truncate">{info.title}</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-secondary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              <PanelSection icon={<BookOpen size={12} />} label={ip.labelMeaning}>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{info.meaning}</p>
              </PanelSection>

              {info.formula && (
                <PanelSection icon={<Calculator size={12} />} label={ip.labelFormula}>
                  <pre className="text-xs font-mono bg-[var(--surface-secondary)] text-primary px-3 py-2.5 rounded-lg leading-relaxed overflow-x-auto whitespace-pre-wrap break-words">{info.formula}</pre>
                </PanelSection>
              )}

              <PanelSection icon={<Database size={12} />} label={ip.labelSource}>
                <div className="flex flex-wrap gap-1.5">
                  {info.source.map((s) => (
                    <code key={s} className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded-md">{s}</code>
                  ))}
                </div>
              </PanelSection>

              {info.dimensions && info.dimensions.length > 0 && (
                <PanelSection icon={<Filter size={12} />} label={ip.labelDimensions}>
                  <div className="flex flex-wrap gap-1.5">
                    {info.dimensions.map((dim) => (
                      <span key={dim} className="text-xs bg-[var(--surface-secondary)] text-[var(--text-secondary)] px-2 py-1 rounded-md">{dim}</span>
                    ))}
                  </div>
                </PanelSection>
              )}

              {info.updateFreq && (
                <PanelSection icon={<RefreshCw size={12} />} label={ip.labelUpdateFreq}>
                  <p className="text-sm text-[var(--text-secondary)]">{info.updateFreq}</p>
                </PanelSection>
              )}

              {info.calcNotes && (
                <PanelSection icon={<BookOpen size={12} />} label={ip.labelCalcNotes}>
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{info.calcNotes}</p>
                </PanelSection>
              )}

              {info.warning && (
                <div className="flex gap-2.5 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">{info.warning}</p>
                </div>
              )}
            </div>

            <div className={`shrink-0 px-5 py-4 border-t border-[var(--border)]`}>
              <button
                onClick={onViewDataTable}
                disabled={!onViewDataTable}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-sm font-medium hover:bg-primary/10 active:scale-[0.98] transition-all disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Table2 size={14} />
                {ip.viewDataTable}
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function PanelSection({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <p className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">{label}</p>
      </div>
      {children}
    </div>
  );
}
