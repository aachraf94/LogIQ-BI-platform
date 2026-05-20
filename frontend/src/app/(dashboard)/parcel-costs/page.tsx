"use client";

import { useEffect, useState, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import {
  Package, TrendingDown, DollarSign, AlertTriangle, ChevronDown,
  BarChart2, Truck, Users, ChevronLeft, ChevronRight,
} from "lucide-react";

import { KpiCard } from "@/components/ui/KpiCard";
import { DataTable } from "@/components/ui/DataTable";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { AreaChart } from "@/components/charts/AreaChart";
import type { Column } from "@/components/ui/DataTable";

import { parcelCostsApi } from "@/lib/api";
import { formatDZD, formatNumber, formatPercent } from "@/lib/utils";
import {
  mockParcelCostsSummary,
  mockParcelCostsTrends,
  mockParcelPCCSummary,
  mockParcelPCCByAgency,
  mockEcartDistribution,
  mockParcelCostStructure,
  mockParcelCostByNature,
  mockParcelByAgency,
  mockParcelByDeliveryType,
  mockDailyVolume,
  mockDurationDistribution,
  mockSinistres,
  mockFreelanceEfficiency,
  mockParcelsPaginated,
} from "@/lib/mock-data";

import type {
  ParcelCostsSummaryData,
  ParcelCostsTrendPoint,
  ParcelPCCSummary,
  ParcelPCCAgency,
  EcartBucketItem,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const YEARS = [2023, 2024, 2025];
const MONTHS = [
  { label: "Toute l'année", value: null },
  { label: "Janvier",  value: 1  }, { label: "Février",   value: 2  },
  { label: "Mars",     value: 3  }, { label: "Avril",     value: 4  },
  { label: "Mai",      value: 5  }, { label: "Juin",      value: 6  },
  { label: "Juillet",  value: 7  }, { label: "Août",      value: 8  },
  { label: "Septembre",value: 9  }, { label: "Octobre",   value: 10 },
  { label: "Novembre", value: 11 }, { label: "Décembre",  value: 12 },
];
const DELIVERY_TYPES = [
  { label: "HD + SD",            value: "all" },
  { label: "Domicile (HD)",      value: "HD"  },
  { label: "Point relais (SD)",  value: "SD"  },
];

// ─── Chart theme helpers ───────────────────────────────────────────────────────

const CHART_TOOLTIP = {
  backgroundColor: "#1E2030",
  borderColor: "#2D3050",
  textStyle: { color: "#E2E8F0", fontSize: 12 },
};
const SPLIT_LINE = { lineStyle: { color: "#2D3050", type: "dashed" as const } };
const AXIS_LABEL = { color: "#64748B", fontSize: 11 };

// ─── Page state ───────────────────────────────────────────────────────────────

interface PageData {
  summary:      ParcelCostsSummaryData;
  trends:       ParcelCostsTrendPoint[];
  pccSummary:   ParcelPCCSummary;
  pccByAgency:  ParcelPCCAgency[];
  costStructure:CostStructureData;
  costByNature: CostByNatureItem[];
  byAgency:     ParcelAgencyData[];
  byDeliveryType:ParcelDeliveryTypeData[];
  dailyVolume:  DailyVolumePoint[];
  sinistres:    SinistresData;
  freelance:    FreelanceEfficiencyItem[];
}

interface DetailData {
  ecartDistribution: EcartBucketItem[];
  durationDistribution: DurationBucket[];
  parcels: ParcelsPaginatedResponse;
}

const MOCK_PAGE: PageData = {
  summary: mockParcelCostsSummary,
  trends: mockParcelCostsTrends,
  pccSummary: mockParcelPCCSummary,
  pccByAgency: mockParcelPCCByAgency,
  costStructure: mockParcelCostStructure,
  costByNature: mockParcelCostByNature,
  byAgency: mockParcelByAgency,
  byDeliveryType: mockParcelByDeliveryType,
  dailyVolume: mockDailyVolume,
  sinistres: mockSinistres,
  freelance: mockFreelanceEfficiency,
};

const MOCK_DETAIL: DetailData = {
  ecartDistribution: mockEcartDistribution,
  durationDistribution: mockDurationDistribution,
  parcels: mockParcelsPaginated,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Select({
  value,
  onChange,
  options,
}: {
  value: string | number | null;
  onChange: (v: string | number | null) => void;
  options: { label: string; value: string | number | null }[];
}) {
  return (
    <div className="relative">
      <select
        value={value === null ? "" : String(value)}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") { onChange(null); return; }
          const num = Number(raw);
          onChange(isNaN(num) ? raw : num);
        }}
        className="appearance-none bg-[#252840] border border-[#2D3050] text-slate-200 text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-primary/60 cursor-pointer"
      >
        {options.map((o) => (
          <option key={String(o.value)} value={o.value === null ? "" : String(o.value)}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

function SectionCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[#1E2030] border border-[#2D3050] rounded-xl p-5 ${className}`}>
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Skeleton({ h = "h-64" }: { h?: string }) {
  return <div className={`${h} bg-[#252840] animate-pulse rounded-lg`} />;
}

// ─── Chart builders ───────────────────────────────────────────────────────────

function buildQuadrantOption(agencies: ParcelAgencyData[]) {
  const DELIVERY_THRESH = 73;
  const RISK_THRESH = 24;

  const quadrants = [
    { name: "Performant",          color: "#10B981", check: (a: ParcelAgencyData) => a.taux_livraison >= DELIVERY_THRESH && a.taux_sous_tarif_pct < RISK_THRESH },
    { name: "Risque tarifaire",    color: "#F59E0B", check: (a: ParcelAgencyData) => a.taux_livraison >= DELIVERY_THRESH && a.taux_sous_tarif_pct >= RISK_THRESH },
    { name: "Risque opérationnel", color: "#6366F1", check: (a: ParcelAgencyData) => a.taux_livraison < DELIVERY_THRESH  && a.taux_sous_tarif_pct < RISK_THRESH },
    { name: "Double risque",       color: "#EF4444", check: (a: ParcelAgencyData) => a.taux_livraison < DELIVERY_THRESH  && a.taux_sous_tarif_pct >= RISK_THRESH },
  ];

  const maxColis = Math.max(...agencies.map((a) => a.nbr_colis), 1);

  const series = quadrants.map((q) => ({
    name: q.name,
    type: "scatter" as const,
    symbolSize: (val: number[]) => Math.max(12, Math.sqrt(val[2] / maxColis) * 60),
    data: agencies
      .filter((a) => q.check(a))
      .map((a) => [a.taux_livraison, a.taux_sous_tarif_pct, a.nbr_colis, a.agence_name]),
    itemStyle: { color: q.color, opacity: 0.85 },
    emphasis: { itemStyle: { opacity: 1 } },
    label: {
      show: true,
      formatter: (p: { data: (number | string)[] }) => String(p.data[3]),
      position: "top" as const,
      color: "#94A3B8",
      fontSize: 10,
    },
  }));

  return {
    backgroundColor: "transparent",
    tooltip: {
      ...CHART_TOOLTIP,
      formatter: (p: { data: (number | string)[]; seriesName: string }) => {
        const [x, y, colis, name] = p.data;
        return `<b>${name}</b><br/>Livraison: ${x}%<br/>Sous-tarif: ${y}%<br/>Colis: ${formatNumber(colis as number)}`;
      },
    },
    legend: {
      bottom: 0,
      textStyle: { color: "#94A3B8", fontSize: 11 },
      itemWidth: 10, itemHeight: 10,
    },
    grid: { left: 60, right: 20, top: 20, bottom: 50 },
    xAxis: {
      type: "value" as const,
      name: "Taux de livraison (%)",
      nameLocation: "middle" as const,
      nameGap: 30,
      nameTextStyle: { color: "#64748B", fontSize: 11 },
      min: 55, max: 90,
      axisLine: { lineStyle: { color: "#2D3050" } },
      splitLine: SPLIT_LINE,
      axisLabel: { ...AXIS_LABEL, formatter: (v: number) => `${v}%` },
    },
    yAxis: {
      type: "value" as const,
      name: "Taux sous-tarif (%)",
      nameLocation: "middle" as const,
      nameGap: 48,
      nameTextStyle: { color: "#64748B", fontSize: 11 },
      min: 0, max: 45,
      axisLine: { show: false },
      splitLine: SPLIT_LINE,
      axisLabel: { ...AXIS_LABEL, formatter: (v: number) => `${v}%` },
    },
    series: [
      ...series,
      {
        name: "_vline",
        type: "line" as const,
        data: [[DELIVERY_THRESH, 0], [DELIVERY_THRESH, 45]],
        lineStyle: { color: "#2D3050", type: "dashed" as const, width: 1 },
        symbol: "none",
        silent: true,
        legendHoverLink: false,
      },
      {
        name: "_hline",
        type: "line" as const,
        data: [[55, RISK_THRESH], [90, RISK_THRESH]],
        lineStyle: { color: "#2D3050", type: "dashed" as const, width: 1 },
        symbol: "none",
        silent: true,
        legendHoverLink: false,
      },
    ],
  };
}

function buildDailyVolumeOption(daily: DailyVolumePoint[]) {
  const cats = daily.map((d) => d.full_date.slice(5));
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis" as const,
      ...CHART_TOOLTIP,
      axisPointer: { type: "shadow" as const },
      formatter: (params: { name: string; data: number; seriesName: string }[]) => {
        const day = daily.find((d) => d.full_date.slice(5) === params[0]?.name);
        const label = day ? ` (${day.day_of_week})` : "";
        return params.map((p) => `${p.seriesName}: ${p.data}`).join("<br/>") + `<br/>${params[0]?.name}${label}`;
      },
    },
    legend: { top: 0, right: 0, textStyle: { color: "#94A3B8", fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    grid: { left: 16, right: 16, top: 36, bottom: 0, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: cats,
      axisLine: { lineStyle: { color: "#2D3050" } },
      axisTick: { show: false },
      axisLabel: { ...AXIS_LABEL, rotate: 40, interval: 4 },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      splitLine: SPLIT_LINE,
      axisLabel: AXIS_LABEL,
    },
    series: [
      {
        name: "Livrés",
        type: "bar" as const,
        stack: "s",
        data: daily.map((d) => ({
          value: d.nbr_livres,
          itemStyle: { color: d.is_friday ? "#22D3EE" : d.is_weekend ? "#475569" : "#10B981" },
        })),
      },
      {
        name: "Retours",
        type: "bar" as const,
        stack: "s",
        data: daily.map((d) => d.nbr_retours),
        itemStyle: { color: "#F59E0B", borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}

function buildEcartHistogramOption(buckets: EcartBucketItem[]) {
  const BUCKET_COLORS: Record<number, string> = {
    0: "#EF4444",
    1: "#F97316",
    2: "#F59E0B",
    3: "#10B981",
    4: "#6366F1",
    5: "#475569",
  };
  return {
    backgroundColor: "transparent",
    tooltip: {
      ...CHART_TOOLTIP,
      formatter: (p: { name: string; value: number; dataIndex: number }) => {
        const b = buckets[p.dataIndex];
        const ecart = b ? `<br/>Σ écart: ${b.sum_ecart_dzd >= 0 ? "+" : ""}${formatDZD(b.sum_ecart_dzd)}` : "";
        return `${p.name}<br/>${formatNumber(p.value)} colis${ecart}`;
      },
    },
    grid: { left: 16, right: 16, top: 16, bottom: 0, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: buckets.map((b) => b.bucket),
      axisLine: { lineStyle: { color: "#2D3050" } },
      axisTick: { show: false },
      axisLabel: { ...AXIS_LABEL, rotate: 20, interval: 0 },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      splitLine: SPLIT_LINE,
      axisLabel: AXIS_LABEL,
    },
    series: [{
      type: "bar" as const,
      data: buckets.map((b) => ({
        value: b.nbr_colis,
        itemStyle: { color: BUCKET_COLORS[b.bucket_order] ?? "#64748B", borderRadius: [4, 4, 0, 0] },
      })),
      label: { show: true, position: "top" as const, color: "#94A3B8", fontSize: 11, formatter: (p: { value: number }) => formatNumber(p.value) },
    }],
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ParcelCostsPage() {
  const [year, setYear] = useState<number>(2025);
  const [month, setMonth] = useState<number | null>(null);
  const [deliveryType, setDeliveryType] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [usingMock, setUsingMock] = useState(false);
  const [data, setData] = useState<PageData>(MOCK_PAGE);
  const [detail, setDetail] = useState<DetailData>(MOCK_DETAIL);
  const [parcelPage, setParcelPage] = useState(1);

  const fetchMain = useCallback(async () => {
    setLoading(true);
    const f = { year, month: month ?? undefined, delivery_type: deliveryType !== "all" ? deliveryType : undefined };
    try {
      const [summary, trends, pccSummary, pccByAgency, costStructure, costByNature,
             byAgency, byDeliveryType, dailyVolume, sinistres, freelance] =
        await Promise.all([
          parcelCostsApi.summary(f),
          parcelCostsApi.trends({ delivery_type: f.delivery_type }),
          parcelCostsApi.pccSummary(f),
          parcelCostsApi.pccByAgency({ year, month: month ?? undefined, delivery_type: f.delivery_type }),
          parcelCostsApi.costStructure({ year, month: month ?? undefined }),
          parcelCostsApi.costByNature({ year, month: month ?? undefined }),
          parcelCostsApi.byAgency({ year, month: month ?? undefined, delivery_type: f.delivery_type }),
          parcelCostsApi.byDeliveryType({ year, month: month ?? undefined }),
          parcelCostsApi.dailyVolume({ year, month: month ?? undefined }),
          parcelCostsApi.sinistres({ year, month: month ?? undefined }),
          parcelCostsApi.freelanceEfficiency({ year, month: month ?? undefined }),
        ]);
      setData({ summary, trends, pccSummary, pccByAgency, costStructure, costByNature,
                byAgency, byDeliveryType, dailyVolume, sinistres, freelance });
      setUsingMock(false);
    } catch {
      setData(MOCK_PAGE);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [year, month, deliveryType]);

  const fetchDetail = useCallback(async (p = 1) => {
    if (!month) { setDetail(MOCK_DETAIL); return; }
    setLoadingDetail(true);
    try {
      const [ecartDistribution, durationDistribution, parcels] = await Promise.all([
        parcelCostsApi.ecartDistribution({ year, month }),
        parcelCostsApi.durationDistribution({ year, month, delivery_type: deliveryType !== "all" ? deliveryType : undefined }),
        parcelCostsApi.parcels({ year, month, delivery_type: deliveryType !== "all" ? deliveryType : undefined, page: p }),
      ]);
      setDetail({ ecartDistribution, durationDistribution, parcels });
    } catch {
      setDetail(MOCK_DETAIL);
    } finally {
      setLoadingDetail(false);
    }
  }, [year, month, deliveryType]);

  useEffect(() => { fetchMain(); }, [fetchMain]);
  useEffect(() => { setParcelPage(1); fetchDetail(1); }, [fetchDetail]);

  const { summary, trends, pccSummary, pccByAgency, costStructure, costByNature,
          byAgency, byDeliveryType, dailyVolume, sinistres, freelance } = data;
  const { ecartDistribution, durationDistribution, parcels } = detail;
  const { current: cur, derived: d } = summary;

  // ── Derived chart data ──────────────────────────────────────────────────────

  const areaData = trends.map((t) => ({
    month: `${t.month_name_fr.slice(0, 3)} ${String(t.year).slice(2)}`,
    revenue: t.total_fees,
    cost: t.cout_total,
  }));

  const livTrend = {
    categories: trends.map((t) => `${t.month_name_fr.slice(0, 3)} ${String(t.year).slice(2)}`),
    series: [
      { name: "Taux livraison (%)",  data: trends.map((t) => t.taux_livraison_pct),  color: "#10B981" },
      { name: "Taux sous-tarif (%)", data: trends.map((t) => t.taux_sous_tarif_pct), color: "#EF4444" },
    ],
  };

  const costDonutData = [
    { name: "Salaires",    value: costStructure.total_salaires   },
    { name: "Dépenses",    value: costStructure.total_depenses   },
    { name: "Freelance",   value: costStructure.total_freelance  },
    { name: "Sinistres",   value: costStructure.total_sinistres  },
  ].filter((x) => x.value > 0);

  const natureBarData = costByNature.map((n) => ({ name: n.nature_name, value: Math.round(n.total_dzd) }));
  const durationBarData = durationDistribution.map((d) => ({ name: d.bucket, value: d.nbr_colis }));
  const sinPieData = sinistres.by_type.map((t) => ({ name: t.sinistre_type, value: t.nbr_sinistres }));

  // ── Column defs ─────────────────────────────────────────────────────────────

  const pccAgencyCols: Column<ParcelPCCAgency>[] = [
    { key: "agence_name",        header: "Agence",       sortable: true },
    { key: "wilaya_name",        header: "Wilaya",       sortable: true },
    { key: "nbr_colis_total",    header: "Colis",        sortable: true, render: (r) => formatNumber(r.nbr_colis_total) },
    {
      key: "nbr_sous_tarif", header: "Sous-tarif", sortable: true,
      render: (r) => <span className="text-red-400 font-semibold">{formatNumber(r.nbr_sous_tarif)}</span>,
    },
    {
      key: "taux_sous_tarif_pct", header: "Taux %", sortable: true,
      render: (r) => (
        <span className={`font-semibold ${r.taux_sous_tarif_pct >= 25 ? "text-red-400" : r.taux_sous_tarif_pct >= 20 ? "text-amber-400" : "text-emerald-400"}`}>
          {r.taux_sous_tarif_pct?.toFixed(1)}%
        </span>
      ),
    },
    {
      key: "total_ecart_dzd", header: "Écart total", sortable: true,
      render: (r) => <span className="font-mono text-red-400 text-sm">{formatDZD(r.total_ecart_dzd)}</span>,
    },
    { key: "avg_ecart_dzd", header: "Écart moy.", sortable: true, render: (r) => `${r.avg_ecart_dzd?.toFixed(1)} DZD` },
  ];

  const agencyCols: Column<ParcelAgencyData>[] = [
    { key: "agence_name",          header: "Agence",         sortable: true },
    { key: "wilaya_name",          header: "Wilaya",         sortable: true },
    { key: "nbr_colis",            header: "Colis",          sortable: true, render: (r) => formatNumber(r.nbr_colis) },
    {
      key: "taux_livraison", header: "Livraison %", sortable: true,
      render: (r) => <span className={r.taux_livraison >= 75 ? "text-emerald-400 font-semibold" : r.taux_livraison >= 70 ? "text-amber-400 font-semibold" : "text-red-400 font-semibold"}>{r.taux_livraison?.toFixed(1)}%</span>,
    },
    {
      key: "taux_sous_tarif_pct", header: "Sous-tarif %", sortable: true,
      render: (r) => <span className={r.taux_sous_tarif_pct >= 25 ? "text-red-400" : r.taux_sous_tarif_pct >= 20 ? "text-amber-400" : "text-emerald-400"}>{r.taux_sous_tarif_pct?.toFixed(1)}%</span>,
    },
    { key: "cout_par_colis_livre", header: "Coût/colis livré", sortable: true, render: (r) => `${r.cout_par_colis_livre?.toFixed(0)} DZD` },
    {
      key: "total_ecart_dzd", header: "Écart PCC", sortable: true,
      render: (r) => <span className="font-mono text-sm text-red-400">{formatDZD(r.total_ecart_dzd)}</span>,
    },
  ];

  const freelanceCols: Column<FreelanceEfficiencyItem>[] = [
    { key: "agence_nom",              header: "Agence",           sortable: true },
    { key: "wilaya_name",             header: "Wilaya",           sortable: true },
    { key: "nbr_livreurs",            header: "Livreurs",         sortable: true },
    { key: "nbr_colis_livres",        header: "Colis livrés",     sortable: true, render: (r) => formatNumber(r.nbr_colis_livres) },
    {
      key: "taux_succes_freelance_pct", header: "Taux succès", sortable: true,
      render: (r) => <span className={r.taux_succes_freelance_pct >= 83 ? "text-emerald-400 font-semibold" : "text-amber-400 font-semibold"}>{r.taux_succes_freelance_pct?.toFixed(1)}%</span>,
    },
    { key: "cout_par_colis_livre", header: "Coût/colis",  sortable: true, render: (r) => `${r.cout_par_colis_livre?.toFixed(1)} DZD` },
    { key: "total_paiements_dzd",  header: "Total payé",  sortable: true, render: (r) => <span className="font-mono text-sm">{formatDZD(r.total_paiements_dzd)}</span> },
  ];

  const parcelCols: Column<(typeof parcels.results)[0]>[] = [
    { key: "tracking",     header: "Tracking",  render: (r) => <span className="font-mono text-xs text-slate-300">{r.tracking}</span> },
    { key: "agence_nom",   header: "Agence",    sortable: true },
    { key: "wilaya_destination", header: "Wilaya dest.", sortable: true },
    {
      key: "delivery_type", header: "Type",
      render: (r) => <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.delivery_type === "HD" ? "bg-indigo-500/10 text-indigo-400" : "bg-cyan-500/10 text-cyan-400"}`}>{r.delivery_type}</span>,
    },
    {
      key: "statut_actuel", header: "Statut",
      render: (r) => {
        const color = r.statut_actuel === "Livré" ? "text-emerald-400" : r.statut_actuel === "Retourné" ? "text-red-400" : "text-amber-400";
        return <span className={`text-xs font-semibold ${color}`}>{r.statut_actuel}</span>;
      },
    },
    { key: "delivery_fee",      header: "Frais perçus", sortable: true, render: (r) => `${r.delivery_fee} DZD` },
    { key: "tarif_theorique",   header: "Tarif théo.",  render: (r) => r.tarif_theorique != null ? `${r.tarif_theorique} DZD` : "—" },
    {
      key: "ecart_tarif_dzd", header: "Écart", sortable: true,
      render: (r) => {
        if (r.ecart_tarif_dzd == null) return <span className="text-slate-500">—</span>;
        const color = r.ecart_tarif_dzd < 0 ? "text-red-400" : r.ecart_tarif_dzd > 0 ? "text-emerald-400" : "text-slate-400";
        return <span className={`font-semibold text-sm ${color}`}>{r.ecart_tarif_dzd > 0 ? "+" : ""}{r.ecart_tarif_dzd} DZD</span>;
      },
    },
    {
      key: "duree_livraison_minutes", header: "Durée", sortable: true,
      render: (r) => r.duree_livraison_minutes != null ? `${Math.round(r.duree_livraison_minutes / 60)} h` : "—",
    },
  ];

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={year} onChange={(v) => setYear(v as number)} options={YEARS.map((y) => ({ label: String(y), value: y }))} />
        <Select value={month} onChange={(v) => { setMonth(v as number | null); setParcelPage(1); }} options={MONTHS} />
        <Select value={deliveryType} onChange={(v) => setDeliveryType(v as string)} options={DELIVERY_TYPES} />
        {usingMock && (
          <span className="ml-auto text-xs text-amber-400/80 border border-amber-400/20 bg-amber-400/5 px-3 py-1.5 rounded-lg">
            Données de démonstration — backend indisponible
          </span>
        )}
        {loading && (
          <span className="ml-auto text-xs text-slate-400 animate-pulse">Chargement…</span>
        )}
      </div>

      {/* ── Primary KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Colis traités"        value={formatNumber(cur.nbr_colis)}            trend={d.mom_colis}      trendLabel="vs mois précédent" icon={<Package size={16} />}      index={0} />
        <KpiCard title="Taux de livraison"    value={formatPercent(d.taux_livraison_pct)}    trend={d.mom_livraison}  trendLabel="vs mois précédent" icon={<Truck size={16} />}        index={1} />
        <KpiCard title="Frais collectés"      value={formatDZD(cur.total_fees)}              trend={d.mom_fees}       trendLabel="vs mois précédent" icon={<DollarSign size={16} />}   index={2} />
        <KpiCard title="Coût total"           value={formatDZD(summary.costs.cout_total)}    trend={0}                trendLabel=""                  icon={<BarChart2 size={16} />}    index={3} />
      </div>

      {/* ── Secondary KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title="Taux sous-tarif (PCC)"value={formatPercent(d.taux_sous_tarif_pct)}  trend={-d.taux_sous_tarif_pct}  icon={<AlertTriangle size={16} />} index={4} />
        <KpiCard title="Frais moy. / colis"   value={`${d.avg_fee_par_colis.toFixed(0)} DZD`} trend={0}                    icon={<Package size={16} />}       index={5} />
        <KpiCard title="Coût / colis livré"   value={`${d.cout_par_colis_livre.toFixed(0)} DZD`} trend={0}                icon={<TrendingDown size={16} />}  index={6} />
        <KpiCard title="Conformité tarifaire" value={formatPercent(100 - d.taux_sous_tarif_pct)} trend={d.mom_compliance} icon={<DollarSign size={16} />}    index={7} />
      </div>

      {/* ── Trends: Fees vs Costs + Delivery & compliance rates ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="Frais collectés vs Coût total (DZD)">
          {loading ? <Skeleton /> : <AreaChart data={areaData} height={280} />}
        </SectionCard>
        <SectionCard title="Taux de livraison vs Taux sous-tarif (%)">
          {loading ? <Skeleton /> : (
            <LineChart
              categories={livTrend.categories}
              series={livTrend.series}
              height={280}
              yFormatter={(v) => `${v}%`}
            />
          )}
        </SectionCard>
      </div>

      {/* ── PCC Analysis ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {month ? (
          <SectionCard title="Distribution des écarts tarifaires (PCC)">
            {loading || loadingDetail ? <Skeleton /> : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                <ReactECharts option={buildEcartHistogramOption(ecartDistribution)} style={{ height: 280 }} notMerge />
              </motion.div>
            )}
          </SectionCard>
        ) : (
          <SectionCard title="Distribution des écarts tarifaires (PCC)">
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
              Sélectionnez un mois pour afficher la distribution des écarts
            </div>
          </SectionCard>
        )}

        <SectionCard title="PCC — Résumé de conformité">
          {loading ? <Skeleton /> : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Colis avec tarif théorique", value: formatNumber(pccSummary.nbr_avec_tarif), sub: `sur ${formatNumber(pccSummary.nbr_colis)} total` },
                  { label: "Sous-tarif (pertes)",         value: formatNumber(pccSummary.nbr_sous_tarif), sub: `${pccSummary.taux_sous_tarif_pct?.toFixed(1)}% des tarifés`, warn: true },
                  { label: "Écart total",                value: formatDZD(pccSummary.total_ecart_dzd),   sub: `${pccSummary.taux_ecart_global_pct?.toFixed(1)}% du tarif théo.`, warn: true },
                  { label: "Écart moyen / colis",        value: `${pccSummary.avg_ecart_dzd?.toFixed(1)} DZD`, sub: `moy. absolu: ${pccSummary.avg_ecart_absolu_dzd?.toFixed(1)} DZD` },
                ].map(({ label, value, sub, warn }) => (
                  <div key={label} className="bg-[#252840] rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">{label}</p>
                    <p className={`text-lg font-bold ${warn ? "text-red-400" : "text-white"}`}>{value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── PCC by Agency ranking ── */}
      <SectionCard title="Classement des agences — Conformité PCC (pires en premier)">
        {loading ? <Skeleton h="h-48" /> : (
          <DataTable columns={pccAgencyCols} data={pccByAgency} />
        )}
      </SectionCard>

      {/* ── Cost structure + Cost by nature ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="Structure des coûts">
          {loading ? <Skeleton /> : <PieChart data={costDonutData} height={280} />}
        </SectionCard>
        <SectionCard title="Dépenses par nature (DZD)">
          {loading ? <Skeleton /> : (
            <BarChart
              data={natureBarData.slice(0, 8)}
              height={280}
              color="#6366F1"
              horizontal
              label="DZD"
            />
          )}
        </SectionCard>
      </div>

      {/* ── Agency quadrant scatter ── */}
      <SectionCard title="Quadrant Agences — Livraison vs Conformité tarifaire">
        <p className="text-xs text-slate-500 mb-4">
          Bulle = volume de colis · Seuils: livraison 73%, sous-tarif 24%
        </p>
        {loading ? <Skeleton h="h-72" /> : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
            <ReactECharts option={buildQuadrantOption(byAgency)} style={{ height: 320 }} notMerge />
          </motion.div>
        )}
      </SectionCard>

      {/* ── Agency table ── */}
      <SectionCard title="Scorecard agences — Performance & coûts colis">
        {loading ? <Skeleton h="h-48" /> : (
          <DataTable columns={agencyCols} data={byAgency} />
        )}
      </SectionCard>

      {/* ── Delivery type comparison ── */}
      {!loading && byDeliveryType.length > 0 && (
        <SectionCard title="Comparaison HD vs SD">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {byDeliveryType.map((dt, i) => (
              <motion.div
                key={dt.delivery_type}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#252840] rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${dt.delivery_type === "HD" ? "bg-indigo-500/15 text-indigo-300" : "bg-cyan-500/15 text-cyan-300"}`}>
                    {dt.delivery_type === "HD" ? "Livraison domicile (HD)" : "Point relais (SD)"}
                  </span>
                  <span className="text-lg font-bold text-white">{formatNumber(dt.nbr_colis)}</span>
                </div>
                {[
                  { label: "Taux livraison",  value: `${dt.taux_livraison_pct?.toFixed(1)}%`,  color: dt.taux_livraison_pct >= 75 ? "text-emerald-400" : "text-amber-400" },
                  { label: "Frais moy.",      value: `${dt.avg_fee_dzd?.toFixed(0)} DZD`,      color: "text-slate-200" },
                  { label: "Durée moy. livr.",value: `${Math.round(dt.avg_duree_livree_min / 60)} h`, color: "text-slate-200" },
                  { label: "Taux retour",     value: `${dt.taux_retour_pct?.toFixed(1)}%`,     color: "text-amber-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span className="text-slate-400">{label}</span>
                    <span className={`font-semibold ${color}`}>{value}</span>
                  </div>
                ))}
              </motion.div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Daily volume (only when month selected) ── */}
      {month ? (
        <SectionCard title={`Volume quotidien — ${MONTHS.find((m) => m.value === month)?.label ?? ""} ${year}`}>
          {loading ? <Skeleton /> : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <ReactECharts option={buildDailyVolumeOption(dailyVolume)} style={{ height: 280 }} notMerge />
              <div className="flex gap-4 mt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#10B981]" /> Jour normal</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#22D3EE]" /> Vendredi</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#475569]" /> Weekend</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#F59E0B]" /> Retours</span>
              </div>
            </motion.div>
          )}
        </SectionCard>
      ) : null}

      {/* ── Duration distribution (only when month selected) ── */}
      {month ? (
        <SectionCard title="Distribution des délais de livraison">
          {loading || loadingDetail ? <Skeleton /> : (
            <BarChart
              data={durationBarData}
              height={260}
              color="#22D3EE"
              label="Colis livrés"
            />
          )}
        </SectionCard>
      ) : null}

      {/* ── Sinistres ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title="Sinistres — Répartition par type">
          {loading ? <Skeleton /> : <PieChart data={sinPieData} height={260} />}
        </SectionCard>
        <SectionCard title="Sinistres — KPIs">
          {loading ? <Skeleton /> : (
            <div className="space-y-3">
              {[
                { label: "Sinistres déclarés",   value: String(sinistres.summary.nbr_sinistres) },
                { label: "Montant déclaré",       value: formatDZD(sinistres.summary.sum_declared_dzd) },
                { label: "Montant remboursé",     value: formatDZD(sinistres.summary.sum_rembourse_dzd), warn: true },
                { label: "Taux de couverture",    value: `${sinistres.summary.taux_couverture_pct?.toFixed(1)}%` },
                { label: "Remboursement moyen",   value: `${sinistres.summary.avg_rembourse_dzd?.toFixed(0)} DZD` },
              ].map(({ label, value, warn }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-[#2D3050] last:border-0">
                  <span className="text-sm text-slate-400">{label}</span>
                  <span className={`text-sm font-semibold ${warn ? "text-amber-400" : "text-white"}`}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Freelance efficiency ── */}
      <SectionCard title="Efficacité des livreurs freelance">
        {loading ? <Skeleton h="h-48" /> : (
          <DataTable columns={freelanceCols} data={freelance} />
        )}
      </SectionCard>

      {/* ── Parcel drill-down table (only when month selected) ── */}
      {month ? (
        <SectionCard title={`Détail colis — ${MONTHS.find((m) => m.value === month)?.label ?? ""} ${year}`}>
          {loadingDetail ? <Skeleton h="h-48" /> : (
            <>
              <p className="text-xs text-slate-500 mb-3">
                {formatNumber(parcels.count)} colis · page {parcels.page}/{parcels.pages}
              </p>
              <DataTable columns={parcelCols} data={parcels.results} />
              <div className="flex items-center justify-between mt-4">
                <button
                  disabled={parcelPage <= 1}
                  onClick={() => { const p = parcelPage - 1; setParcelPage(p); fetchDetail(p); }}
                  className="flex items-center gap-1 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} /> Précédent
                </button>
                <span className="text-xs text-slate-500">Page {parcelPage} sur {parcels.pages}</span>
                <button
                  disabled={parcelPage >= parcels.pages}
                  onClick={() => { const p = parcelPage + 1; setParcelPage(p); fetchDetail(p); }}
                  className="flex items-center gap-1 text-sm text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Suivant <ChevronRight size={14} />
                </button>
              </div>
            </>
          )}
        </SectionCard>
      ) : (
        <div className="bg-[#1E2030] border border-[#2D3050] rounded-xl p-5 flex items-center justify-center h-24 text-slate-500 text-sm">
          <Package size={16} className="mr-2" />
          Sélectionnez un mois pour afficher le détail des colis et les histogrammes
        </div>
      )}

    </div>
  );
}
