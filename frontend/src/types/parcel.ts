export interface ParcelCostBreakdown {
  date: string;
  transportCost: number;
  handlingCost: number;
  storageCost: number;
  totalCost: number;
}

export interface SankeyNode {
  name: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

export interface ParcelScatterPoint {
  weight: number;
  cost: number;
  distance: number;
  city: string;
}

export interface CostAlert {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  city: string;
  actualValue: number;
  threshold: number;
  createdAt: string;
}
