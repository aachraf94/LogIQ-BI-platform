import type {
  MonthlyDemandData,
  TransportDemand,
  DemandByCity,
  HeatmapCell,
} from "@/types/transport";
import type {
  ParcelCostBreakdown,
  SankeyData,
  ParcelScatterPoint,
  CostAlert,
} from "@/types/parcel";
import type { Route, NetworkNode, NetworkLink } from "@/types/route";
import type { Alert, User } from "@/types/user";

// ─── Algerian cities with real approximate GPS coordinates ───────────────────
export const ALGERIAN_CITIES: Record<string, { lat: number; lng: number }> = {
  Algiers: { lat: 36.7372, lng: 3.0865 },
  Oran: { lat: 35.6969, lng: -0.6331 },
  Constantine: { lat: 36.365, lng: 6.6147 },
  Annaba: { lat: 36.9, lng: 7.7667 },
  Sétif: { lat: 36.19, lng: 5.4119 },
  Batna: { lat: 35.5559, lng: 6.1741 },
  Tlemcen: { lat: 34.8782, lng: -1.3147 },
  Béjaïa: { lat: 36.7517, lng: 5.0567 },
  Blida: { lat: 36.47, lng: 2.8277 },
  Djelfa: { lat: 34.6703, lng: 3.263 },
};

// ─── KPI Summary ────────────────────────────────────────────────────────────
export const kpiData = {
  totalDemands: { value: 14250, trend: 8.3, unit: "" },
  totalRevenue: { value: 28500000, trend: 12.1, unit: "DZD" },
  avgCostPerParcel: { value: 350, trend: -3.2, unit: "DZD" },
  profitMargin: { value: 23.4, trend: 1.8, unit: "%" },
  activeVehicles: { value: 87, trend: 4.8, unit: "" },
  onTimeDeliveryRate: { value: 91.2, trend: 2.1, unit: "%" },
};

// ─── Monthly demand trends (12 months) ──────────────────────────────────────
export const monthlyDemandData: MonthlyDemandData[] = [
  { month: "Apr 2024", accepted: 850, rejected: 95, pending: 55, totalRevenue: 1950000, totalCost: 1490000, avgCostPerDemand: 1490 },
  { month: "May 2024", accepted: 920, rejected: 88, pending: 62, totalRevenue: 2150000, totalCost: 1640000, avgCostPerDemand: 1520 },
  { month: "Jun 2024", accepted: 1050, rejected: 102, pending: 48, totalRevenue: 2480000, totalCost: 1900000, avgCostPerDemand: 1560 },
  { month: "Jul 2024", accepted: 1180, rejected: 115, pending: 75, totalRevenue: 2750000, totalCost: 2100000, avgCostPerDemand: 1580 },
  { month: "Aug 2024", accepted: 1090, rejected: 98, pending: 52, totalRevenue: 2560000, totalCost: 1950000, avgCostPerDemand: 1545 },
  { month: "Sep 2024", accepted: 980, rejected: 90, pending: 60, totalRevenue: 2300000, totalCost: 1750000, avgCostPerDemand: 1530 },
  { month: "Oct 2024", accepted: 1150, rejected: 108, pending: 72, totalRevenue: 2700000, totalCost: 2050000, avgCostPerDemand: 1565 },
  { month: "Nov 2024", accepted: 1320, rejected: 125, pending: 85, totalRevenue: 3100000, totalCost: 2370000, avgCostPerDemand: 1590 },
  { month: "Dec 2024", accepted: 1580, rejected: 142, pending: 98, totalRevenue: 3750000, totalCost: 2880000, avgCostPerDemand: 1620 },
  { month: "Jan 2025", accepted: 1050, rejected: 99, pending: 61, totalRevenue: 2480000, totalCost: 1890000, avgCostPerDemand: 1540 },
  { month: "Feb 2025", accepted: 980, rejected: 92, pending: 58, totalRevenue: 2310000, totalCost: 1760000, avgCostPerDemand: 1520 },
  { month: "Mar 2025", accepted: 1100, rejected: 104, pending: 68, totalRevenue: 2580000, totalCost: 1970000, avgCostPerDemand: 1550 },
];

// ─── Demand by region ────────────────────────────────────────────────────────
export const demandByCity: DemandByCity[] = [
  { city: "Algiers", value: 4250, revenue: 9800000 },
  { city: "Oran", value: 2800, revenue: 6450000 },
  { city: "Constantine", value: 2100, revenue: 4830000 },
  { city: "Annaba", value: 1350, revenue: 3105000 },
  { city: "Sétif", value: 1050, revenue: 2415000 },
  { city: "Batna", value: 850, revenue: 1955000 },
  { city: "Tlemcen", value: 680, revenue: 1564000 },
  { city: "Béjaïa", value: 520, revenue: 1196000 },
  { city: "Blida", value: 410, revenue: 943000 },
  { city: "Djelfa", value: 240, revenue: 552000 },
];

// ─── Top routes by volume ────────────────────────────────────────────────────
export const topRoutesByVolume = [
  { route: "Algiers → Oran", volume: 2840 },
  { route: "Algiers → Constantine", volume: 2350 },
  { route: "Oran → Tlemcen", volume: 1620 },
  { route: "Algiers → Blida", volume: 1580 },
  { route: "Constantine → Annaba", volume: 1340 },
  { route: "Algiers → Sétif", volume: 1180 },
  { route: "Algiers → Béjaïa", volume: 980 },
  { route: "Algiers → Batna", volume: 870 },
  { route: "Oran → Algiers", volume: 820 },
  { route: "Sétif → Constantine", volume: 760 },
];

// ─── Demand heatmap (city × day of week) ────────────────────────────────────
const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const cities = ["Algiers", "Oran", "Constantine", "Annaba", "Sétif", "Batna", "Tlemcen", "Béjaïa", "Blida", "Djelfa"];
const heatmapBase = [420, 280, 210, 135, 105, 85, 68, 52, 41, 24];

export const heatmapData: HeatmapCell[] = cities.flatMap((city, ci) =>
  days.map((day, di) => ({
    city,
    day,
    volume: Math.round(
      heatmapBase[ci] * (di === 5 || di === 6 ? 0.3 : 0.85 + Math.random() * 0.3)
    ),
  }))
);

// ─── Transport demand table rows ─────────────────────────────────────────────
export const transportDemands: TransportDemand[] = [
  { id: "DEM-2025-00142", client: "Sonatrach Distribution", origin: "Algiers", destination: "Oran", date: "2025-04-08", cost: 18500, revenue: 24000, parcelCount: 48, status: "accepted" },
  { id: "DEM-2025-00141", client: "Cevital Group", origin: "Béjaïa", destination: "Algiers", date: "2025-04-08", cost: 12800, revenue: 16500, parcelCount: 32, status: "accepted" },
  { id: "DEM-2025-00140", client: "Atlas Express SARL", origin: "Constantine", destination: "Annaba", date: "2025-04-07", cost: 9200, revenue: 11800, parcelCount: 22, status: "accepted" },
  { id: "DEM-2025-00139", client: "Mobilis Retail", origin: "Algiers", destination: "Blida", date: "2025-04-07", cost: 4800, revenue: 6200, parcelCount: 15, status: "accepted" },
  { id: "DEM-2025-00138", client: "BioPharm SARL", origin: "Sétif", destination: "Constantine", date: "2025-04-07", cost: 7600, revenue: 9800, parcelCount: 18, status: "pending" },
  { id: "DEM-2025-00137", client: "Saveurs d'Algérie", origin: "Oran", destination: "Tlemcen", date: "2025-04-06", cost: 5200, revenue: 6800, parcelCount: 12, status: "accepted" },
  { id: "DEM-2025-00136", client: "Electro-Ménager Plus", origin: "Algiers", destination: "Batna", date: "2025-04-06", cost: 22400, revenue: 28000, parcelCount: 55, status: "rejected" },
  { id: "DEM-2025-00135", client: "Pharmacie Centrale", origin: "Constantine", destination: "Algiers", date: "2025-04-05", cost: 11200, revenue: 14500, parcelCount: 28, status: "accepted" },
  { id: "DEM-2025-00134", client: "TechnoAlgérie", origin: "Algiers", destination: "Oran", date: "2025-04-05", cost: 16800, revenue: 21500, parcelCount: 42, status: "accepted" },
  { id: "DEM-2025-00133", client: "Hamoud Boualem SA", origin: "Blida", destination: "Algiers", date: "2025-04-04", cost: 3600, revenue: 4800, parcelCount: 10, status: "pending" },
  { id: "DEM-2025-00132", client: "Djezzy Business", origin: "Algiers", destination: "Djelfa", date: "2025-04-04", cost: 19200, revenue: 24800, parcelCount: 50, status: "accepted" },
  { id: "DEM-2025-00131", client: "Condor Electronics", origin: "Sétif", destination: "Algiers", date: "2025-04-03", cost: 14400, revenue: 18600, parcelCount: 36, status: "accepted" },
];

// ─── Parcel cost breakdown (last 30 days) ────────────────────────────────────
export const parcelCostBreakdown: ParcelCostBreakdown[] = Array.from(
  { length: 30 },
  (_, i) => {
    const date = new Date(2025, 2, 12 + i);
    const base = 280 + Math.sin(i * 0.4) * 30 + Math.random() * 20;
    return {
      date: date.toISOString().split("T")[0],
      transportCost: Math.round(base * 0.58),
      handlingCost: Math.round(base * 0.25),
      storageCost: Math.round(base * 0.17),
      totalCost: Math.round(base),
    };
  }
);

// ─── Cost Sankey data ────────────────────────────────────────────────────────
export const sankeyData: SankeyData = {
  nodes: [
    { name: "Total Cost" },
    { name: "Transport" },
    { name: "Handling" },
    { name: "Storage" },
    { name: "Algiers Zone" },
    { name: "East Zone" },
    { name: "West Zone" },
    { name: "South Zone" },
    { name: "Delivered Cost" },
    { name: "Returned Cost" },
  ],
  links: [
    { source: "Total Cost", target: "Transport", value: 58 },
    { source: "Total Cost", target: "Handling", value: 25 },
    { source: "Total Cost", target: "Storage", value: 17 },
    { source: "Transport", target: "Algiers Zone", value: 24 },
    { source: "Transport", target: "East Zone", value: 18 },
    { source: "Transport", target: "West Zone", value: 10 },
    { source: "Transport", target: "South Zone", value: 6 },
    { source: "Handling", target: "Algiers Zone", value: 10 },
    { source: "Handling", target: "East Zone", value: 8 },
    { source: "Handling", target: "West Zone", value: 7 },
    { source: "Storage", target: "Algiers Zone", value: 8 },
    { source: "Storage", target: "East Zone", value: 5 },
    { source: "Storage", target: "West Zone", value: 4 },
    { source: "Algiers Zone", target: "Delivered Cost", value: 36 },
    { source: "East Zone", target: "Delivered Cost", value: 25 },
    { source: "West Zone", target: "Delivered Cost", value: 18 },
    { source: "South Zone", target: "Delivered Cost", value: 5 },
    { source: "Algiers Zone", target: "Returned Cost", value: 6 },
    { source: "East Zone", target: "Returned Cost", value: 6 },
    { source: "West Zone", target: "Returned Cost", value: 3 },
  ],
};

// ─── Parcel scatter plot ─────────────────────────────────────────────────────
export const parcelScatterData: ParcelScatterPoint[] = Array.from(
  { length: 80 },
  (_, i) => {
    const cityKeys = Object.keys(ALGERIAN_CITIES);
    const city = cityKeys[i % cityKeys.length];
    const weight = 0.5 + Math.random() * 25;
    const distance = 80 + Math.random() * 700;
    const cost = Math.round(weight * 12 + distance * 0.38 + Math.random() * 50);
    return { weight: Math.round(weight * 10) / 10, cost, distance: Math.round(distance), city };
  }
);

// ─── Routes ──────────────────────────────────────────────────────────────────
export const routes: Route[] = [
  { id: "R001", origin: "Algiers", destination: "Oran", distance: 363, avgDuration: 285, actualCost: 18500, optimizedCost: 15200, savingsPotential: 3300, costPerKm: 51, volume: 2840, efficiencyScore: 82 },
  { id: "R002", origin: "Algiers", destination: "Constantine", distance: 431, avgDuration: 330, actualCost: 22400, optimizedCost: 18100, savingsPotential: 4300, costPerKm: 52, volume: 2350, efficiencyScore: 81 },
  { id: "R003", origin: "Oran", destination: "Tlemcen", distance: 140, avgDuration: 110, actualCost: 7200, optimizedCost: 6800, savingsPotential: 400, costPerKm: 51, volume: 1620, efficiencyScore: 94 },
  { id: "R004", origin: "Algiers", destination: "Blida", distance: 48, avgDuration: 55, actualCost: 2800, optimizedCost: 2200, savingsPotential: 600, costPerKm: 58, volume: 1580, efficiencyScore: 79 },
  { id: "R005", origin: "Constantine", destination: "Annaba", distance: 168, avgDuration: 130, actualCost: 9600, optimizedCost: 7800, savingsPotential: 1800, costPerKm: 57, volume: 1340, efficiencyScore: 81 },
  { id: "R006", origin: "Algiers", destination: "Sétif", distance: 298, avgDuration: 235, actualCost: 15800, optimizedCost: 12400, savingsPotential: 3400, costPerKm: 53, volume: 1180, efficiencyScore: 78 },
  { id: "R007", origin: "Algiers", destination: "Béjaïa", distance: 272, avgDuration: 215, actualCost: 14200, optimizedCost: 11800, savingsPotential: 2400, costPerKm: 52, volume: 980, efficiencyScore: 83 },
  { id: "R008", origin: "Algiers", destination: "Batna", distance: 431, avgDuration: 340, actualCost: 24600, optimizedCost: 19200, savingsPotential: 5400, costPerKm: 57, volume: 870, efficiencyScore: 78 },
  { id: "R009", origin: "Algiers", destination: "Djelfa", distance: 296, avgDuration: 240, actualCost: 16800, optimizedCost: 13500, savingsPotential: 3300, costPerKm: 57, volume: 620, efficiencyScore: 80 },
  { id: "R010", origin: "Sétif", destination: "Constantine", distance: 132, avgDuration: 105, actualCost: 7400, optimizedCost: 6200, savingsPotential: 1200, costPerKm: 56, volume: 760, efficiencyScore: 84 },
];

// ─── Network map data ────────────────────────────────────────────────────────
export const networkNodes: NetworkNode[] = Object.entries(ALGERIAN_CITIES).map(
  ([city, coords]) => ({
    id: city,
    city,
    lat: coords.lat,
    lng: coords.lng,
    volume: demandByCity.find((d) => d.city === city)?.value ?? 0,
  })
);

export const networkLinks: NetworkLink[] = [
  { source: "Algiers", target: "Oran", volume: 2840, cost: 18500 },
  { source: "Algiers", target: "Constantine", volume: 2350, cost: 22400 },
  { source: "Oran", target: "Tlemcen", volume: 1620, cost: 7200 },
  { source: "Algiers", target: "Blida", volume: 1580, cost: 2800 },
  { source: "Constantine", target: "Annaba", volume: 1340, cost: 9600 },
  { source: "Algiers", target: "Sétif", volume: 1180, cost: 15800 },
  { source: "Algiers", target: "Béjaïa", volume: 980, cost: 14200 },
  { source: "Algiers", target: "Batna", volume: 870, cost: 24600 },
  { source: "Sétif", target: "Constantine", volume: 760, cost: 7400 },
  { source: "Algiers", target: "Djelfa", volume: 620, cost: 16800 },
  { source: "Oran", target: "Algiers", volume: 820, cost: 18200 },
  { source: "Batna", target: "Djelfa", volume: 380, cost: 12400 },
];

// ─── Alerts ──────────────────────────────────────────────────────────────────
export const alerts: Alert[] = [
  {
    id: "ALT-001",
    severity: "critical",
    title: "Cost Overrun — Algiers → Batna",
    description: "Transport cost per parcel exceeded threshold by 34% over the last 7 days.",
    affectedKpi: "Cost per Parcel",
    triggeredValue: 580,
    threshold: 430,
    unit: "DZD",
    status: "active",
    createdAt: "2025-04-09T08:23:00Z",
  },
  {
    id: "ALT-002",
    severity: "warning",
    title: "Demand Spike — Constantine Hub",
    description: "Incoming demand volume increased by 47% vs 30-day average.",
    affectedKpi: "Daily Demand Volume",
    triggeredValue: 285,
    threshold: 194,
    unit: "demands/day",
    status: "active",
    createdAt: "2025-04-09T10:45:00Z",
  },
  {
    id: "ALT-003",
    severity: "warning",
    title: "Profit Margin Drop — South Zone",
    description: "Djelfa route profit margin fell below 15% threshold.",
    affectedKpi: "Profit Margin",
    triggeredValue: 12.8,
    threshold: 15,
    unit: "%",
    status: "active",
    createdAt: "2025-04-08T14:12:00Z",
  },
  {
    id: "ALT-004",
    severity: "info",
    title: "Storage Cost Increase",
    description: "Average storage cost per parcel rose 18% due to depot congestion at Oran.",
    affectedKpi: "Storage Cost",
    triggeredValue: 68,
    threshold: 58,
    unit: "DZD",
    status: "active",
    createdAt: "2025-04-08T09:30:00Z",
  },
  {
    id: "ALT-005",
    severity: "critical",
    title: "Vehicle Utilization Low — Annaba",
    description: "Fleet utilization in Annaba dropped to 41%, below the 65% minimum.",
    affectedKpi: "Vehicle Utilization",
    triggeredValue: 41,
    threshold: 65,
    unit: "%",
    status: "active",
    createdAt: "2025-04-07T16:55:00Z",
  },
  {
    id: "ALT-006",
    severity: "warning",
    title: "On-Time Delivery Drop — Sétif Route",
    description: "On-time delivery rate for Algiers → Sétif fell to 78%, below 85% SLA.",
    affectedKpi: "On-Time Rate",
    triggeredValue: 78,
    threshold: 85,
    unit: "%",
    status: "resolved",
    createdAt: "2025-04-06T11:20:00Z",
    resolvedAt: "2025-04-07T08:00:00Z",
  },
  {
    id: "ALT-007",
    severity: "info",
    title: "New High — Monthly Revenue",
    description: "March 2025 revenue reached 2.58M DZD, a new monthly record.",
    affectedKpi: "Monthly Revenue",
    triggeredValue: 2580000,
    threshold: 2400000,
    unit: "DZD",
    status: "resolved",
    createdAt: "2025-04-01T00:05:00Z",
    resolvedAt: "2025-04-01T06:00:00Z",
  },
];

// ─── Cost alerts (for parcel costs page) ────────────────────────────────────
export const costAlerts: CostAlert[] = [
  {
    id: "CA-001",
    title: "Cost Overrun — Batna Route",
    description: "Transport cost 34% above monthly budget. Fuel price surge + detour.",
    severity: "critical",
    city: "Batna",
    actualValue: 580,
    threshold: 430,
    createdAt: "2025-04-09T08:23:00Z",
  },
  {
    id: "CA-002",
    title: "Handling Cost Spike — Oran Depot",
    description: "Manual handling fees increased due to conveyor maintenance downtime.",
    severity: "warning",
    city: "Oran",
    actualValue: 98,
    threshold: 75,
    createdAt: "2025-04-08T09:30:00Z",
  },
];

// ─── Mock users ──────────────────────────────────────────────────────────────
export const mockUsers: User[] = [
  { id: "USR-001", name: "Karim Benmoussa", email: "k.benmoussa@yalidine.dz", role: "Admin", department: "Operations", createdAt: "2024-01-15" },
  { id: "USR-002", name: "Amira Tlemçani", email: "a.tlemcani@yalidine.dz", role: "Analyst", department: "Finance", createdAt: "2024-02-20" },
  { id: "USR-003", name: "Youcef Hadjadj", email: "y.hadjadj@yalidine.dz", role: "Analyst", department: "Logistics", createdAt: "2024-03-10" },
  { id: "USR-004", name: "Nadia Boudiaf", email: "n.boudiaf@yalidine.dz", role: "Viewer", department: "Finance", createdAt: "2024-04-05" },
  { id: "USR-005", name: "Sofiane Rahmani", email: "s.rahmani@yalidine.dz", role: "Viewer", department: "Operations", createdAt: "2024-05-12" },
];

// ─── Alerts over time (for alerts page chart) ────────────────────────────────
export const alertsOverTime = [
  { date: "Apr 2", critical: 1, warning: 2, info: 1 },
  { date: "Apr 3", critical: 0, warning: 1, info: 2 },
  { date: "Apr 4", critical: 2, warning: 1, info: 0 },
  { date: "Apr 5", critical: 0, warning: 2, info: 1 },
  { date: "Apr 6", critical: 1, warning: 3, info: 2 },
  { date: "Apr 7", critical: 2, warning: 1, info: 1 },
  { date: "Apr 8", critical: 1, warning: 2, info: 0 },
  { date: "Apr 9", critical: 2, warning: 2, info: 1 },
  { date: "Apr 10", critical: 1, warning: 1, info: 2 },
];
