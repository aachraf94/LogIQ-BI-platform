"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/ui/Sidebar";
import { Topbar } from "@/components/ui/Topbar";
import { motion, AnimatePresence } from "framer-motion";

const PAGE_TITLES: Record<string, string> = {
  "/overview": "Overview",
  "/transport": "Transport Demands",
  "/parcel-costs": "Parcel Costs (CCC)",
  "/routes": "Route Analysis",
  "/alerts": "Alerts",
  "/settings": "Settings",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] ?? "Dashboard";

  return (
    <div className="flex min-h-screen bg-[#161829]">
      <Sidebar />
      <div className="flex-1 flex flex-col" style={{ marginLeft: 240 }}>
        <Topbar title={title} />
        <AnimatePresence mode="wait">
          <motion.main
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="flex-1 p-6 max-w-[1600px] w-full mx-auto"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
