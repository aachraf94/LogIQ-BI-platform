"use client";

import { motion } from "framer-motion";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-start justify-between mb-6"
    >
      <div>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {subtitle && (
          <p className="text-sm text-slate-400 mt-1">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </motion.div>
  );
}
