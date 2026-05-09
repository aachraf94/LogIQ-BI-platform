"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Truck,
  Package,
  Route,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/transport", label: "Transport Demands", icon: Truck },
  { href: "/parcel-costs", label: "Parcel Costs (CCC)", icon: Package },
  { href: "/routes", label: "Route Analysis", icon: Route },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: "easeInOut" }}
      className="fixed left-0 top-0 h-full bg-[#1E2030] border-r border-[#2D3050] flex flex-col z-40 overflow-hidden"
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-[#2D3050] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-white font-bold text-lg tracking-tight"
            >
              LOGIQ
            </motion.span>
          )}
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 group",
                active
                  ? "bg-primary/20 text-primary"
                  : "text-slate-400 hover:bg-[#252840] hover:text-slate-200"
              )}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{label}</span>
              )}
              {active && !collapsed && (
                <motion.div
                  layoutId="active-pill"
                  className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="m-3 p-2 rounded-lg bg-[#252840] text-slate-400 hover:text-white hover:bg-[#2D3050] transition-colors flex items-center justify-center"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </motion.aside>
  );
}
