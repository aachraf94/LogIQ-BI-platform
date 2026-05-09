"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { User, Users, Bell, Link2 } from "lucide-react";
import { mockUsers } from "@/lib/mock-data";
import type { User as UserType } from "@/types/user";
import type { Column } from "@/components/ui/DataTable";
import { DataTable } from "@/components/ui/DataTable";

type Tab = "profile" | "users" | "notifications" | "integrations";

const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "profile", label: "Profile", icon: <User size={15} /> },
  { id: "users", label: "Users", icon: <Users size={15} /> },
  { id: "notifications", label: "Notifications", icon: <Bell size={15} /> },
  { id: "integrations", label: "Integrations", icon: <Link2 size={15} /> },
];

const userColumns: Column<UserType>[] = [
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  {
    key: "role",
    header: "Role",
    render: (u) => {
      const colors = { Admin: "text-primary bg-primary/10", Analyst: "text-cyan-400 bg-cyan-400/10", Viewer: "text-slate-400 bg-slate-400/10" };
      return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[u.role]}`}>{u.role}</span>;
    },
  },
  { key: "department", header: "Department" },
  { key: "createdAt", header: "Joined", render: (u) => <span className="text-slate-500 text-xs">{u.createdAt}</span> },
];

const integrations = [
  { name: "Yalidine App", description: "Main operational database (MySQL)", status: "connected", color: "#10B981" },
  { name: "FLEETGO", description: "Fleet management & GPS tracking", status: "connected", color: "#10B981" },
  { name: "ITOP", description: "IT operations & incident tracking", status: "disconnected", color: "#EF4444" },
];

const notifChannels = [
  { label: "Email Alerts", desc: "Receive alerts via email", key: "email", default: true },
  { label: "In-App Notifications", desc: "See alerts inside the dashboard", key: "app", default: true },
  { label: "SMS Alerts", desc: "Critical alerts via SMS (Djezzy/Ooredoo)", key: "sms", default: false },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const [toggles, setToggles] = useState(
    Object.fromEntries(notifChannels.map((c) => [c.key, c.default]))
  );

  return (
    <div className="space-y-6">
      {/* Tab navigation */}
      <div className="flex gap-2 bg-[#1E2030] border border-[#2D3050] rounded-xl p-1.5 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* Profile tab */}
        {activeTab === "profile" && (
          <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-6 max-w-lg">
            <h3 className="font-semibold text-white mb-5">Profile Information</h3>
            <div className="space-y-4">
              {[
                { label: "Full Name", value: "Karim Benmoussa", type: "text" },
                { label: "Email", value: "k.benmoussa@yalidine.dz", type: "email" },
                { label: "Role", value: "Administrator", type: "text" },
                { label: "Department", value: "Operations", type: "text" },
              ].map((field) => (
                <div key={field.label}>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">{field.label}</label>
                  <input
                    type={field.type}
                    defaultValue={field.value}
                    className="w-full bg-[#252840] border border-[#2D3050] rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              ))}
              <button className="mt-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/80 transition-colors">
                Save Changes
              </button>
            </div>
          </div>
        )}

        {/* Users tab */}
        {activeTab === "users" && (
          <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">Team Members</h3>
              <button className="px-3 py-1.5 bg-primary text-white text-xs font-medium rounded-lg hover:bg-primary/80 transition-colors">
                + Invite User
              </button>
            </div>
            <DataTable columns={userColumns} data={mockUsers} />
          </div>
        )}

        {/* Notifications tab */}
        {activeTab === "notifications" && (
          <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-6 max-w-lg">
            <h3 className="font-semibold text-white mb-5">Alert Channels</h3>
            <div className="space-y-4">
              {notifChannels.map((channel) => (
                <div key={channel.key} className="flex items-center justify-between p-4 bg-[#252840] rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-white">{channel.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{channel.desc}</p>
                  </div>
                  <button
                    onClick={() =>
                      setToggles((t) => ({ ...t, [channel.key]: !t[channel.key] }))
                    }
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      toggles[channel.key] ? "bg-primary" : "bg-[#3D4267]"
                    }`}
                  >
                    <span
                      className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                        toggles[channel.key] ? "left-6" : "left-1"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Integrations tab */}
        {activeTab === "integrations" && (
          <div>
            <h3 className="font-semibold text-white mb-4">Connected Systems</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {integrations.map((int) => (
                <div key={int.name} className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-lg bg-[#252840] flex items-center justify-center">
                      <Link2 size={20} className="text-primary" />
                    </div>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        color: int.color,
                        backgroundColor: int.color + "20",
                      }}
                    >
                      {int.status}
                    </span>
                  </div>
                  <h4 className="font-semibold text-white text-sm">{int.name}</h4>
                  <p className="text-xs text-slate-400 mt-1">{int.description}</p>
                  <button className="mt-4 w-full py-1.5 text-xs font-medium text-slate-400 border border-[#2D3050] rounded-lg hover:border-primary hover:text-primary transition-colors">
                    Configure
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
