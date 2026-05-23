"use client";

import { useEffect, useState, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import {
  Truck, TrendingUp, DollarSign, Gauge, Star, Ban,
  Route, PackageCheck, ChevronDown, Info,
} from "lucide-react";

import { KpiCard } from "@/components/ui/KpiCard";
import { InfoPanel, type KpiInfo } from "@/components/ui/InfoPanel";
import { DataTable } from "@/components/ui/DataTable";
import { PieChart } from "@/components/charts/PieChart";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { AreaChart } from "@/components/charts/AreaChart";
import type { Column } from "@/components/ui/DataTable";
import { useTranslation } from "@/lib/i18n"
import { useChartTheme } from "@/lib/chartTheme";

import { transportApi } from "@/lib/api";
import { formatDZD, formatNumber, formatPercent } from "@/lib/utils";
import {
  mockTransportSummary,
  mockTransportTrends,
  mockTransportCostBreakdown,
  mockTransportByService,
  mockTransportByVehicle,
  mockTransportCorridors,
  mockODMatrix,
  mockDelayDistribution,
} from "@/lib/mock-data";

import type {
  TransportSummary,
  TransportTrendPoint,
  TransportCostBreakdown,
  TransportServiceData,
  TransportVehicleData,
  TransportCorridor,
  ODMatrixCell,
  DelayBucket,
} from "@/types/transport";

// ─── Constants ────────────────────────────────────────────────────────────────

const YEARS = [2023, 2024, 2025];

// ─── Info panel content ───────────────────────────────────────────────────────

const FREQ = "Quotidienne — pipeline ETL Dagster (nightly job)";

const KPI_INFO: Record<string, KpiInfo> = {
  totalRequests: {
    title: "Demandes totales",
    meaning: "Nombre total de demandes de transport reçues sur la période, toutes agences et types de service confondus.",
    formula: "SUM(nbr_requests)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois", "Type de service", "Agence", "Type de véhicule"],
    updateFreq: FREQ,
    calcNotes: "Inclut toutes les demandes (en cours, terminées, annulées). Le groupe TEST (company_id=9) est exclu par contrainte CHECK en base.",
  },
  completionRate: {
    title: "Taux de complétion",
    meaning: "Part des demandes de transport menées à terme avec succès sur la période sélectionnée.",
    formula: "SUM(nbr_terminees) / SUM(nbr_requests) × 100",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois", "Type de service"],
    updateFreq: FREQ,
    calcNotes: "Une demande est 'terminée' lorsque toutes ses livraisons sont confirmées et son statut final validé en source.",
  },
  cancellationRate: {
    title: "Taux d'annulation",
    meaning: "Part des demandes annulées sur le total reçu. La tendance est inversée : une baisse du taux s'affiche en vert.",
    formula: "SUM(nbr_annulees) / SUM(nbr_requests) × 100",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois", "Type de service"],
    updateFreq: FREQ,
    calcNotes: "Tendance ×(−1) : une réduction du taux d'annulation est un signal positif (vert).",
  },
  avgStops: {
    title: "Arrêts moy. / demande",
    meaning: "Nombre moyen d'arrêts (pickup + livraison) par demande de transport complétée.",
    formula: "AVG(nbr_stops_total)\nFILTER: status = 'terminée'",
    source: ["warehouse.fact_transport", "warehouse.dim_date"],
    dimensions: ["Année", "Mois", "Type de service"],
    updateFreq: FREQ,
    calcNotes: "Requête directe sur fact_transport — non disponible dans agg_transport_mensuel. Seules les demandes terminées sont incluses.",
    warning: "Données absentes si aucune demande terminée sur la période sélectionnée.",
  },
  totalRevenue: {
    title: "Revenu total",
    meaning: "Montant total facturé aux clients pour les services de transport sur la période (DZD).",
    formula: "SUM(total_facture_dzd)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois", "Type de service"],
    updateFreq: FREQ,
    calcNotes: "Montant facturé, pas nécessairement encaissé. Voir le taux de recouvrement pour les paiements effectifs.",
  },
  grossMargin: {
    title: "Marge brute %",
    meaning: "Part du revenu restante après déduction des coûts directs (carburant, assurance, manutention, distance).",
    formula: "SUM(total_marge_brute_dzd) / SUM(total_facture_dzd) × 100",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois", "Type de service"],
    updateFreq: FREQ,
    calcNotes: "Marge brute opérationnelle directe — exclut charges indirectes (loyers, amortissements, administratif).",
  },
  avgCostPerRequest: {
    title: "Coût moy. / demande",
    meaning: "Coût opérationnel moyen engagé par demande de transport complétée (DZD).",
    formula: "SUM(total_cout_dzd) / SUM(nbr_terminees)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois", "Type de service"],
    updateFreq: FREQ,
    calcNotes: "Calculé sur les demandes terminées uniquement. Tendance ×(−1) : une baisse s'affiche en vert.",
  },
  costPerKm: {
    title: "Coût / km",
    meaning: "Coût opérationnel moyen par kilomètre parcouru — indicateur clé d'efficacité logistique.",
    formula: "SUM(total_cout_dzd) / SUM(total_km)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois", "Type de service", "Type de véhicule"],
    updateFreq: FREQ,
    calcNotes: "Inclut carburant, assurance, manutention et frais de distance supplémentaire. Tendance ×(−1) : une baisse s'affiche en vert.",
  },
  punctuality: {
    title: "Ponctualité",
    meaning: "Pourcentage de demandes terminées avec arrivée à l'heure ou en avance (délai ≤ 0 min).",
    formula: "SUM(taux_ponctualite_pct × nbr_terminees) / SUM(nbr_terminees)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois", "Type de service"],
    updateFreq: FREQ,
    calcNotes: "Moyenne pondérée par le volume pour éviter les biais des faibles volumes d'agences.",
    warning: "Un retard de 1 minute est comptabilisé comme non ponctuel. Seuil strict : arrivée ≤ heure prévue.",
  },
  avgNote: {
    title: "Note client moy.",
    meaning: "Satisfaction client moyenne (1 à 5) collectée après chaque demande terminée.",
    formula: "SUM(avg_note_client × nbr_terminees) / SUM(nbr_terminees)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois", "Type de service"],
    updateFreq: FREQ,
    calcNotes: "Moyenne pondérée par le volume. Les demandes sans note sont exclues.",
    warning: "Taux de notation estimé à ~72% — biais de sélection possible si les clients insatisfaits notent moins.",
  },
  avgCostPerPiece: {
    title: "Coût moy. / pièce",
    meaning: "Coût opérationnel moyen par pièce (colis/article) transportée — indicateur de productivité unitaire.",
    formula: "SUM(total_cout_dzd) / SUM(total_pieces)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois", "Type de service"],
    updateFreq: FREQ,
    calcNotes: "Tendance ×(−1) : une baisse du coût unitaire s'affiche en vert.",
  },
  insuranceRatio: {
    title: "Ratio assurance",
    meaning: "Part des coûts d'assurance dans le coût total — indicateur de la structure des charges de risque.",
    formula: "SUM(cout_assurance) / SUM(total_cout) × 100\n\n[valeur issue de l'endpoint cost_breakdown]",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois", "Type de service"],
    updateFreq: FREQ,
    calcNotes: "Tendance ×(−1) : une hausse du ratio (risque croissant) s'affiche en rouge.",
    warning: "Contrainte légale : cout_assurance ≥ 5 000 DZD / demande (CHECK constraint sur fact_transport). Toute demande sous ce seuil est rejetée à l'ingestion ETL.",
  },
};

const CHART_INFO: Record<string, KpiInfo> = {
  revenueCost: {
    title: "Évolution Revenu vs Coût",
    meaning: "Comparaison mensuelle du revenu facturé et du coût opérationnel sur les 12 mois de l'année sélectionnée.",
    formula: "Revenu : SUM(total_facture_dzd)\nCoût   : SUM(total_cout_dzd)\nGROUP BY year, month_num",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Mois", "Type de service"],
    updateFreq: FREQ,
  },
  requestsByStatus: {
    title: "Demandes par statut",
    meaning: "Répartition mensuelle des demandes : terminées, en cours, annulées.",
    formula: "Terminées : SUM(nbr_terminees)\nEn cours  : SUM(nbr_requests) - SUM(nbr_terminees) - SUM(nbr_annulees)\nAnnulées  : SUM(nbr_annulees)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Mois", "Type de service"],
    updateFreq: FREQ,
    calcNotes: "Les demandes 'en cours' sont calculées par soustraction et incluent aussi les demandes acceptées non encore traitées.",
  },
  costStructure: {
    title: "Structure des coûts",
    meaning: "Répartition des coûts par composante : base, distance supplémentaire, assurance, carburant, manutention, autres.",
    formula: "SUM(cout_base) + SUM(cout_distance_supp) + SUM(cout_assurance)\n+ SUM(cout_carburant) + SUM(cout_manutention) + cout_autres",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois", "Type de service"],
    updateFreq: FREQ,
    calcNotes: "'Autres' = total_cout − somme des composantes connues (peut inclure ajustements ou frais non catégorisés).",
  },
  punctualityGauge: {
    title: "Ponctualité (jauge)",
    meaning: "Taux de ponctualité actuel sur la période — visualisation instantanée du niveau de service.",
    formula: "SUM(taux_ponctualite_pct × nbr_terminees) / SUM(nbr_terminees)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois", "Type de service"],
    updateFreq: FREQ,
    calcNotes: "Seuils couleur : rouge < 70%, orange 70-85%, vert > 85%.",
  },
  punctualityTrend: {
    title: "Tendance de ponctualité",
    meaning: "Évolution mensuelle du taux de ponctualité — détection de dégradations progressives du niveau de service.",
    formula: "SUM(taux_ponctualite_pct × nbr_terminees) / SUM(nbr_terminees)\nGROUP BY year, month_num",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Mois", "Type de service"],
    updateFreq: FREQ,
  },
  costKmTrend: {
    title: "Tendance Coût / km",
    meaning: "Évolution mensuelle du coût par kilomètre — suivi de l'efficacité logistique dans le temps.",
    formula: "SUM(total_cout_dzd) / SUM(total_km)\nGROUP BY year, month_num",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Mois", "Type de service"],
    updateFreq: FREQ,
  },
  delayDistribution: {
    title: "Distribution des retards",
    meaning: "Répartition des demandes terminées par tranche de retard à l'arrivée (5 buckets).",
    formula: "COUNT(*) GROUP BY bucket\nBuckets : À l'heure (≤0 min), 1-15 min, 16-30 min, 31-60 min, >60 min",
    source: ["warehouse.fact_transport", "warehouse.dim_date"],
    dimensions: ["Année", "Mois", "Type de service"],
    updateFreq: FREQ,
    calcNotes: "Requête directe sur fact_transport (granularité demande). Seules les demandes au statut 'terminée' sont incluses.",
  },
  vehicleEfficiency: {
    title: "Efficacité par type de véhicule",
    meaning: "Comparaison du coût par kilomètre entre catégories de véhicules — aide à l'optimisation de la flotte.",
    formula: "SUM(total_cout_dzd) / SUM(total_km)\nGROUP BY vehicle_type, payload_class",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois", "Type de véhicule", "Classe de charge"],
    updateFreq: FREQ,
  },
  serviceBreakdown: {
    title: "Répartition par type de service",
    meaning: "Volume, marge, ponctualité et satisfaction par type et sous-type de service.",
    formula: "GROUP BY service_type, sub_service_type\nMarge : SUM(marge) / SUM(revenu) × 100",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: ["Année", "Mois"],
    updateFreq: FREQ,
    calcNotes: "Couleurs marge : vert ≥ 24%, orange 20-24%, rouge < 20%. Ponctualité : vert ≥ 90%, orange 80-90%, rouge < 80%.",
  },
  odMatrix: {
    title: "Matrice Origine → Destination",
    meaning: "Flux de transport entre régions — intensité = volume de demandes, info-bulle = marge.",
    formula: "SUM(nbr_requests) GROUP BY region_depart, region_arrivee",
    source: ["warehouse.agg_demande_transport"],
    dimensions: ["Année", "Mois", "Région départ", "Région arrivée"],
    updateFreq: FREQ,
    calcNotes: "Source différente des autres charts : agg_demande_transport (grain : wilaya × wilaya × service × client).",
    warning: "Des marges uniformes entre régions peuvent refléter une formule de pricing standardisée dans les données source.",
  },
  corridors: {
    title: "Top Corridors (par volume)",
    meaning: "Classement des paires Origine-Destination par volume, avec marge, distance et coût unitaire.",
    formula: "GROUP BY wilaya_depart, wilaya_arrivee\nTrié par SUM(nbr_requests) DESC\nLIMIT 10",
    source: ["warehouse.agg_demande_transport"],
    dimensions: ["Année", "Mois", "Type de service", "Type de client"],
    updateFreq: FREQ,
    calcNotes: "Relation : Revenu ≈ Demandes × Dist_moy × DZD/km. Les 10 premiers corridors sont affichés.",
  },
};
// MONTHS, SERVICE_TYPES, COST_LABELS, REGION_ORDER are built inside the component from translations

// ─── Chart theme type ─────────────────────────────────────────────────────────

interface CT {
  tooltip: { backgroundColor: string; borderColor: string; textStyle: { color: string; fontSize: number } }
  splitLine: { lineStyle: { color: string; type: "dashed" } }
  axisLabel: { color: string; fontSize: number }
  axisColor: string; legendColor: string; labelColor: string; textColor: string; surface: string; bgColor: string;
}

// ─── Page state ───────────────────────────────────────────────────────────────

interface PageData {
  summary: TransportSummary;
  trends: TransportTrendPoint[];
  costBreakdown: TransportCostBreakdown;
  byService: TransportServiceData[];
  byVehicle: TransportVehicleData[];
  corridors: TransportCorridor[];
  odMatrix: ODMatrixCell[];
  delays: DelayBucket[];
}

const MOCK_DATA: PageData = {
  summary: mockTransportSummary,
  trends: mockTransportTrends,
  costBreakdown: mockTransportCostBreakdown,
  byService: mockTransportByService,
  byVehicle: mockTransportByVehicle,
  corridors: mockTransportCorridors,
  odMatrix: mockODMatrix,
  delays: mockDelayDistribution,
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
        className="appearance-none bg-[var(--surface-secondary)] border border-[var(--border)] text-[var(--text-primary)] text-sm rounded-lg pl-3 pr-8 py-2 focus:outline-none focus:border-primary/60 cursor-pointer"
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

function SectionCard({ title, children, className = "", onInfoClick }: {
  title: string;
  children: React.ReactNode;
  className?: string;
  onInfoClick?: () => void;
}) {
  return (
    <div className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
        {onInfoClick && (
          <button
            onClick={onInfoClick}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] transition-colors"
            aria-label="Informations"
          >
            <Info size={13} />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Skeleton({ h = "h-64" }: { h?: string }) {
  return <div className={`${h} bg-[var(--surface-secondary)] animate-pulse rounded-lg`} />;
}

// ─── OD Matrix chart option ───────────────────────────────────────────────────

function buildODOption(
  cells: ODMatrixCell[],
  regionOrder: string[],
  labels: { requests: string; margin: string; destination: string; origin: string },
  ct: CT,
) {
  const regions = regionOrder;
  const data: [number, number, number][] = [];
  let max = 0;

  cells.forEach((c) => {
    const xi = regions.indexOf(c.destination);
    const yi = regions.indexOf(c.origin);
    if (xi === -1 || yi === -1) return;
    data.push([xi, yi, c.nbr_requests]);
    if (c.nbr_requests > max) max = c.nbr_requests;
  });

  return {
    backgroundColor: "transparent",
    tooltip: {
      ...ct.tooltip,
      position: "top",
      formatter: (p: { data: [number, number, number] }) => {
        const cell = cells.find(
          (c) => regions.indexOf(c.destination) === p.data[0] && regions.indexOf(c.origin) === p.data[1]
        );
        return cell
          ? `${cell.origin} → ${cell.destination}<br/>${cell.nbr_requests} ${labels.requests}<br/>${labels.margin}: ${cell.taux_marge_pct ?? "—"}%`
          : "";
      },
    },
    grid: { left: 100, right: 20, top: 10, bottom: 40 },
    xAxis: {
      type: "category" as const,
      data: regions,
      name: labels.destination,
      nameLocation: "middle" as const,
      nameGap: 25,
      nameTextStyle: { color: ct.labelColor, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: ct.legendColor, fontSize: 11 },
    },
    yAxis: {
      type: "category" as const,
      data: regions,
      name: labels.origin,
      nameLocation: "middle" as const,
      nameGap: 80,
      nameTextStyle: { color: ct.labelColor, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: ct.legendColor, fontSize: 11 },
    },
    visualMap: {
      min: 0,
      max: max || 1,
      show: false,
      inRange: { color: [ct.surface, "#6366F1"] },
    },
    series: [{
      type: "heatmap" as const,
      data,
      label: {
        show: true,
        formatter: (p: { data: [number, number, number] }) => p.data[2] > 0 ? String(p.data[2]) : "",
        color: ct.textColor,
        fontSize: 13,
        fontWeight: "bold" as const,
      },
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: "rgba(99,102,241,0.5)" } },
      itemStyle: { borderRadius: 6, borderColor: ct.bgColor, borderWidth: 3 },
    }],
  };
}

// ─── Request status stacked bar ───────────────────────────────────────────────

function buildStatusStackedOption(
  trends: TransportTrendPoint[],
  cats: string[],
  series: { completed: string; inProgress: string; cancelled: string },
  ct: CT,
) {
  return {
    backgroundColor: "transparent",
    tooltip: { trigger: "axis" as const, ...ct.tooltip, axisPointer: { type: "shadow" as const } },
    legend: { top: 0, right: 0, textStyle: { color: ct.legendColor, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    grid: { left: 16, right: 16, top: 40, bottom: 0, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: cats,
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisTick: { show: false },
      axisLabel: { ...ct.axisLabel, rotate: 30 },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      splitLine: ct.splitLine,
      axisLabel: ct.axisLabel,
    },
    series: [
      { name: series.completed,  type: "bar" as const, stack: "s", data: trends.map((t) => t.nbr_terminees), itemStyle: { color: "#10B981" } },
      { name: series.inProgress, type: "bar" as const, stack: "s", data: trends.map((t) => Math.max(0, t.nbr_requests - t.nbr_terminees - t.nbr_annulees)), itemStyle: { color: "#F59E0B" } },
      { name: series.cancelled,  type: "bar" as const, stack: "s", data: trends.map((t) => t.nbr_annulees), itemStyle: { color: "#EF4444", borderRadius: [4, 4, 0, 0] } },
    ],
  };
}

// ─── On-time gauge ────────────────────────────────────────────────────────────

function buildOnTimeGaugeOption(value: number, gaugeLabel: string, ct: CT) {
  return {
    backgroundColor: "transparent",
    series: [{
      type: "gauge" as const,
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      splitNumber: 5,
      radius: "85%",
      center: ["50%", "60%"],
      axisLine: {
        lineStyle: {
          width: 18,
          color: [[0.7, "#EF4444"], [0.85, "#F59E0B"], [1, "#10B981"]] as [number, string][],
        },
      },
      pointer: {
        icon: "path://M12.8,0.7l12.3,42H0.5L12.8,0.7z",
        length: "12%",
        width: 20,
        offsetCenter: [0, "-60%"],
        itemStyle: { color: "auto" },
      },
      axisTick: { length: 8, lineStyle: { color: "auto", width: 2 } },
      splitLine: { length: 14, lineStyle: { color: "auto", width: 3 } },
      axisLabel: { color: ct.legendColor, fontSize: 11, distance: -48, formatter: (v: number) => `${v}%` },
      title: { offsetCenter: [0, "30%"], fontSize: 12, color: ct.legendColor },
      detail: {
        valueAnimation: true,
        fontSize: 30,
        fontWeight: "bold" as const,
        offsetCenter: [0, "5%"],
        color: ct.textColor,
        formatter: "{value}%",
      },
      data: [{ value: Math.round(value * 10) / 10, name: gaugeLabel }],
    }],
  };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function TransportPage() {
  const [year, setYear] = useState<number>(2025);
  const [month, setMonth] = useState<number | null>(null);
  const [serviceType, setServiceType] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);
  const [data, setData] = useState<PageData>(MOCK_DATA);
  const [activeInfo, setActiveInfo] = useState<KpiInfo | null>(null);

  const { t } = useTranslation();
  const p = t.pages.transport;
  const pc = t.pages.common;
  const chartT = useChartTheme();
  const ct: CT = {
    tooltip: { backgroundColor: chartT.tooltipBg, borderColor: chartT.borderColor, textStyle: { color: chartT.textColor, fontSize: 12 } },
    splitLine: { lineStyle: { color: chartT.splitColor, type: "dashed" } },
    axisLabel: { color: chartT.labelColor, fontSize: 11 },
    axisColor: chartT.axisColor,
    legendColor: chartT.legendColor,
    labelColor: chartT.labelColor,
    textColor: chartT.textColor,
    surface: chartT.surface,
    bgColor: chartT.bgColor,
  };

  const MONTHS = [
    { label: pc.monthAll, value: null },
    ...pc.months.map((name, i) => ({ label: name, value: i + 1 })),
  ];
  const SERVICE_TYPES = [
    { label: p.allServices, value: "all" },
    { label: p.dedicatedTrip, value: "course_dediee" },
    { label: p.courier, value: "courrier" },
    { label: p.handling, value: "manutention" },
  ];
  const COST_LABELS = p.costLabels;
  const REGION_ORDER = ["Nord", "Hauts Plateaux", "Sud"];

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const f = { year, month: month ?? undefined, service_type: serviceType !== "all" ? serviceType : undefined };
    try {
      const [summary, trends, costBreakdown, byService, byVehicle, corridors, odMatrix, delays] =
        await Promise.all([
          transportApi.summary(f),
          transportApi.trends({
            service_type: f.service_type,
            from_year_month: `${year}-01`,
            to_year_month: `${year}-12`,
          }),
          transportApi.costBreakdown(f),
          transportApi.byService({ year, month: f.month }),
          transportApi.byVehicle({ year, month: f.month, service_type: f.service_type }),
          transportApi.corridors({ ...f, limit: 10 }),
          transportApi.odMatrix({ year, month: f.month }),
          transportApi.delayDistribution(f),
        ]);
      setData({ summary, trends, costBreakdown, byService, byVehicle, corridors, odMatrix, delays });
      setUsingMock(false);
    } catch {
      setData(MOCK_DATA);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [year, month, serviceType]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const { summary, trends, costBreakdown, byService, byVehicle, corridors, odMatrix, delays } = data;
  const { current: cur, derived: d } = summary;

  const trendLabel = month !== null ? p.vsPrevMonth : p.vsLastYear;

  const insuranceRatio = costBreakdown.total_cost > 0
    ? Math.round(costBreakdown.cout_assurance / costBreakdown.total_cost * 1000) / 10
    : 0;

  const serviceTypeLabel = (st: string) =>
    st === "course_dediee" ? p.dedicatedTrip
    : st === "courrier"    ? p.courier
    : st === "manutention" ? p.handling
    : st;

  // ── Derived chart data ──────────────────────────────────────────────────────

  const areaData = trends.map((tr) => ({
    month: `${pc.monthsShort[tr.month_num - 1] ?? tr.month_name_fr.slice(0, 3)} ${String(tr.year).slice(2)}`,
    revenue: tr.total_revenue,
    cost: tr.total_cost,
  }));

  const costBreakdownMap = costBreakdown as unknown as Record<string, number>;
  const costDonutData = Object.entries(COST_LABELS)
    .map(([key, label]) => ({ name: label, value: Math.round(costBreakdownMap[key] ?? 0) }))
    .filter((x) => x.value > 0);

  const trendCats = trends.map((tr) => `${pc.monthsShort[tr.month_num - 1] ?? tr.month_name_fr.slice(0, 3)} ${String(tr.year).slice(2)}`);

  const onTimeTrend = {
    categories: trendCats,
    series: [{ name: p.punctualitySeries, data: trends.map((tr) => tr.taux_ponctualite_pct), color: "#6366F1" }],
  };

  const costKmTrend = {
    categories: trendCats,
    series: [{ name: p.costKmSeries, data: trends.map((tr) => tr.cout_par_km), color: "#F59E0B" }],
  };

  const vehicleBarData = byVehicle.map((v) => ({ name: v.vehicle_type, value: v.cout_par_km }));
  const delayBarData   = delays.map((d) => ({ name: d.bucket, value: d.count }));
  const byServiceTotal = byService.reduce((sum, s) => sum + s.nbr_requests, 0);

  // ── Column defs ─────────────────────────────────────────────────────────────

  const corridorCols: Column<TransportCorridor>[] = [
    { key: "wilaya_depart_name",  header: p.colOrigin,      sortable: true },
    { key: "wilaya_arrivee_name", header: p.colDestination, sortable: true },
    {
      key: "meme_region", header: p.colRegion,
      render: (r) => (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.meme_region ? "bg-emerald-500/10 text-emerald-400" : "bg-indigo-500/10 text-indigo-400"}`}>
          {r.meme_region ? "Intra" : "Inter"}
        </span>
      ),
    },
    { key: "nbr_requests",    header: p.colRequests,   sortable: true },
    {
      key: "taux_marge_pct", header: p.colMarginPct, sortable: true,
      render: (r) => (
        <span className={`font-semibold ${r.taux_marge_pct >= 24 ? "text-emerald-400" : r.taux_marge_pct >= 20 ? "text-amber-400" : "text-red-400"}`}>
          {r.taux_marge_pct?.toFixed(1) ?? "—"}%
        </span>
      ),
    },
    { key: "avg_distance_km", header: p.colAvgDist, sortable: true, render: (r) => `${r.avg_distance_km ?? "—"} km` },
    { key: "cout_par_km",     header: p.colDzdKm,   sortable: true, render: (r) => `${r.cout_par_km ?? "—"}` },
    {
      key: "total_revenue", header: p.colRevenue, sortable: true,
      render: (r) => <span className="font-mono text-sm">{formatDZD(r.total_revenue)}</span>,
    },
  ];


  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={year} onChange={(v) => setYear(v as number)} options={YEARS.map((y) => ({ label: String(y), value: y }))} />
        <Select value={month} onChange={(v) => setMonth(v as number | null)} options={MONTHS} />
        <Select value={serviceType} onChange={(v) => setServiceType(v as string)} options={SERVICE_TYPES} />
        {usingMock && (
          <span className="ml-auto text-xs text-amber-400/80 border border-amber-400/20 bg-amber-400/5 px-3 py-1.5 rounded-lg">
            {p.demoData}
          </span>
        )}
        {loading && (
          <span className="ml-auto text-xs text-slate-400 animate-pulse">{p.loading}</span>
        )}
      </div>

      {/* ── Volume & Fulfillment ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title={p.kpiTotalRequests}    value={formatNumber(cur.total_requests)}                 trend={d.mom_requests}          trendLabel={trendLabel} icon={<Truck size={16} />}        index={0}  onInfoClick={() => setActiveInfo(KPI_INFO.totalRequests)} />
        <KpiCard title={p.kpiCompletionRate}   value={formatPercent(d.completion_rate)}                 trend={d.mom_completion_rate}   trendLabel={trendLabel} icon={<PackageCheck size={16} />}  index={1}  onInfoClick={() => setActiveInfo(KPI_INFO.completionRate)} />
        <KpiCard title={p.kpiCancellationRate} value={formatPercent(d.cancellation_rate)}               trend={d.mom_cancellation_rate} trendLabel={trendLabel} icon={<Ban size={16} />}           index={2}  onInfoClick={() => setActiveInfo(KPI_INFO.cancellationRate)} />
        <KpiCard title={p.kpiAvgStops}         value={cur.avg_arrets_par_demande?.toFixed(1) ?? "—"}   trend={d.mom_avg_arrets}        trendLabel={trendLabel} icon={<Route size={16} />}         index={3}  onInfoClick={() => setActiveInfo(KPI_INFO.avgStops)} />
      </div>

      {/* ── Revenue & Cost Efficiency ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title={p.kpiTotalRevenue}      value={formatDZD(cur.total_revenue)}          trend={d.mom_revenue}              trendLabel={trendLabel} icon={<DollarSign size={16} />} index={4}  onInfoClick={() => setActiveInfo(KPI_INFO.totalRevenue)} />
        <KpiCard title={p.kpiGrossMargin}       value={formatPercent(d.gross_margin_pct)}     trend={d.mom_margin}               trendLabel={trendLabel} icon={<TrendingUp size={16} />} index={5}  onInfoClick={() => setActiveInfo(KPI_INFO.grossMargin)} />
        <KpiCard title={p.kpiAvgCostPerRequest} value={formatDZD(cur.avg_cout_par_demande)}  trend={d.mom_avg_cout_par_demande} trendLabel={trendLabel} icon={<DollarSign size={16} />} index={6}  onInfoClick={() => setActiveInfo(KPI_INFO.avgCostPerRequest)} />
        <KpiCard title={p.kpiCostPerKm}         value={`${d.cost_per_km} DZD`}               trend={d.mom_cost_per_km}          trendLabel={trendLabel} icon={<Route size={16} />}      index={7}  onInfoClick={() => setActiveInfo(KPI_INFO.costPerKm)} />
      </div>

      {/* ── Quality & Cost Structure ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title={p.kpiPunctuality}     value={formatPercent(cur.avg_ponctualite_pct)}  trend={d.mom_on_time}            trendLabel={trendLabel} icon={<Gauge size={16} />}       index={8}  onInfoClick={() => setActiveInfo(KPI_INFO.punctuality)} />
        <KpiCard title={p.kpiAvgNote}         value={cur.avg_note_client?.toFixed(1) ?? "—"}  trend={d.mom_avg_note}           trendLabel={trendLabel} icon={<Star size={16} />}        index={9}  onInfoClick={() => setActiveInfo(KPI_INFO.avgNote)} />
        <KpiCard title={p.kpiAvgCostPerPiece} value={formatDZD(cur.avg_cout_par_piece)}       trend={d.mom_avg_cout_par_piece} trendLabel={trendLabel} icon={<DollarSign size={16} />}  index={10} onInfoClick={() => setActiveInfo(KPI_INFO.avgCostPerPiece)} />
        <KpiCard title={p.kpiInsuranceRatio}  value={formatPercent(insuranceRatio)}           trend={d.mom_insurance_ratio}    trendLabel={trendLabel} icon={<TrendingUp size={16} />}  index={11} onInfoClick={() => setActiveInfo(KPI_INFO.insuranceRatio)} />
      </div>

      {/* ── Trends: Revenue vs Cost + Requests by Status ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionRevenueCost} onInfoClick={() => setActiveInfo(CHART_INFO.revenueCost)}>
          {loading ? <Skeleton /> : <AreaChart data={areaData} height={280} />}
        </SectionCard>
        <SectionCard title={p.sectionRequestsByStatus} onInfoClick={() => setActiveInfo(CHART_INFO.requestsByStatus)}>
          {loading ? <Skeleton /> : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <ReactECharts
                option={buildStatusStackedOption(trends, trendCats, { completed: p.completedSeries, inProgress: p.inProgressSeries, cancelled: p.cancelledSeries }, ct)}
                style={{ height: 280 }}
                notMerge
              />
            </motion.div>
          )}
        </SectionCard>
      </div>

      {/* ── Cost breakdown + On-time gauge ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionCostStructure} onInfoClick={() => setActiveInfo(CHART_INFO.costStructure)}>
          {loading ? <Skeleton /> : <PieChart data={costDonutData} height={280} />}
        </SectionCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionCard title={p.sectionCurrentPunctuality} onInfoClick={() => setActiveInfo(CHART_INFO.punctualityGauge)}>
            {loading ? <Skeleton h="h-full" /> : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
                <ReactECharts option={buildOnTimeGaugeOption(cur.avg_ponctualite_pct, p.kpiPunctuality, ct)} style={{ height: 220 }} notMerge />
              </motion.div>
            )}
          </SectionCard>
          <SectionCard title={p.sectionPunctualityTrend} onInfoClick={() => setActiveInfo(CHART_INFO.punctualityTrend)}>
            {loading ? <Skeleton h="h-full" /> : (
              <LineChart
                categories={onTimeTrend.categories}
                series={onTimeTrend.series}
                height={220}
                yFormatter={(v) => `${v}%`}
              />
            )}
          </SectionCard>
        </div>
      </div>

      {/* ── Unit cost trend + Delay histogram ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionCostKmTrend} onInfoClick={() => setActiveInfo(CHART_INFO.costKmTrend)}>
          {loading ? <Skeleton /> : (
            <LineChart
              categories={costKmTrend.categories}
              series={costKmTrend.series}
              height={260}
              yFormatter={(v) => `${v} DZD`}
            />
          )}
        </SectionCard>
        <SectionCard title={p.sectionDelayDistribution} onInfoClick={() => setActiveInfo(CHART_INFO.delayDistribution)}>
          {loading ? <Skeleton /> : (
            <BarChart
              data={delayBarData}
              height={260}
              color="#6366F1"
              label={p.colRequests}
            />
          )}
        </SectionCard>
      </div>

      {/* ── Vehicle efficiency + Service breakdown ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionVehicleEfficiency} onInfoClick={() => setActiveInfo(CHART_INFO.vehicleEfficiency)}>
          {loading ? <Skeleton /> : (
            <BarChart
              data={vehicleBarData}
              height={260}
              color="#22D3EE"
              label="DZD/km"
              horizontal
            />
          )}
        </SectionCard>
        <SectionCard title={p.sectionServiceBreakdown} onInfoClick={() => setActiveInfo(CHART_INFO.serviceBreakdown)}>
          {loading ? <Skeleton /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-[var(--text-secondary)] uppercase tracking-wider border-b border-[var(--border)]">
                    <th className="pb-2 text-left font-semibold">Type</th>
                    <th className="pb-2 text-right font-semibold">{p.colRequests}</th>
                    <th className="pb-2 text-right font-semibold">{p.colMarginPct}</th>
                    <th className="pb-2 text-right font-semibold">{p.colPunctuality}</th>
                    <th className="pb-2 text-right font-semibold">{p.colNote}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {byService.map((s) => {
                    const share = byServiceTotal > 0
                      ? Math.round(s.nbr_requests / byServiceTotal * 100) : 0;
                    return (
                      <tr key={`${s.service_type}-${s.sub_service_type}`} className="text-[var(--text-primary)]">
                        <td className="py-2.5 font-medium">
                          <span className="text-xs text-slate-400 block">{serviceTypeLabel(s.service_type)}</span>
                          {s.sub_service_type !== "N/A" && (
                            <span className="text-xs text-slate-500">{s.sub_service_type}</span>
                          )}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">
                          {formatNumber(s.nbr_requests)}
                          <span className="text-xs text-slate-500 ml-1">({share}%)</span>
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={`font-semibold ${s.taux_marge_pct >= 24 ? "text-emerald-400" : s.taux_marge_pct >= 20 ? "text-amber-400" : "text-red-400"}`}>
                            {s.taux_marge_pct?.toFixed(1) ?? "—"}%
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={`font-semibold ${s.taux_ponctualite_pct >= 90 ? "text-emerald-400" : s.taux_ponctualite_pct >= 80 ? "text-amber-400" : "text-red-400"}`}>
                            {s.taux_ponctualite_pct?.toFixed(1) ?? "—"}%
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-slate-300">
                          {s.avg_note_client?.toFixed(1) ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── OD Matrix ── */}
      <SectionCard title={p.sectionODMatrix} onInfoClick={() => setActiveInfo(CHART_INFO.odMatrix)}>
        <div className="flex items-start gap-8">
          {loading ? <div className="flex-1 h-64 bg-[var(--surface-secondary)] animate-pulse rounded-lg" /> : (
            <motion.div className="flex-1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <ReactECharts
                option={buildODOption(odMatrix, REGION_ORDER, { requests: p.colRequests, margin: p.colMarginPct, destination: p.colDestination, origin: p.colOrigin }, ct)}
                style={{ height: 260 }}
                notMerge
              />
            </motion.div>
          )}
          {!loading && (
            <div className="shrink-0 space-y-2 pt-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">{p.marginLegend}</p>
              {odMatrix.slice(0, 6).map((cell) => (
                <div key={`${cell.origin}-${cell.destination}`} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <span className="w-20 text-right text-slate-500">{cell.origin.slice(0, 4)}</span>
                  <span className="text-slate-600">→</span>
                  <span className="w-20">{cell.destination.slice(0, 4)}</span>
                  <span className={`font-semibold ml-auto ${(cell.taux_marge_pct ?? 0) >= 22 ? "text-emerald-400" : "text-amber-400"}`}>
                    {cell.taux_marge_pct?.toFixed(1) ?? "—"}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Top corridors table ── */}
      <SectionCard title={p.sectionCorridors} onInfoClick={() => setActiveInfo(CHART_INFO.corridors)}>
        {loading ? <Skeleton h="h-48" /> : (
          <DataTable columns={corridorCols} data={corridors} />
        )}
      </SectionCard>

      <InfoPanel info={activeInfo} onClose={() => setActiveInfo(null)} />
    </div>
  );
}
