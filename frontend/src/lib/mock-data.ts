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

// ─── Transport analytics mock data (API fallback shapes) ─────────────────────

import type {
  TransportSummary,
  TransportTrendPoint,
  TransportCostBreakdown,
  TransportServiceData,
  TransportVehicleData,
  TransportCorridor,
  ODMatrixCell,
  TransportAgencyData,
  DelayBucket,
} from "@/types/transport";

export const mockTransportSummary: TransportSummary = {
  current: {
    total_requests: 412,
    total_terminees: 348,
    total_annulees: 28,
    total_en_cours: 36,
    total_revenue: 7_840_000,
    total_marge: 1_960_000,
    total_km: 148_200,
    total_cost: 5_880_000,
    total_poids_kg: 92_400,
    total_payes: 318,
    total_pieces: 5_840,
    cout_assurance: 470_400,
    avg_cout_par_demande: 16_897,
    avg_cout_par_piece: 1_007,
    avg_arrets_par_demande: 3.2,
    avg_ponctualite_pct: 87.4,
    avg_note_client: 4.2,
    avg_retard_arrivee_min: 18.6,
  },
  derived: {
    completion_rate: 84.5,
    gross_margin_pct: 25.0,
    cancellation_rate: 6.8,
    cost_per_km: 39.7,
    collection_rate: 91.4,
    mom_requests: 8.3,
    mom_revenue: 12.1,
    mom_margin: 1.8,
    mom_on_time: 2.4,
    mom_completion_rate: 3.1,
    mom_cancellation_rate: 1.2,
    mom_cost_per_km: 3.2,
    mom_avg_note: 1.5,
    mom_avg_cout_par_demande: 2.8,
    mom_avg_cout_par_piece: 4.1,
    mom_insurance_ratio: -1.2,
    mom_avg_arrets: 0.6,
  },
};

const MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export const mockTransportTrends: TransportTrendPoint[] = Array.from({ length: 12 }, (_, i) => {
  const year = i < 6 ? 2024 : 2025;
  const month = i < 6 ? i + 7 : i - 5;
  const base = 340 + i * 8 + Math.sin(i) * 15;
  const rev = Math.round((5_200_000 + i * 220_000 + Math.sin(i * 0.7) * 180_000));
  const cost = Math.round(rev * (0.72 + Math.sin(i) * 0.02));
  return {
    year_month: `${year}-${String(month).padStart(2, "0")}`,
    year,
    month_num: month,
    month_name_fr: MONTHS_FR[month - 1],
    nbr_requests: Math.round(base),
    nbr_terminees: Math.round(base * 0.845),
    nbr_annulees: Math.round(base * 0.068),
    total_revenue: rev,
    total_cost: cost,
    total_marge: rev - cost,
    total_km: Math.round(120_000 + i * 4_000),
    taux_marge_pct: Math.round((1 - cost / rev) * 1000) / 10,
    cout_par_km: Math.round((cost / (120_000 + i * 4_000)) * 10) / 10,
    taux_ponctualite_pct: Math.round((84 + i * 0.3 + Math.sin(i) * 1.5) * 10) / 10,
  };
});

export const mockTransportCostBreakdown: TransportCostBreakdown = {
  total_cost: 5_880_000,
  cout_base: 2_646_000,
  cout_distance_supp: 529_200,
  cout_assurance: 940_800,
  cout_carburant: 823_200,
  cout_manutention: 470_400,
  cout_autres: 470_400,
};

export const mockTransportByService: TransportServiceData[] = [
  {
    service_type: "course_dediee", sub_service_type: "livraison",
    nbr_requests: 210, nbr_terminees: 182,
    total_revenue: 4_200_000, total_marge: 1_092_000, total_cost: 3_108_000,
    taux_marge_pct: 26.0, taux_ponctualite_pct: 88.5, avg_note_client: 4.3,
  },
  {
    service_type: "course_dediee", sub_service_type: "pickup",
    nbr_requests: 85, nbr_terminees: 71,
    total_revenue: 1_530_000, total_marge: 382_500, total_cost: 1_147_500,
    taux_marge_pct: 25.0, taux_ponctualite_pct: 86.0, avg_note_client: 4.1,
  },
  {
    service_type: "courrier", sub_service_type: "N/A",
    nbr_requests: 72, nbr_terminees: 63,
    total_revenue: 864_000, total_marge: 207_360, total_cost: 656_640,
    taux_marge_pct: 24.0, taux_ponctualite_pct: 85.5, avg_note_client: 4.0,
  },
  {
    service_type: "manutention", sub_service_type: "N/A",
    nbr_requests: 45, nbr_terminees: 32,
    total_revenue: 1_246_000, total_marge: 278_200, total_cost: 967_860,
    taux_marge_pct: 22.3, taux_ponctualite_pct: 79.2, avg_note_client: 3.8,
  },
];

export const mockTransportByVehicle: TransportVehicleData[] = [
  { vehicle_type: "Camion 3.5T", payload_class: "light",    nbr_requests: 185, total_km: 62_000, total_cost: 2_170_000, cout_par_km: 35.0, taux_ponctualite_pct: 91.2, avg_note_client: 4.4 },
  { vehicle_type: "Camion 10T",  payload_class: "medium",   nbr_requests: 124, total_km: 49_600, total_cost: 2_083_200, cout_par_km: 42.0, taux_ponctualite_pct: 86.3, avg_note_client: 4.2 },
  { vehicle_type: "Camion 20T",  payload_class: "heavy",    nbr_requests: 68,  total_km: 27_200, total_cost: 1_496_000, cout_par_km: 55.0, taux_ponctualite_pct: 82.4, avg_note_client: 4.0 },
  { vehicle_type: "Fourgon",     payload_class: "light",    nbr_requests: 35,  total_km: 9_400,  total_cost: 130_800,   cout_par_km: 13.9, taux_ponctualite_pct: 94.5, avg_note_client: 4.6 },
];

export const mockTransportCorridors: TransportCorridor[] = [
  { wilaya_depart_name: "Alger",     wilaya_arrivee_name: "Oran",       region_depart: "Nord",          region_arrivee: "Nord",          meme_region: true,  nbr_requests: 78, nbr_terminees: 68, total_cost: 1_248_000, total_revenue: 1_638_000, total_marge: 390_000,  taux_marge_pct: 23.8, avg_distance_km: 362.5, cout_par_km: 44.4 },
  { wilaya_depart_name: "Alger",     wilaya_arrivee_name: "Constantine",region_depart: "Nord",          region_arrivee: "Nord",          meme_region: true,  nbr_requests: 64, nbr_terminees: 55, total_cost: 1_100_800, total_revenue: 1_459_200, total_marge: 358_400,  taux_marge_pct: 24.6, avg_distance_km: 431.0, cout_par_km: 39.9 },
  { wilaya_depart_name: "Oran",      wilaya_arrivee_name: "Tlemcen",    region_depart: "Nord",          region_arrivee: "Nord",          meme_region: true,  nbr_requests: 42, nbr_terminees: 39, total_cost: 378_000,   total_revenue: 508_200,   total_marge: 130_200,  taux_marge_pct: 25.6, avg_distance_km: 140.0, cout_par_km: 64.3 },
  { wilaya_depart_name: "Alger",     wilaya_arrivee_name: "Sétif",      region_depart: "Nord",          region_arrivee: "Nord",          meme_region: true,  nbr_requests: 38, nbr_terminees: 32, total_cost: 602_000,   total_revenue: 812_700,   total_marge: 210_700,  taux_marge_pct: 25.9, avg_distance_km: 298.0, cout_par_km: 53.2 },
  { wilaya_depart_name: "Alger",     wilaya_arrivee_name: "Djelfa",     region_depart: "Nord",          region_arrivee: "Hauts Plateaux", meme_region: false, nbr_requests: 34, nbr_terminees: 28, total_cost: 734_000,   total_revenue: 918_400,   total_marge: 184_400,  taux_marge_pct: 20.1, avg_distance_km: 296.0, cout_par_km: 72.8 },
  { wilaya_depart_name: "Constantine",wilaya_arrivee_name: "Annaba",    region_depart: "Nord",          region_arrivee: "Nord",          meme_region: true,  nbr_requests: 28, nbr_terminees: 25, total_cost: 302_400,   total_revenue: 415_800,   total_marge: 113_400,  taux_marge_pct: 27.3, avg_distance_km: 168.0, cout_par_km: 64.3 },
  { wilaya_depart_name: "Alger",     wilaya_arrivee_name: "Ouargla",    region_depart: "Nord",          region_arrivee: "Sud",            meme_region: false, nbr_requests: 18, nbr_terminees: 14, total_cost: 612_000,   total_revenue: 723_600,   total_marge: 111_600,  taux_marge_pct: 15.4, avg_distance_km: 785.0, cout_par_km: 43.3 },
  { wilaya_depart_name: "Sétif",     wilaya_arrivee_name: "Batna",      region_depart: "Nord",          region_arrivee: "Hauts Plateaux", meme_region: false, nbr_requests: 16, nbr_terminees: 14, total_cost: 185_600,   total_revenue: 251_200,   total_marge: 65_600,   taux_marge_pct: 26.1, avg_distance_km: 131.0, cout_par_km: 88.7 },
];

export const mockODMatrix: ODMatrixCell[] = [
  { origin: "Nord",          destination: "Nord",          nbr_requests: 285, taux_marge_pct: 25.3 },
  { origin: "Nord",          destination: "Hauts Plateaux",nbr_requests: 74,  taux_marge_pct: 20.8 },
  { origin: "Nord",          destination: "Sud",           nbr_requests: 28,  taux_marge_pct: 15.2 },
  { origin: "Hauts Plateaux",destination: "Nord",          nbr_requests: 18,  taux_marge_pct: 21.4 },
  { origin: "Hauts Plateaux",destination: "Hauts Plateaux",nbr_requests: 5,   taux_marge_pct: 22.0 },
  { origin: "Hauts Plateaux",destination: "Sud",           nbr_requests: 2,   taux_marge_pct: 16.0 },
];

export const mockTransportByAgency: TransportAgencyData[] = [
  { agence_id: 1,  agence_name: "Agence Alger Centre",   wilaya_dispatch_name: "Alger",     region: "Nord",          nbr_requests: 98, nbr_terminees: 86, total_revenue: 1_960_000, total_marge: 490_000,  total_km: 38_200, total_cost: 1_470_000, completion_rate: 87.8, taux_ponctualite_pct: 90.1, avg_note_client: 4.4, taux_marge_pct: 25.0, cout_par_km: 38.5 },
  { agence_id: 2,  agence_name: "Agence Oran",           wilaya_dispatch_name: "Oran",      region: "Nord",          nbr_requests: 72, nbr_terminees: 61, total_revenue: 1_368_000, total_marge: 328_320, total_km: 27_000, total_cost: 1_039_680, completion_rate: 84.7, taux_ponctualite_pct: 87.2, avg_note_client: 4.2, taux_marge_pct: 24.0, cout_par_km: 38.5 },
  { agence_id: 3,  agence_name: "Agence Constantine",    wilaya_dispatch_name: "Constantine",region: "Nord",          nbr_requests: 58, nbr_terminees: 49, total_revenue: 1_102_000, total_marge: 264_480, total_km: 22_100, total_cost: 837_520,   completion_rate: 84.5, taux_ponctualite_pct: 85.7, avg_note_client: 4.1, taux_marge_pct: 24.0, cout_par_km: 37.9 },
  { agence_id: 4,  agence_name: "Agence Sétif",          wilaya_dispatch_name: "Sétif",     region: "Nord",          nbr_requests: 44, nbr_terminees: 36, total_revenue: 792_000,   total_marge: 182_160, total_km: 17_600, total_cost: 609_840,   completion_rate: 81.8, taux_ponctualite_pct: 83.4, avg_note_client: 4.0, taux_marge_pct: 23.0, cout_par_km: 34.7 },
  { agence_id: 5,  agence_name: "Agence Djelfa",         wilaya_dispatch_name: "Djelfa",    region: "Hauts Plateaux",nbr_requests: 36, nbr_terminees: 28, total_revenue: 684_000,   total_marge: 136_800, total_km: 21_600, total_cost: 547_200,   completion_rate: 77.8, taux_ponctualite_pct: 79.8, avg_note_client: 3.8, taux_marge_pct: 20.0, cout_par_km: 25.3 },
  { agence_id: 6,  agence_name: "Agence Annaba",         wilaya_dispatch_name: "Annaba",    region: "Nord",          nbr_requests: 28, nbr_terminees: 24, total_revenue: 532_000,   total_marge: 127_680, total_km: 10_080, total_cost: 404_320,   completion_rate: 85.7, taux_ponctualite_pct: 88.0, avg_note_client: 4.3, taux_marge_pct: 24.0, cout_par_km: 40.1 },
];

export const mockDelayDistribution: DelayBucket[] = [
  { bucket: "À l'heure", count: 172 },
  { bucket: "1-15 min",  count: 89  },
  { bucket: "16-30 min", count: 52  },
  { bucket: "31-60 min", count: 24  },
  { bucket: "> 60 min",  count: 11  },
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

// ─── Parcel costs analytics mock data (API fallback shapes) ──────────────────

import type {
  ParcelCostsSummaryData,
  ParcelCostsTrendPoint,
  ParcelPCCSummary,
  ParcelPCCAgency,
  EcartBucketItem,
  PCCByWilayaItem,
  CostStructureData,
  CostByNatureItem,
  ParcelAgencyData,
  ParcelDeliveryTypeData,
  DailyVolumePoint,
  DurationBucket,
  SinistresData,
  FreelanceEfficiencyItem,
  ParcelsPaginatedResponse,
} from "@/types/parcel_costs";

export const mockParcelCostsSummary: ParcelCostsSummaryData = {
  current: {
    nbr_colis: 8420,
    nbr_livres: 6231,
    nbr_retours: 1516,
    nbr_echecs: 673,
    total_fees: 4_378_400,
    fees_livres: 3_242_000,
    avg_duree_min: 1820,
  },
  pcc: {
    nbr_avec_tarif: 5180,
    nbr_sous_tarif: 1191,
    nbr_sur_tarif: 982,
    total_fees_pcc: 3_192_000,
    total_tarif_theorique: 3_312_000,
    total_ecart: -284_400,
    avg_ecart: -54.9,
  },
  costs: {
    cout_total: 2_640_000,
    total_depenses: 820_000,
    total_salaires: 1_380_000,
    total_freelance: 440_000,
    nbr_employes: 186,
    nbr_freelance: 48,
  },
  derived: {
    taux_livraison_pct: 74.0,
    taux_retour_pct: 18.0,
    taux_sous_tarif_pct: 23.0,
    avg_fee_par_colis: 520.0,
    cout_par_colis_livre: 423.7,
    mom_colis: 7.2,
    mom_fees: 9.1,
    mom_livraison: 1.8,
    mom_compliance: -2.3,
  },
};

const PC_MONTHS_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export const mockParcelCostsTrends: ParcelCostsTrendPoint[] = Array.from({ length: 12 }, (_, i) => {
  const year = i < 6 ? 2024 : 2025;
  const month = i < 6 ? i + 7 : i - 5;
  const nbr_colis = Math.round(7000 + i * 120 + Math.sin(i) * 400);
  const nbr_livres = Math.round(nbr_colis * (0.70 + i * 0.003 + Math.sin(i * 0.5) * 0.02));
  const nbr_retours = Math.round(nbr_colis * (0.185 - i * 0.001));
  const total_fees = Math.round(nbr_colis * (500 + i * 4));
  const cout_total = Math.round(2_100_000 + i * 40_000 + Math.sin(i * 0.8) * 80_000);
  const nbr_sous_tarif = Math.round(nbr_livres * (0.245 - i * 0.003));
  return {
    year_month: `${year}-${String(month).padStart(2, "0")}`,
    year,
    month_num: month,
    month_name_fr: PC_MONTHS_FR[month - 1],
    nbr_colis,
    nbr_livres,
    nbr_retours,
    total_fees,
    taux_livraison_pct: Math.round((nbr_livres / nbr_colis) * 1000) / 10,
    taux_retour_pct: Math.round((nbr_retours / nbr_colis) * 1000) / 10,
    avg_duree_min: Math.round(1680 + Math.sin(i * 1.2) * 200),
    nbr_sous_tarif,
    total_ecart_dzd: Math.round(nbr_sous_tarif * -54.9),
    taux_sous_tarif_pct: Math.round((nbr_sous_tarif / nbr_livres) * 1000) / 10,
    cout_total,
    total_depenses: Math.round(cout_total * 0.31),
    total_freelance: Math.round(cout_total * 0.167),
    cout_par_colis_livre: Math.round((cout_total / nbr_livres) * 10) / 10,
  };
});

export const mockParcelPCCSummary: ParcelPCCSummary = {
  nbr_colis: 8420,
  nbr_avec_tarif: 5180,
  nbr_sous_tarif: 1191,
  nbr_sur_tarif: 982,
  nbr_au_tarif: 3007,
  total_fees: 3_192_000,
  total_tarif_theorique: 3_312_000,
  total_ecart_dzd: -284_400,
  avg_ecart_dzd: -54.9,
  avg_ecart_absolu_dzd: 82.4,
  taux_sous_tarif_pct: 23.0,
  taux_ecart_global_pct: -8.6,
};

export const mockParcelPCCByAgency: ParcelPCCAgency[] = [
  { agence_id: 1, agence_name: "Alger Centre",   wilaya_name: "Alger",      region: "Nord",           nbr_colis_total: 1820, nbr_avec_tarif: 1260, nbr_sous_tarif: 328, nbr_sur_tarif: 248, total_fees: 910_000,  total_tarif_theorique: 956_000,  total_ecart_dzd: -54_200,  taux_sous_tarif_pct: 26.0, avg_ecart_dzd: -41.5 },
  { agence_id: 2, agence_name: "Oran",           wilaya_name: "Oran",       region: "Nord",           nbr_colis_total: 1240, nbr_avec_tarif: 840,  nbr_sous_tarif: 210, nbr_sur_tarif: 176, total_fees: 648_000,  total_tarif_theorique: 674_000,  total_ecart_dzd: -42_100,  taux_sous_tarif_pct: 25.0, avg_ecart_dzd: -50.1 },
  { agence_id: 3, agence_name: "Constantine",    wilaya_name: "Constantine",region: "Nord",           nbr_colis_total: 980,  nbr_avec_tarif: 620,  nbr_sous_tarif: 142, nbr_sur_tarif: 122, total_fees: 510_000,  total_tarif_theorique: 528_000,  total_ecart_dzd: -32_400,  taux_sous_tarif_pct: 22.9, avg_ecart_dzd: -52.3 },
  { agence_id: 4, agence_name: "Sétif",          wilaya_name: "Sétif",      region: "Nord",           nbr_colis_total: 760,  nbr_avec_tarif: 480,  nbr_sous_tarif: 106, nbr_sur_tarif: 94,  total_fees: 394_000,  total_tarif_theorique: 408_000,  total_ecart_dzd: -21_800,  taux_sous_tarif_pct: 22.1, avg_ecart_dzd: -43.6 },
  { agence_id: 5, agence_name: "Djelfa",         wilaya_name: "Djelfa",     region: "Hauts Plateaux", nbr_colis_total: 580,  nbr_avec_tarif: 360,  nbr_sous_tarif: 104, nbr_sur_tarif: 68,  total_fees: 306_000,  total_tarif_theorique: 320_000,  total_ecart_dzd: -28_600,  taux_sous_tarif_pct: 28.9, avg_ecart_dzd: -68.4 },
  { agence_id: 6, agence_name: "Annaba",         wilaya_name: "Annaba",     region: "Nord",           nbr_colis_total: 440,  nbr_avec_tarif: 280,  nbr_sous_tarif: 56,  nbr_sur_tarif: 52,  total_fees: 228_000,  total_tarif_theorique: 238_000,  total_ecart_dzd: -12_800,  taux_sous_tarif_pct: 20.0, avg_ecart_dzd: -38.2 },
];

export const mockEcartDistribution: EcartBucketItem[] = [
  { bucket: "< -500 DZD",          bucket_order: 0, nbr_colis: 248,  sum_ecart_dzd: -188_400 },
  { bucket: "-500 à -100 DZD",     bucket_order: 1, nbr_colis: 612,  sum_ecart_dzd: -196_800 },
  { bucket: "-100 à -1 DZD",       bucket_order: 2, nbr_colis: 331,  sum_ecart_dzd: -18_200  },
  { bucket: "Au tarif exactement", bucket_order: 3, nbr_colis: 892,  sum_ecart_dzd: 0         },
  { bucket: "+1 à +100 DZD",       bucket_order: 4, nbr_colis: 524,  sum_ecart_dzd: 28_600   },
  { bucket: "Sans tarif théorique",bucket_order: 5, nbr_colis: 3240, sum_ecart_dzd: 0         },
];

export const mockPCCByWilaya: PCCByWilayaItem[] = [
  { wilaya_name: "Alger",       region: "Nord",           nbr_colis: 1820, nbr_avec_tarif: 1260, nbr_sous_tarif: 328, sum_ecart_dzd: -54_200, avg_ecart_dzd: -43.0, taux_sous_tarif_pct: 26.0 },
  { wilaya_name: "Oran",        region: "Nord",           nbr_colis: 1240, nbr_avec_tarif: 840,  nbr_sous_tarif: 210, sum_ecart_dzd: -42_100, avg_ecart_dzd: -50.1, taux_sous_tarif_pct: 25.0 },
  { wilaya_name: "Constantine", region: "Nord",           nbr_colis: 980,  nbr_avec_tarif: 620,  nbr_sous_tarif: 142, sum_ecart_dzd: -32_400, avg_ecart_dzd: -52.3, taux_sous_tarif_pct: 22.9 },
  { wilaya_name: "Sétif",       region: "Nord",           nbr_colis: 760,  nbr_avec_tarif: 480,  nbr_sous_tarif: 106, sum_ecart_dzd: -21_800, avg_ecart_dzd: -43.6, taux_sous_tarif_pct: 22.1 },
  { wilaya_name: "Djelfa",      region: "Hauts Plateaux", nbr_colis: 580,  nbr_avec_tarif: 360,  nbr_sous_tarif: 104, sum_ecart_dzd: -28_600, avg_ecart_dzd: -68.4, taux_sous_tarif_pct: 28.9 },
  { wilaya_name: "Annaba",      region: "Nord",           nbr_colis: 440,  nbr_avec_tarif: 280,  nbr_sous_tarif: 56,  sum_ecart_dzd: -12_800, avg_ecart_dzd: -38.2, taux_sous_tarif_pct: 20.0 },
  { wilaya_name: "Blida",       region: "Nord",           nbr_colis: 310,  nbr_avec_tarif: 198,  nbr_sous_tarif: 36,  sum_ecart_dzd: -8_640,  avg_ecart_dzd: -44.1, taux_sous_tarif_pct: 18.2 },
  { wilaya_name: "Batna",       region: "Hauts Plateaux", nbr_colis: 280,  nbr_avec_tarif: 174,  nbr_sous_tarif: 54,  sum_ecart_dzd: -14_200, avg_ecart_dzd: -81.6, taux_sous_tarif_pct: 31.0 },
];

export const mockParcelCostStructure: CostStructureData = {
  cout_total: 2_640_000,
  total_depenses: 820_000,
  total_salaires: 1_380_000,
  total_freelance: 440_000,
  nbr_depenses: 142,
  nbr_employes_payes: 186,
  nbr_livreurs_freelance: 48,
  nbr_colis_livres_freelance: 2840,
  total_sinistres: 128_400,
  nbr_sinistres: 34,
  cout_total_avec_sinistres: 2_768_400,
};

export const mockParcelCostByNature: CostByNatureItem[] = [
  { category_group: "Salaires",  nature_name: "Salaires livreurs",       total_dzd: 820_000,  nbr_depenses: 186, avg_depense_dzd: 4408.6 },
  { category_group: "Salaires",  nature_name: "Charges sociales",        total_dzd: 320_000,  nbr_depenses: 186, avg_depense_dzd: 1720.4 },
  { category_group: "Salaires",  nature_name: "Primes",                  total_dzd: 240_000,  nbr_depenses: 186, avg_depense_dzd: 1290.3 },
  { category_group: "Freelance", nature_name: "Paiements livreurs",      total_dzd: 440_000,  nbr_depenses: 48,  avg_depense_dzd: 9166.7 },
  { category_group: "Dépenses",  nature_name: "Carburant",               total_dzd: 280_000,  nbr_depenses: 62,  avg_depense_dzd: 4516.1 },
  { category_group: "Dépenses",  nature_name: "Maintenance véhicules",   total_dzd: 180_000,  nbr_depenses: 28,  avg_depense_dzd: 6428.6 },
  { category_group: "Dépenses",  nature_name: "Matériel emballage",      total_dzd: 220_000,  nbr_depenses: 34,  avg_depense_dzd: 6470.6 },
  { category_group: "Dépenses",  nature_name: "Loyers agences",          total_dzd: 140_000,  nbr_depenses: 12,  avg_depense_dzd: 11666.7 },
];

export const mockParcelByAgency: ParcelAgencyData[] = [
  { agence_id: 1, agence_name: "Alger Centre",   wilaya_name: "Alger",      region: "Nord",           nbr_colis: 1820, nbr_livres: 1383, nbr_retours: 328, total_fees: 910_000, taux_livraison: 76.0, taux_retour: 18.0, avg_duree_min: 1640, nbr_sous_tarif: 328, total_ecart_dzd: -54_200,  taux_sous_tarif_pct: 26.0, cout_total: 620_000, cout_par_colis_livre: 448.3 },
  { agence_id: 2, agence_name: "Oran",           wilaya_name: "Oran",       region: "Nord",           nbr_colis: 1240, nbr_livres: 916,  nbr_retours: 236, total_fees: 648_000, taux_livraison: 73.9, taux_retour: 19.0, avg_duree_min: 1820, nbr_sous_tarif: 210, total_ecart_dzd: -42_100,  taux_sous_tarif_pct: 25.0, cout_total: 402_000, cout_par_colis_livre: 439.0 },
  { agence_id: 3, agence_name: "Constantine",    wilaya_name: "Constantine",region: "Nord",           nbr_colis: 980,  nbr_livres: 744,  nbr_retours: 186, total_fees: 510_000, taux_livraison: 75.9, taux_retour: 19.0, avg_duree_min: 1760, nbr_sous_tarif: 142, total_ecart_dzd: -32_400,  taux_sous_tarif_pct: 22.9, cout_total: 318_000, cout_par_colis_livre: 427.4 },
  { agence_id: 4, agence_name: "Sétif",          wilaya_name: "Sétif",      region: "Nord",           nbr_colis: 760,  nbr_livres: 554,  nbr_retours: 144, total_fees: 394_000, taux_livraison: 72.9, taux_retour: 18.9, avg_duree_min: 1950, nbr_sous_tarif: 106, total_ecart_dzd: -21_800,  taux_sous_tarif_pct: 22.1, cout_total: 248_000, cout_par_colis_livre: 447.6 },
  { agence_id: 5, agence_name: "Djelfa",         wilaya_name: "Djelfa",     region: "Hauts Plateaux", nbr_colis: 580,  nbr_livres: 400,  nbr_retours: 120, total_fees: 306_000, taux_livraison: 69.0, taux_retour: 20.7, avg_duree_min: 2200, nbr_sous_tarif: 104, total_ecart_dzd: -28_600,  taux_sous_tarif_pct: 28.9, cout_total: 204_000, cout_par_colis_livre: 510.0 },
  { agence_id: 6, agence_name: "Annaba",         wilaya_name: "Annaba",     region: "Nord",           nbr_colis: 440,  nbr_livres: 352,  nbr_retours: 79,  total_fees: 228_000, taux_livraison: 80.0, taux_retour: 18.0, avg_duree_min: 1580, nbr_sous_tarif: 56,  total_ecart_dzd: -12_800,  taux_sous_tarif_pct: 20.0, cout_total: 142_000, cout_par_colis_livre: 403.4 },
  { agence_id: 7, agence_name: "Blida",          wilaya_name: "Blida",      region: "Nord",           nbr_colis: 310,  nbr_livres: 248,  nbr_retours: 56,  total_fees: 160_000, taux_livraison: 80.0, taux_retour: 18.1, avg_duree_min: 1540, nbr_sous_tarif: 36,  total_ecart_dzd: -8_640,   taux_sous_tarif_pct: 18.2, cout_total: 98_000,  cout_par_colis_livre: 395.2 },
  { agence_id: 8, agence_name: "Batna",          wilaya_name: "Batna",      region: "Hauts Plateaux", nbr_colis: 280,  nbr_livres: 186,  nbr_retours: 66,  total_fees: 148_000, taux_livraison: 66.4, taux_retour: 23.6, avg_duree_min: 2480, nbr_sous_tarif: 54,  total_ecart_dzd: -14_200,  taux_sous_tarif_pct: 31.0, cout_total: 110_000, cout_par_colis_livre: 591.4 },
];

export const mockParcelByDeliveryType: ParcelDeliveryTypeData[] = [
  { delivery_type: "HD", nbr_colis: 5840, nbr_livres: 4266, nbr_retours: 1052, total_fees: 3_026_000, avg_fee_dzd: 518.2, taux_livraison_pct: 73.0, taux_retour_pct: 18.0, avg_duree_livree_min: 1980 },
  { delivery_type: "SD", nbr_colis: 2580, nbr_livres: 1965, nbr_retours: 464,  total_fees: 1_352_400, avg_fee_dzd: 524.2, taux_livraison_pct: 76.2, taux_retour_pct: 18.0, avg_duree_livree_min: 1540 },
];

export const mockDailyVolume: DailyVolumePoint[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(2025, 2, 1 + i);
  const dow = date.getDay();
  const isFriday = dow === 5;
  const isWeekend = dow === 0 || dow === 6;
  const base = isWeekend ? 180 : isFriday ? 310 : 280 + Math.sin(i * 0.8) * 40;
  const nbr_colis = Math.round(base + Math.random() * 40);
  const nbr_livres = Math.round(nbr_colis * (0.70 + Math.random() * 0.08));
  const nbr_retours = Math.round(nbr_colis * (0.16 + Math.random() * 0.05));
  return {
    full_date: date.toISOString().split("T")[0],
    day_of_week: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][dow],
    is_weekend: isWeekend,
    is_friday: isFriday,
    nbr_colis,
    nbr_livres,
    nbr_retours,
    nbr_echecs: Math.round(nbr_colis * 0.04),
    total_fees: Math.round(nbr_colis * 520),
    taux_livraison_pct: Math.round((nbr_livres / nbr_colis) * 1000) / 10,
  };
});

export const mockDurationDistribution: DurationBucket[] = [
  { bucket: "< 1h",       bucket_order: 0, nbr_colis: 142  },
  { bucket: "1–4h",       bucket_order: 1, nbr_colis: 1840 },
  { bucket: "4–24h",      bucket_order: 2, nbr_colis: 2860 },
  { bucket: "1–2 jours",  bucket_order: 3, nbr_colis: 980  },
  { bucket: "2–5 jours",  bucket_order: 4, nbr_colis: 340  },
  { bucket: "> 5 jours",  bucket_order: 5, nbr_colis: 69   },
];

export const mockSinistres: SinistresData = {
  summary: {
    nbr_sinistres: 34,
    sum_declared_dzd: 214_800,
    sum_rembourse_dzd: 128_400,
    taux_couverture_pct: 59.8,
    avg_rembourse_dzd: 3776.5,
  },
  by_type: [
    { sinistre_type: "Perte",         nbr_sinistres: 14, sum_declared_dzd: 98_200,  sum_rembourse_dzd: 68_400,  taux_couverture_pct: 69.7 },
    { sinistre_type: "Dommage",       nbr_sinistres: 12, sum_declared_dzd: 72_400,  sum_rembourse_dzd: 40_200,  taux_couverture_pct: 55.5 },
    { sinistre_type: "Vol",           nbr_sinistres: 5,  sum_declared_dzd: 32_000,  sum_rembourse_dzd: 16_800,  taux_couverture_pct: 52.5 },
    { sinistre_type: "Retard excessif",nbr_sinistres: 3, sum_declared_dzd: 12_200,  sum_rembourse_dzd: 3_000,   taux_couverture_pct: 24.6 },
  ],
  by_agency: [
    { agence_id: 1, agence_nom: "Alger Centre",  wilaya_name: "Alger",      nbr_sinistres: 12, sum_declared_dzd: 82_000,  sum_rembourse_dzd: 48_600 },
    { agence_id: 2, agence_nom: "Oran",          wilaya_name: "Oran",       nbr_sinistres: 8,  sum_declared_dzd: 52_400,  sum_rembourse_dzd: 31_200 },
    { agence_id: 5, agence_nom: "Djelfa",        wilaya_name: "Djelfa",     nbr_sinistres: 6,  sum_declared_dzd: 40_200,  sum_rembourse_dzd: 24_800 },
    { agence_id: 3, agence_nom: "Constantine",   wilaya_name: "Constantine",nbr_sinistres: 5,  sum_declared_dzd: 26_400,  sum_rembourse_dzd: 15_800 },
    { agence_id: 8, agence_nom: "Batna",         wilaya_name: "Batna",      nbr_sinistres: 3,  sum_declared_dzd: 13_800,  sum_rembourse_dzd: 8_000  },
  ],
};

export const mockFreelanceEfficiency: FreelanceEfficiencyItem[] = [
  { agence_id: 1, agence_nom: "Alger Centre",   wilaya_name: "Alger",      nbr_livreurs: 14, nbr_colis_livres: 820,  nbr_colis_echoues: 148, total_paiements_dzd: 128_000, cout_par_colis_livre: 156.1, taux_succes_freelance_pct: 84.7 },
  { agence_id: 2, agence_nom: "Oran",           wilaya_name: "Oran",       nbr_livreurs: 10, nbr_colis_livres: 540,  nbr_colis_echoues: 112, total_paiements_dzd: 86_000,  cout_par_colis_livre: 159.3, taux_succes_freelance_pct: 82.8 },
  { agence_id: 3, agence_nom: "Constantine",    wilaya_name: "Constantine",nbr_livreurs: 8,  nbr_colis_livres: 420,  nbr_colis_echoues: 84,  total_paiements_dzd: 64_000,  cout_par_colis_livre: 152.4, taux_succes_freelance_pct: 83.3 },
  { agence_id: 5, agence_nom: "Djelfa",         wilaya_name: "Djelfa",     nbr_livreurs: 6,  nbr_colis_livres: 280,  nbr_colis_echoues: 72,  total_paiements_dzd: 48_000,  cout_par_colis_livre: 171.4, taux_succes_freelance_pct: 79.5 },
  { agence_id: 4, agence_nom: "Sétif",          wilaya_name: "Sétif",      nbr_livreurs: 6,  nbr_colis_livres: 310,  nbr_colis_echoues: 60,  total_paiements_dzd: 48_800,  cout_par_colis_livre: 157.4, taux_succes_freelance_pct: 83.8 },
  { agence_id: 6, agence_nom: "Annaba",         wilaya_name: "Annaba",     nbr_livreurs: 4,  nbr_colis_livres: 210,  nbr_colis_echoues: 38,  total_paiements_dzd: 32_000,  cout_par_colis_livre: 152.4, taux_succes_freelance_pct: 84.7 },
];

// ─── Parcel Delivery analytics mock data (date-range based) ──────────────────

import type {
  ParcelOpsKpis,
  ParcelTrendPoint,
  ParcelStatusItem,
  ParcelZoneItem,
  ParcelDeliveryTypeKpis,
  ParcelCostKpis,
  ParcelRevenueCostPoint,
  ParcelCostStructure,
  ParcelCostNatureItem,
  ParcelEcartBucket,
  ParcelPerfKpis,
  ParcelPerfTrendPoint,
  ParcelDurationBucket,
  ParcelAgencyPCC,
  ParcelClaimsType,
} from "@/types/parcel_delivery"

export const mockParcelOpsKpis: ParcelOpsKpis = {
  nbr_colis: 42_180,
  nbr_livres: 31_213,
  nbr_retours: 7_592,
  nbr_echecs: 1_120,
  nbr_en_transit: 2_255,
  avg_duree_livraison_h: 30.4,
  taux_livraison_pct: 74.0,
  taux_retour_pct: 18.0,
  pop_colis: 7.2,
  pop_livraison: 1.8,
  pop_retour: -0.5,
  pop_echecs: -2.1,
  pop_en_transit: -3.8,
  pop_duree: -3.4,
}

export const mockParcelOpsTrend: ParcelTrendPoint[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(2025, 4, 1 + i)  // May 2025
  const dow = date.getDay()
  const isFriday = dow === 5
  const isWeekend = dow === 0 || dow === 6
  const base = isWeekend ? 180 : isFriday ? 310 : 1100 + Math.sin(i * 0.8) * 120
  const nbr_livres = Math.round(base * (0.72 + Math.random() * 0.06))
  const nbr_retours = Math.round(base * (0.17 + Math.random() * 0.03))
  return {
    date: date.toISOString().split("T")[0],
    nbr_livres,
    nbr_retours,
    nbr_echecs: Math.round(base * 0.03),
    nbr_en_transit: Math.round(base * (0.05 + Math.random() * 0.02)),
  }
})

export const mockParcelStatusBreakdown: ParcelStatusItem[] = [
  { status_name: "Livré",               nbr_colis: 31_213 },
  { status_name: "Retourné au vendeur", nbr_colis: 7_592  },
  { status_name: "Sorti en livraison",  nbr_colis: 1_840  },
  { status_name: "Tentative échouée",   nbr_colis: 1_120  },
  { status_name: "En alerte",           nbr_colis: 415    },
  { status_name: "Autres",              nbr_colis: 0      },
]

export const mockParcelZoneBreakdown: ParcelZoneItem[] = [
  { zone_num: 0, fee_range: "350–500 DZD",    nbr_colis: 8_820,  nbr_livres: 7_050, taux_livraison_pct: 79.9 },
  { zone_num: 1, fee_range: "500–700 DZD",    nbr_colis: 12_640, nbr_livres: 9_480, taux_livraison_pct: 75.0 },
  { zone_num: 2, fee_range: "700–950 DZD",    nbr_colis: 10_820, nbr_livres: 7_900, taux_livraison_pct: 73.0 },
  { zone_num: 3, fee_range: "950–1 200 DZD",  nbr_colis: 6_300,  nbr_livres: 4_350, taux_livraison_pct: 69.0 },
  { zone_num: 4, fee_range: "1 200–1 600 DZD", nbr_colis: 3_600, nbr_livres: 2_430, taux_livraison_pct: 67.5 },
]

export const mockParcelByDeliveryTypeNew: ParcelDeliveryTypeKpis[] = [
  {
    delivery_type: "HD", nbr_colis: 29_200, nbr_livres: 21_024, nbr_retours: 5_256,
    taux_livraison_pct: 72.0, taux_retour_pct: 18.0, avg_fee_dzd: 618.0, avg_duree_livree_h: 33.0,
  },
  {
    delivery_type: "SD", nbr_colis: 12_980, nbr_livres: 10_189, nbr_retours: 2_336,
    taux_livraison_pct: 78.5, taux_retour_pct: 18.0, avg_fee_dzd: 524.0, avg_duree_livree_h: 25.7,
  },
]

export const mockParcelCostKpis: ParcelCostKpis = {
  total_fees: 22_340_000,
  cout_total: 13_200_000,
  marge_brute: 9_140_000,
  marge_pct: 40.9,
  avg_fee_par_colis: 529.6,
  cout_par_colis_livre: 423.0,
  pop_fees: 9.1,
  pop_cout: 4.2,
  pop_marge: 12.8,
  pop_avg_fee: 1.8,
  pop_cout_par_livre: -2.6,
}

const RC_MONTHS_FR = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"]

export const mockParcelRevenueCostTrend: ParcelRevenueCostPoint[] = Array.from({ length: 12 }, (_, i) => {
  const year = i < 6 ? 2024 : 2025
  const month = i < 6 ? i + 7 : i - 5
  const fees = Math.round(18_000_000 + i * 400_000 + Math.sin(i * 0.7) * 800_000)
  const cost = Math.round(fees * (0.58 + Math.sin(i) * 0.02))
  return {
    period: `${year}-${String(month).padStart(2, "0")}`,
    total_fees: fees,
    cout_total: cost,
    marge_brute: fees - cost,
  }
})

export const mockParcelCostStructureNew: ParcelCostStructure = {
  total_salaires: 6_900_000,
  total_depenses: 4_100_000,
  total_freelance: 2_200_000,
  total_sinistres: 642_000,
}

export const mockParcelCostNature: ParcelCostNatureItem[] = [
  { nature_name: "Salaires livreurs",    total_dzd: 4_100_000 },
  { nature_name: "Paiements freelance",  total_dzd: 2_200_000 },
  { nature_name: "Charges sociales",     total_dzd: 1_600_000 },
  { nature_name: "Carburant",            total_dzd: 1_400_000 },
  { nature_name: "Primes",               total_dzd: 1_200_000 },
  { nature_name: "Maintenance véhicules",total_dzd:   900_000 },
  { nature_name: "Loyers agences",       total_dzd:   700_000 },
  { nature_name: "Remboursements",       total_dzd:   642_000 },
]

export const mockParcelEcartBuckets: ParcelEcartBucket[] = [
  { bucket: "< −500 DZD",           bucket_order: 0, nbr_colis: 1_240, sum_ecart_dzd: -942_000 },
  { bucket: "−500 à −100 DZD",      bucket_order: 1, nbr_colis: 3_060, sum_ecart_dzd: -984_000 },
  { bucket: "−100 à −1 DZD",        bucket_order: 2, nbr_colis: 1_655, sum_ecart_dzd: -91_000  },
  { bucket: "Au tarif exactement",   bucket_order: 3, nbr_colis: 4_460, sum_ecart_dzd: 0        },
  { bucket: "+1 à +100 DZD",        bucket_order: 4, nbr_colis: 2_620, sum_ecart_dzd: 143_000  },
  { bucket: "Sans tarif théorique",  bucket_order: 5, nbr_colis: 18_145, sum_ecart_dzd: 0       },
]

export const mockParcelPerfKpis: ParcelPerfKpis = {
  taux_livraison_pct: 74.0,
  taux_sous_tarif_pct: 23.0,
  taux_compliance_pct: 77.0,
  avg_duree_livraison_h: 30.4,
  nbr_sinistres: 170,
  pop_livraison: 1.8,
  pop_sous_tarif: -2.3,
  pop_compliance: 2.3,
  pop_duree: -3.4,
  pop_sinistres: -8.2,
}

export const mockParcelPerfTrend: ParcelPerfTrendPoint[] = Array.from({ length: 12 }, (_, i) => {
  const year = i < 6 ? 2024 : 2025
  const month = i < 6 ? i + 7 : i - 5
  return {
    period: `${year}-${String(month).padStart(2, "0")}`,
    taux_livraison_pct: Math.round((70 + i * 0.4 + Math.sin(i * 0.5) * 1.5) * 10) / 10,
    taux_sous_tarif_pct: Math.round((26 - i * 0.25 + Math.sin(i) * 1.2) * 10) / 10,
  }
})

export const mockParcelDurationBuckets: ParcelDurationBucket[] = [
  { bucket: "< 1h",       bucket_order: 0, nbr_colis: 710    },
  { bucket: "1–4h",       bucket_order: 1, nbr_colis: 9_200  },
  { bucket: "4–24h",      bucket_order: 2, nbr_colis: 14_300 },
  { bucket: "1–2 jours",  bucket_order: 3, nbr_colis: 4_900  },
  { bucket: "2–5 jours",  bucket_order: 4, nbr_colis: 1_700  },
  { bucket: "> 5 jours",  bucket_order: 5, nbr_colis: 403    },
]

export const mockParcelAgencyPCC: ParcelAgencyPCC[] = [
  { agence_name: "Batna",         taux_sous_tarif_pct: 31.0, nbr_colis: 1_400 },
  { agence_name: "Djelfa",        taux_sous_tarif_pct: 28.9, nbr_colis: 2_900 },
  { agence_name: "Alger Centre",  taux_sous_tarif_pct: 26.0, nbr_colis: 9_100 },
  { agence_name: "Oran",          taux_sous_tarif_pct: 25.0, nbr_colis: 6_200 },
  { agence_name: "Constantine",   taux_sous_tarif_pct: 22.9, nbr_colis: 4_900 },
  { agence_name: "Sétif",         taux_sous_tarif_pct: 22.1, nbr_colis: 3_800 },
  { agence_name: "Annaba",        taux_sous_tarif_pct: 20.0, nbr_colis: 2_200 },
  { agence_name: "Blida",         taux_sous_tarif_pct: 18.2, nbr_colis: 1_550 },
]

export const mockParcelClaimsTypes: ParcelClaimsType[] = [
  { sinistre_type: "Perte",          nbr_sinistres: 70  },
  { sinistre_type: "Dommage",        nbr_sinistres: 60  },
  { sinistre_type: "Vol",            nbr_sinistres: 25  },
  { sinistre_type: "Retard excessif",nbr_sinistres: 15  },
]

// ─── Region-to-region parcel flow matrix ─────────────────────────────────────
import type { ParcelRegionFlowItem, ParcelRegionProfitItem, ParcelZoneProfitItem } from "@/types/parcel_delivery"

export const REGION_FLOW_REGIONS = ["Alger", "Oran", "Constantine", "Annaba", "Sétif", "Batna", "Blida"]

export const mockParcelRegionFlow: ParcelRegionFlowItem[] = [
  // From Alger
  { origin: "Alger", destination: "Alger",       nbr_colis: 8_420 },
  { origin: "Alger", destination: "Oran",         nbr_colis: 4_180 },
  { origin: "Alger", destination: "Constantine",  nbr_colis: 3_650 },
  { origin: "Alger", destination: "Annaba",       nbr_colis: 2_340 },
  { origin: "Alger", destination: "Sétif",        nbr_colis: 2_910 },
  { origin: "Alger", destination: "Batna",        nbr_colis: 1_820 },
  { origin: "Alger", destination: "Blida",        nbr_colis: 3_200 },
  // From Oran
  { origin: "Oran", destination: "Alger",         nbr_colis: 2_860 },
  { origin: "Oran", destination: "Oran",          nbr_colis: 3_540 },
  { origin: "Oran", destination: "Constantine",   nbr_colis: 840  },
  { origin: "Oran", destination: "Annaba",        nbr_colis: 520  },
  { origin: "Oran", destination: "Sétif",         nbr_colis: 680  },
  { origin: "Oran", destination: "Batna",         nbr_colis: 410  },
  { origin: "Oran", destination: "Blida",         nbr_colis: 720  },
  // From Constantine
  { origin: "Constantine", destination: "Alger",        nbr_colis: 2_140 },
  { origin: "Constantine", destination: "Oran",         nbr_colis: 620  },
  { origin: "Constantine", destination: "Constantine",  nbr_colis: 2_890 },
  { origin: "Constantine", destination: "Annaba",       nbr_colis: 1_240 },
  { origin: "Constantine", destination: "Sétif",        nbr_colis: 980  },
  { origin: "Constantine", destination: "Batna",        nbr_colis: 860  },
  { origin: "Constantine", destination: "Blida",        nbr_colis: 480  },
  // From Annaba
  { origin: "Annaba", destination: "Alger",        nbr_colis: 1_280 },
  { origin: "Annaba", destination: "Oran",         nbr_colis: 340  },
  { origin: "Annaba", destination: "Constantine",  nbr_colis: 940  },
  { origin: "Annaba", destination: "Annaba",       nbr_colis: 1_560 },
  { origin: "Annaba", destination: "Sétif",        nbr_colis: 620  },
  { origin: "Annaba", destination: "Batna",        nbr_colis: 480  },
  { origin: "Annaba", destination: "Blida",        nbr_colis: 280  },
  // From Sétif
  { origin: "Sétif", destination: "Alger",         nbr_colis: 1_640 },
  { origin: "Sétif", destination: "Oran",          nbr_colis: 480  },
  { origin: "Sétif", destination: "Constantine",   nbr_colis: 1_120 },
  { origin: "Sétif", destination: "Annaba",        nbr_colis: 680  },
  { origin: "Sétif", destination: "Sétif",         nbr_colis: 1_840 },
  { origin: "Sétif", destination: "Batna",         nbr_colis: 720  },
  { origin: "Sétif", destination: "Blida",         nbr_colis: 340  },
  // From Batna
  { origin: "Batna", destination: "Alger",         nbr_colis: 980  },
  { origin: "Batna", destination: "Oran",          nbr_colis: 280  },
  { origin: "Batna", destination: "Constantine",   nbr_colis: 840  },
  { origin: "Batna", destination: "Annaba",        nbr_colis: 520  },
  { origin: "Batna", destination: "Sétif",         nbr_colis: 680  },
  { origin: "Batna", destination: "Batna",         nbr_colis: 1_240 },
  { origin: "Batna", destination: "Blida",         nbr_colis: 240  },
  // From Blida
  { origin: "Blida", destination: "Alger",         nbr_colis: 2_840 },
  { origin: "Blida", destination: "Oran",          nbr_colis: 680  },
  { origin: "Blida", destination: "Constantine",   nbr_colis: 560  },
  { origin: "Blida", destination: "Annaba",        nbr_colis: 340  },
  { origin: "Blida", destination: "Sétif",         nbr_colis: 480  },
  { origin: "Blida", destination: "Batna",         nbr_colis: 320  },
  { origin: "Blida", destination: "Blida",         nbr_colis: 1_680 },
]

// ─── Region-to-region margin heatmap (fact_parcel_revenue × dim_zone × dim_wilaya) ──
// avg_fee ≈ avg of dim_zone.fee_range; cost derived from fact_charges allocation per region
function _rProfit(nbr: number, avgFee: number, costRatio: number): Omit<ParcelRegionProfitItem, "origin" | "destination"> {
  const total_fees = Math.round(nbr * avgFee)
  const cout_total = Math.round(total_fees * costRatio)
  const marge_brute = total_fees - cout_total
  return { nbr_colis: nbr, total_fees, cout_total, marge_brute, marge_pct: Math.round((marge_brute / total_fees) * 100 * 10) / 10 }
}

const _rp = (o: string, d: string, n: number, fee: number, cr: number): ParcelRegionProfitItem =>
  ({ origin: o, destination: d, ..._rProfit(n, fee, cr) })

export const mockParcelRegionProfit: ParcelRegionProfitItem[] = [
  // From Alger (hub — lowest cost ratio due to scale)
  _rp("Alger","Alger",       8_420, 430, 0.62), _rp("Alger","Oran",         4_180, 590, 0.68),
  _rp("Alger","Constantine",  3_650, 590, 0.66), _rp("Alger","Annaba",       2_340, 820, 0.70),
  _rp("Alger","Sétif",        2_910, 590, 0.65), _rp("Alger","Batna",        1_820, 820, 0.72),
  _rp("Alger","Blida",        3_200, 430, 0.60),
  // From Oran
  _rp("Oran","Alger",         2_860, 590, 0.70), _rp("Oran","Oran",          3_540, 430, 0.64),
  _rp("Oran","Constantine",     840, 820, 0.74), _rp("Oran","Annaba",          520, 820, 0.76),
  _rp("Oran","Sétif",           680, 820, 0.73), _rp("Oran","Batna",           410, 820, 0.77),
  _rp("Oran","Blida",           720, 590, 0.69),
  // From Constantine
  _rp("Constantine","Alger",  2_140, 590, 0.68), _rp("Constantine","Oran",      620, 820, 0.75),
  _rp("Constantine","Constantine",2_890,430,0.63),_rp("Constantine","Annaba",  1_240, 590, 0.67),
  _rp("Constantine","Sétif",    980, 590, 0.66), _rp("Constantine","Batna",     860, 590, 0.68),
  _rp("Constantine","Blida",    480, 820, 0.74),
  // From Annaba
  _rp("Annaba","Alger",       1_280, 820, 0.71), _rp("Annaba","Oran",           340, 820, 0.78),
  _rp("Annaba","Constantine",   940, 590, 0.68), _rp("Annaba","Annaba",       1_560, 430, 0.64),
  _rp("Annaba","Sétif",         620, 590, 0.69), _rp("Annaba","Batna",          480, 590, 0.71),
  _rp("Annaba","Blida",         280, 820, 0.76),
  // From Sétif
  _rp("Sétif","Alger",        1_640, 590, 0.67), _rp("Sétif","Oran",            480, 820, 0.74),
  _rp("Sétif","Constantine",  1_120, 590, 0.66), _rp("Sétif","Annaba",          680, 590, 0.70),
  _rp("Sétif","Sétif",        1_840, 430, 0.63), _rp("Sétif","Batna",           720, 590, 0.68),
  _rp("Sétif","Blida",          340, 820, 0.73),
  // From Batna
  _rp("Batna","Alger",          980, 820, 0.72), _rp("Batna","Oran",            280, 820, 0.78),
  _rp("Batna","Constantine",    840, 590, 0.68), _rp("Batna","Annaba",          520, 590, 0.70),
  _rp("Batna","Sétif",          680, 590, 0.68), _rp("Batna","Batna",         1_240, 430, 0.65),
  _rp("Batna","Blida",          240, 820, 0.76),
  // From Blida
  _rp("Blida","Alger",        2_840, 430, 0.61), _rp("Blida","Oran",            680, 590, 0.69),
  _rp("Blida","Constantine",    560, 820, 0.74), _rp("Blida","Annaba",          340, 820, 0.76),
  _rp("Blida","Sétif",          480, 590, 0.68), _rp("Blida","Batna",           320, 820, 0.75),
  _rp("Blida","Blida",        1_680, 430, 0.60),
]

// ─── Zone profitability (fact_parcel_revenue aggregated by dim_zone) ───────────
// Zone 0 = local (cheap, high volume); Zone 4 = long-distance (high fee, lower volume)
export const mockParcelZoneProfit: ParcelZoneProfitItem[] = [
  { zone_num: 0, fee_range: "350–500",    nbr_colis: 8_820,  total_fees: 3_704_400, cout_total: 2_556_036, marge_brute: 1_148_364, marge_pct: 31.0 },
  { zone_num: 1, fee_range: "500–700",    nbr_colis: 12_640, total_fees: 7_346_080, cout_total: 4_938_074, marge_brute: 2_408_006, marge_pct: 32.8 },
  { zone_num: 2, fee_range: "700–950",    nbr_colis: 10_820, total_fees: 8_765_800, cout_total: 6_133_660, marge_brute: 2_632_140, marge_pct: 30.0 },
  { zone_num: 3, fee_range: "950–1 200",  nbr_colis: 6_300,  total_fees: 6_845_400, cout_total: 4_990_542, marge_brute: 1_854_858, marge_pct: 27.1 },
  { zone_num: 4, fee_range: "1 200–1 600",nbr_colis: 3_600,  total_fees: 4_968_000, cout_total: 3_776_880, marge_brute: 1_191_120, marge_pct: 24.0 },
]

export const mockParcelsPaginated: ParcelsPaginatedResponse = {
  results: [
    { tracking: "YLI-2025-384291", date_creation: "2025-03-15", agence_id: 1, agence_nom: "Alger Centre",  wilaya_destination: "Alger",       delivery_type: "HD", statut_actuel: "Livré",        delivery_fee: 520,  tarif_theorique: 680,  ecart_tarif_dzd: -160,  duree_livraison_minutes: 980,  nbr_evenements: 4 },
    { tracking: "YLI-2025-384292", date_creation: "2025-03-15", agence_id: 1, agence_nom: "Alger Centre",  wilaya_destination: "Blida",        delivery_type: "SD", statut_actuel: "Livré",        delivery_fee: 440,  tarif_theorique: 440,  ecart_tarif_dzd: 0,     duree_livraison_minutes: 1240, nbr_evenements: 3 },
    { tracking: "YLI-2025-384293", date_creation: "2025-03-15", agence_id: 2, agence_nom: "Oran",          wilaya_destination: "Oran",        delivery_type: "HD", statut_actuel: "Retourné",     delivery_fee: 0,    tarif_theorique: 580,  ecart_tarif_dzd: -580,  duree_livraison_minutes: null, nbr_evenements: 6 },
    { tracking: "YLI-2025-384294", date_creation: "2025-03-15", agence_id: 3, agence_nom: "Constantine",   wilaya_destination: "Constantine", delivery_type: "HD", statut_actuel: "Livré",        delivery_fee: 600,  tarif_theorique: 580,  ecart_tarif_dzd: 20,    duree_livraison_minutes: 1560, nbr_evenements: 4 },
    { tracking: "YLI-2025-384295", date_creation: "2025-03-15", agence_id: 5, agence_nom: "Djelfa",        wilaya_destination: "Djelfa",      delivery_type: "HD", statut_actuel: "Livré",        delivery_fee: 650,  tarif_theorique: 820,  ecart_tarif_dzd: -170,  duree_livraison_minutes: 2180, nbr_evenements: 5 },
    { tracking: "YLI-2025-384296", date_creation: "2025-03-15", agence_id: 1, agence_nom: "Alger Centre",  wilaya_destination: "Alger",       delivery_type: "SD", statut_actuel: "Livré",        delivery_fee: 480,  tarif_theorique: null, ecart_tarif_dzd: null,  duree_livraison_minutes: 740,  nbr_evenements: 2 },
    { tracking: "YLI-2025-384297", date_creation: "2025-03-15", agence_id: 8, agence_nom: "Batna",         wilaya_destination: "Batna",       delivery_type: "HD", statut_actuel: "Livré",        delivery_fee: 720,  tarif_theorique: 1080, ecart_tarif_dzd: -360,  duree_livraison_minutes: 3240, nbr_evenements: 7 },
    { tracking: "YLI-2025-384298", date_creation: "2025-03-15", agence_id: 2, agence_nom: "Oran",          wilaya_destination: "Oran",        delivery_type: "SD", statut_actuel: "Livré",        delivery_fee: 500,  tarif_theorique: 500,  ecart_tarif_dzd: 0,     duree_livraison_minutes: 1120, nbr_evenements: 3 },
    { tracking: "YLI-2025-384299", date_creation: "2025-03-15", agence_id: 4, agence_nom: "Sétif",         wilaya_destination: "Sétif",       delivery_type: "HD", statut_actuel: "Livré",        delivery_fee: 560,  tarif_theorique: 640,  ecart_tarif_dzd: -80,   duree_livraison_minutes: 1820, nbr_evenements: 4 },
    { tracking: "YLI-2025-384300", date_creation: "2025-03-15", agence_id: 6, agence_nom: "Annaba",         wilaya_destination: "Annaba",      delivery_type: "HD", statut_actuel: "En cours",     delivery_fee: 540,  tarif_theorique: 520,  ecart_tarif_dzd: 20,    duree_livraison_minutes: null, nbr_evenements: 2 },
  ],
  count: 8420,
  page: 1,
  pages: 337,
};
