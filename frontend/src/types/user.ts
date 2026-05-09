export type UserRole = "Admin" | "Analyst" | "Viewer";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  affectedKpi: string;
  triggeredValue: number;
  threshold: number;
  unit: string;
  status: "active" | "resolved";
  createdAt: string;
  resolvedAt?: string;
}
