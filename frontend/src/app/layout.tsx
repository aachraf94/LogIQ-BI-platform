import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LOGIQ — Logistics Intelligence Platform",
  description: "Business Intelligence for Yalidine El Djazair Service",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
