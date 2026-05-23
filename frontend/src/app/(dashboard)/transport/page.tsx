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

type L3 = { fr: string; en: string; ar: string };
interface RawInfoEntry {
  meaning: L3;
  formula?: string;
  source: string[];
  dimensions?: { fr: string[]; en: string[]; ar: string[] };
  updateFreq?: L3;
  calcNotes?: L3;
  warning?: L3;
}

const FREQ: L3 = {
  fr: "Quotidienne — pipeline ETL Dagster (nightly job)",
  en: "Daily — Dagster ETL pipeline (nightly job)",
  ar: "يومياً — خط أنابيب Dagster ETL (مهمة ليلية)",
};

const DIM_BASE = {
  fr: ["Année", "Mois", "Type de service"],
  en: ["Year", "Month", "Service Type"],
  ar: ["السنة", "الشهر", "نوع الخدمة"],
};
const DIM_FULL = {
  fr: ["Année", "Mois", "Type de service", "Agence", "Type de véhicule"],
  en: ["Year", "Month", "Service Type", "Agency", "Vehicle Type"],
  ar: ["السنة", "الشهر", "نوع الخدمة", "الوكالة", "نوع المركبة"],
};
const DIM_VEHICLE = {
  fr: ["Année", "Mois", "Type de service", "Type de véhicule"],
  en: ["Year", "Month", "Service Type", "Vehicle Type"],
  ar: ["السنة", "الشهر", "نوع الخدمة", "نوع المركبة"],
};
const DIM_MONTH_SVC = {
  fr: ["Mois", "Type de service"],
  en: ["Month", "Service Type"],
  ar: ["الشهر", "نوع الخدمة"],
};

const KPI_INFO: Record<string, RawInfoEntry> = {
  totalRequests: {
    meaning: {
      fr: "Nombre total de demandes de transport reçues sur la période, toutes agences et types de service confondus.",
      en: "Total number of transport requests received over the period, across all agencies and service types.",
      ar: "إجمالي عدد طلبات النقل المستلمة خلال الفترة، عبر جميع الوكالات وأنواع الخدمات.",
    },
    formula: "SUM(nbr_requests)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_FULL,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Inclut toutes les demandes (en cours, terminées, annulées). Le groupe TEST (company_id=9) est exclu par contrainte CHECK en base.",
      en: "Includes all requests (in progress, completed, cancelled). The TEST group (company_id=9) is excluded via a CHECK constraint at DB level.",
      ar: "يشمل جميع الطلبات (قيد التنفيذ، مكتملة، ملغاة). مجموعة TEST (company_id=9) مستبعدة بقيد CHECK في قاعدة البيانات.",
    },
  },
  completionRate: {
    meaning: {
      fr: "Part des demandes de transport menées à terme avec succès sur la période sélectionnée.",
      en: "Share of transport requests successfully completed over the selected period.",
      ar: "نسبة طلبات النقل المُكتملة بنجاح خلال الفترة المحددة.",
    },
    formula: "SUM(nbr_terminees) / SUM(nbr_requests) × 100",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Une demande est 'terminée' lorsque toutes ses livraisons sont confirmées et son statut final validé en source.",
      en: "A request is 'completed' when all deliveries are confirmed and the final status is validated at the source system.",
      ar: "يُعدّ الطلب 'مكتملاً' حين تأكيد جميع عمليات التسليم والتحقق من الحالة النهائية في النظام المصدر.",
    },
  },
  cancellationRate: {
    meaning: {
      fr: "Part des demandes annulées sur le total reçu. La tendance est inversée : une baisse du taux s'affiche en vert.",
      en: "Share of cancelled requests out of total received. Trend is inverted: a decrease displays green.",
      ar: "نسبة الطلبات الملغاة من إجمالي المستلمة. الاتجاه معكوس: الانخفاض يظهر باللون الأخضر.",
    },
    formula: "SUM(nbr_annulees) / SUM(nbr_requests) × 100",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Tendance ×(−1) : une réduction du taux d'annulation est un signal positif (vert).",
      en: "Trend ×(−1): a reduction in cancellation rate is a positive signal (green).",
      ar: "الاتجاه ×(−1): انخفاض معدل الإلغاء إشارة إيجابية (أخضر).",
    },
  },
  avgStops: {
    meaning: {
      fr: "Nombre moyen d'arrêts (pickup + livraison) par demande de transport complétée.",
      en: "Average number of stops (pickup + delivery) per completed transport request.",
      ar: "متوسط عدد التوقفات (الاستلام + التسليم) لكل طلب نقل مكتمل.",
    },
    formula: "AVG(nbr_stops_total)\nFILTER: status = 'terminée'",
    source: ["warehouse.fact_transport", "warehouse.dim_date"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Requête directe sur fact_transport — non disponible dans agg_transport_mensuel. Seules les demandes terminées sont incluses.",
      en: "Direct query on fact_transport — not available in agg_transport_mensuel. Only completed requests are included.",
      ar: "استعلام مباشر على fact_transport — غير متاح في agg_transport_mensuel. تُضمَّن الطلبات المكتملة فقط.",
    },
    warning: {
      fr: "Données absentes si aucune demande terminée sur la période sélectionnée.",
      en: "No data if no completed requests exist for the selected period.",
      ar: "لا توجد بيانات إذا لم تكن هناك طلبات مكتملة في الفترة المحددة.",
    },
  },
  totalRevenue: {
    meaning: {
      fr: "Montant total facturé aux clients pour les services de transport sur la période (DZD).",
      en: "Total amount billed to clients for transport services over the period (DZD).",
      ar: "إجمالي المبلغ المُفوتَر للعملاء مقابل خدمات النقل خلال الفترة (دج).",
    },
    formula: "SUM(total_facture_dzd)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Montant facturé, pas nécessairement encaissé. Voir le taux de recouvrement pour les paiements effectifs.",
      en: "Billed amount, not necessarily collected. See the recovery rate for actual payments.",
      ar: "مبلغ مُفوتَر وليس بالضرورة محصَّلاً. راجع معدل التحصيل للمدفوعات الفعلية.",
    },
  },
  grossMargin: {
    meaning: {
      fr: "Part du revenu restante après déduction des coûts directs (carburant, assurance, manutention, distance).",
      en: "Share of revenue remaining after deducting direct costs (fuel, insurance, handling, distance).",
      ar: "حصة الإيرادات المتبقية بعد خصم التكاليف المباشرة (الوقود، التأمين، المناولة، المسافة).",
    },
    formula: "SUM(total_marge_brute_dzd) / SUM(total_facture_dzd) × 100",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Marge brute opérationnelle directe — exclut charges indirectes (loyers, amortissements, administratif).",
      en: "Direct gross operating margin — excludes indirect charges (rent, depreciation, admin).",
      ar: "هامش التشغيل الإجمالي المباشر — يستثني الرسوم غير المباشرة (الإيجار، الاستهلاك، الإدارة).",
    },
  },
  avgCostPerRequest: {
    meaning: {
      fr: "Coût opérationnel moyen engagé par demande de transport complétée (DZD).",
      en: "Average operational cost incurred per completed transport request (DZD).",
      ar: "متوسط التكلفة التشغيلية لكل طلب نقل مكتمل (دج).",
    },
    formula: "SUM(total_cout_dzd) / SUM(nbr_terminees)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Calculé sur les demandes terminées uniquement. Tendance ×(−1) : une baisse s'affiche en vert.",
      en: "Calculated on completed requests only. Trend ×(−1): a decrease displays green.",
      ar: "محسوب على الطلبات المكتملة فقط. الاتجاه ×(−1): الانخفاض يظهر باللون الأخضر.",
    },
  },
  costPerKm: {
    meaning: {
      fr: "Coût opérationnel moyen par kilomètre parcouru — indicateur clé d'efficacité logistique.",
      en: "Average operational cost per kilometre driven — a key logistics efficiency indicator.",
      ar: "متوسط التكلفة التشغيلية لكل كيلومتر مقطوع — مؤشر رئيسي لكفاءة اللوجستيات.",
    },
    formula: "SUM(total_cout_dzd) / SUM(total_km)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_VEHICLE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Inclut carburant, assurance, manutention et frais de distance supplémentaire. Tendance ×(−1) : une baisse s'affiche en vert.",
      en: "Includes fuel, insurance, handling and extra-distance fees. Trend ×(−1): a decrease displays green.",
      ar: "يشمل الوقود والتأمين والمناولة ورسوم المسافة الإضافية. الاتجاه ×(−1): الانخفاض يظهر باللون الأخضر.",
    },
  },
  punctuality: {
    meaning: {
      fr: "Pourcentage de demandes terminées avec arrivée à l'heure ou en avance (délai ≤ 0 min).",
      en: "Percentage of completed requests with on-time or early arrival (delay ≤ 0 min).",
      ar: "نسبة الطلبات المكتملة التي وصلت في الوقت المحدد أو مبكراً (تأخير ≤ 0 دقيقة).",
    },
    formula: "SUM(taux_ponctualite_pct × nbr_terminees) / SUM(nbr_terminees)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Moyenne pondérée par le volume pour éviter les biais des faibles volumes d'agences.",
      en: "Volume-weighted average to avoid bias from low-volume agencies.",
      ar: "متوسط مرجّح بالحجم لتجنب التحيز الناجم عن الوكالات ذات الحجم المنخفض.",
    },
    warning: {
      fr: "Un retard de 1 minute est comptabilisé comme non ponctuel. Seuil strict : arrivée ≤ heure prévue.",
      en: "A 1-minute delay counts as non-punctual. Strict threshold: arrival ≤ scheduled time.",
      ar: "تأخر دقيقة واحدة يُحتسب كعدم انتظام. معيار صارم: الوصول ≤ الوقت المحدد.",
    },
  },
  avgNote: {
    meaning: {
      fr: "Satisfaction client moyenne (1 à 5) collectée après chaque demande terminée.",
      en: "Average customer satisfaction score (1–5) collected after each completed request.",
      ar: "متوسط رضا العملاء (من 1 إلى 5) المُجمَّع بعد كل طلب مكتمل.",
    },
    formula: "SUM(avg_note_client × nbr_terminees) / SUM(nbr_terminees)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Moyenne pondérée par le volume. Les demandes sans note sont exclues.",
      en: "Volume-weighted average. Requests without a rating are excluded.",
      ar: "متوسط مرجّح بالحجم. الطلبات بدون تقييم مستبعدة.",
    },
    warning: {
      fr: "Taux de notation estimé à ~72% — biais de sélection possible si les clients insatisfaits notent moins.",
      en: "Rating rate estimated at ~72% — selection bias possible if dissatisfied clients rate less often.",
      ar: "معدل التقييم المُقدَّر ~72% — تحيز الاختيار محتمل إذا قيّم العملاء غير الراضين بشكل أقل.",
    },
  },
  avgCostPerPiece: {
    meaning: {
      fr: "Coût opérationnel moyen par pièce (colis/article) transportée — indicateur de productivité unitaire.",
      en: "Average operational cost per unit (parcel/item) transported — a unit productivity indicator.",
      ar: "متوسط التكلفة التشغيلية لكل وحدة (طرد/عنصر) منقولة — مؤشر إنتاجية وحدوي.",
    },
    formula: "SUM(total_cout_dzd) / SUM(total_pieces)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Tendance ×(−1) : une baisse du coût unitaire s'affiche en vert.",
      en: "Trend ×(−1): a decrease in unit cost displays green.",
      ar: "الاتجاه ×(−1): انخفاض التكلفة الوحدوية يظهر باللون الأخضر.",
    },
  },
  insuranceRatio: {
    meaning: {
      fr: "Part des coûts d'assurance dans le coût total — indicateur de la structure des charges de risque.",
      en: "Share of insurance costs in the total cost — indicator of risk charge structure.",
      ar: "حصة تكاليف التأمين من إجمالي التكاليف — مؤشر هيكل تكاليف المخاطر.",
    },
    formula: "SUM(cout_assurance) / SUM(total_cout) × 100",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Tendance ×(−1) : une hausse du ratio (risque croissant) s'affiche en rouge.",
      en: "Trend ×(−1): an increase in ratio (growing risk) displays red.",
      ar: "الاتجاه ×(−1): ارتفاع النسبة (خطر متنامٍ) يظهر باللون الأحمر.",
    },
    warning: {
      fr: "Contrainte légale : cout_assurance ≥ 5 000 DZD / demande (CHECK constraint sur fact_transport). Toute demande sous ce seuil est rejetée à l'ingestion ETL.",
      en: "Legal constraint: cout_assurance ≥ 5,000 DZD / request (CHECK constraint on fact_transport). Any request below this threshold is rejected at ETL ingestion.",
      ar: "قيد قانوني: cout_assurance ≥ 5,000 دج / طلب (CHECK constraint على fact_transport). أي طلب أقل من هذا الحد يُرفض عند استيعاب ETL.",
    },
  },
};

const CHART_INFO: Record<string, RawInfoEntry> = {
  revenueCost: {
    meaning: {
      fr: "Comparaison mensuelle du revenu facturé et du coût opérationnel sur les 12 mois de l'année sélectionnée.",
      en: "Monthly comparison of billed revenue and operational cost over the 12 months of the selected year.",
      ar: "مقارنة شهرية بين الإيرادات المُفوتَرة والتكاليف التشغيلية على مدار 12 شهراً من السنة المحددة.",
    },
    formula: "Revenu : SUM(total_facture_dzd)\nCoût   : SUM(total_cout_dzd)\nGROUP BY year, month_num",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
  },
  requestsByStatus: {
    meaning: {
      fr: "Répartition mensuelle des demandes : terminées, en cours, annulées.",
      en: "Monthly breakdown of requests: completed, in progress, cancelled.",
      ar: "التوزيع الشهري للطلبات: مكتملة، قيد التنفيذ، ملغاة.",
    },
    formula: "Terminées : SUM(nbr_terminees)\nEn cours  : SUM(nbr_requests) - SUM(nbr_terminees) - SUM(nbr_annulees)\nAnnulées  : SUM(nbr_annulees)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Les demandes 'en cours' sont calculées par soustraction et incluent aussi les demandes acceptées non encore traitées.",
      en: "'In progress' requests are computed by subtraction and also include accepted requests not yet processed.",
      ar: "الطلبات 'قيد التنفيذ' محسوبة بالطرح وتشمل أيضاً الطلبات المقبولة غير المعالجة بعد.",
    },
  },
  costStructure: {
    meaning: {
      fr: "Répartition des coûts par composante : base, distance supplémentaire, assurance, carburant, manutention, autres.",
      en: "Cost breakdown by component: base, extra distance, insurance, fuel, handling, other.",
      ar: "توزيع التكاليف حسب المكوّن: أساسي، مسافة إضافية، تأمين، وقود، مناولة، أخرى.",
    },
    formula: "SUM(cout_base) + SUM(cout_distance_supp) + SUM(cout_assurance)\n+ SUM(cout_carburant) + SUM(cout_manutention) + cout_autres",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "'Autres' = total_cout − somme des composantes connues (peut inclure ajustements ou frais non catégorisés).",
      en: "'Other' = total_cout − sum of known components (may include adjustments or uncategorised fees).",
      ar: "'أخرى' = total_cout − مجموع المكوّنات المعروفة (قد تشمل تعديلات أو رسوماً غير مصنّفة).",
    },
  },
  punctualityGauge: {
    meaning: {
      fr: "Taux de ponctualité actuel sur la période — visualisation instantanée du niveau de service.",
      en: "Current punctuality rate for the period — instant visualisation of the service level.",
      ar: "معدل الانتظام الحالي للفترة — تصوير فوري لمستوى الخدمة.",
    },
    formula: "SUM(taux_ponctualite_pct × nbr_terminees) / SUM(nbr_terminees)",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Seuils couleur : rouge < 70%, orange 70-85%, vert > 85%.",
      en: "Colour thresholds: red < 70%, amber 70–85%, green > 85%.",
      ar: "عتبات الألوان: أحمر < 70%، برتقالي 70–85%، أخضر > 85%.",
    },
  },
  punctualityTrend: {
    meaning: {
      fr: "Évolution mensuelle du taux de ponctualité — détection de dégradations progressives du niveau de service.",
      en: "Monthly evolution of the punctuality rate — detects progressive degradation of service level.",
      ar: "التطور الشهري لمعدل الانتظام — كشف التدهور التدريجي لمستوى الخدمة.",
    },
    formula: "SUM(taux_ponctualite_pct × nbr_terminees) / SUM(nbr_terminees)\nGROUP BY year, month_num",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_MONTH_SVC,
    updateFreq: FREQ,
  },
  costKmTrend: {
    meaning: {
      fr: "Évolution mensuelle du coût par kilomètre — suivi de l'efficacité logistique dans le temps.",
      en: "Monthly evolution of cost per kilometre — tracks logistics efficiency over time.",
      ar: "التطور الشهري لتكلفة الكيلومتر — تتبع كفاءة اللوجستيات عبر الزمن.",
    },
    formula: "SUM(total_cout_dzd) / SUM(total_km)\nGROUP BY year, month_num",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: DIM_MONTH_SVC,
    updateFreq: FREQ,
  },
  delayDistribution: {
    meaning: {
      fr: "Répartition des demandes terminées par tranche de retard à l'arrivée (5 buckets).",
      en: "Breakdown of completed requests by arrival delay bracket (5 buckets).",
      ar: "توزيع الطلبات المكتملة حسب فترة تأخر الوصول (5 فئات).",
    },
    formula: "COUNT(*) GROUP BY bucket\nBuckets : À l'heure (≤0 min), 1-15 min, 16-30 min, 31-60 min, >60 min",
    source: ["warehouse.fact_transport", "warehouse.dim_date"],
    dimensions: DIM_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Requête directe sur fact_transport (granularité demande). Seules les demandes au statut 'terminée' sont incluses.",
      en: "Direct query on fact_transport (request-level granularity). Only 'completed' status requests are included.",
      ar: "استعلام مباشر على fact_transport (تفصيل على مستوى الطلب). تُضمَّن الطلبات بحالة 'مكتملة' فقط.",
    },
  },
  vehicleEfficiency: {
    meaning: {
      fr: "Comparaison du coût par kilomètre entre catégories de véhicules — aide à l'optimisation de la flotte.",
      en: "Comparison of cost per kilometre across vehicle categories — helps fleet optimisation.",
      ar: "مقارنة تكلفة الكيلومتر عبر فئات المركبات — يساعد في تحسين الأسطول.",
    },
    formula: "SUM(total_cout_dzd) / SUM(total_km)\nGROUP BY vehicle_type, payload_class",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: {
      fr: ["Année", "Mois", "Type de véhicule", "Classe de charge"],
      en: ["Year", "Month", "Vehicle Type", "Payload Class"],
      ar: ["السنة", "الشهر", "نوع المركبة", "فئة الحمولة"],
    },
    updateFreq: FREQ,
  },
  serviceBreakdown: {
    meaning: {
      fr: "Volume, marge, ponctualité et satisfaction par type et sous-type de service.",
      en: "Volume, margin, punctuality and satisfaction by service type and sub-type.",
      ar: "الحجم والهامش والانتظام والرضا حسب نوع الخدمة والنوع الفرعي.",
    },
    formula: "GROUP BY service_type, sub_service_type\nMarge : SUM(marge) / SUM(revenu) × 100",
    source: ["warehouse.agg_transport_mensuel"],
    dimensions: {
      fr: ["Année", "Mois"],
      en: ["Year", "Month"],
      ar: ["السنة", "الشهر"],
    },
    updateFreq: FREQ,
    calcNotes: {
      fr: "Couleurs marge : vert ≥ 24%, orange 20-24%, rouge < 20%. Ponctualité : vert ≥ 90%, orange 80-90%, rouge < 80%.",
      en: "Margin colours: green ≥ 24%, amber 20–24%, red < 20%. Punctuality: green ≥ 90%, amber 80–90%, red < 80%.",
      ar: "ألوان الهامش: أخضر ≥ 24%، برتقالي 20–24%، أحمر < 20%. الانتظام: أخضر ≥ 90%، برتقالي 80–90%، أحمر < 80%.",
    },
  },
  odMatrix: {
    meaning: {
      fr: "Flux de transport entre régions — intensité = volume de demandes, info-bulle = marge.",
      en: "Transport flows between regions — intensity = request volume, tooltip = margin.",
      ar: "تدفقات النقل بين المناطق — الكثافة = حجم الطلبات، تلميح الأداة = الهامش.",
    },
    formula: "SUM(nbr_requests) GROUP BY region_depart, region_arrivee",
    source: ["warehouse.agg_demande_transport"],
    dimensions: {
      fr: ["Année", "Mois", "Région départ", "Région arrivée"],
      en: ["Year", "Month", "Departure Region", "Arrival Region"],
      ar: ["السنة", "الشهر", "منطقة المغادرة", "منطقة الوصول"],
    },
    updateFreq: FREQ,
    calcNotes: {
      fr: "Source différente des autres charts : agg_demande_transport (grain : wilaya × wilaya × service × client).",
      en: "Different source from other charts: agg_demande_transport (grain: wilaya × wilaya × service × client).",
      ar: "مصدر مختلف عن بقية المخططات: agg_demande_transport (تفصيل: ولاية × ولاية × خدمة × عميل).",
    },
    warning: {
      fr: "Des marges uniformes entre régions peuvent refléter une formule de pricing standardisée dans les données source.",
      en: "Uniform margins across regions may reflect a standardised pricing formula in the source data.",
      ar: "قد تعكس الهوامش الموحدة بين المناطق صيغة تسعير موحدة في بيانات المصدر.",
    },
  },
  corridors: {
    meaning: {
      fr: "Classement des paires Origine-Destination par volume, avec marge, distance et coût unitaire.",
      en: "Ranking of Origin-Destination pairs by volume, with margin, distance and unit cost.",
      ar: "ترتيب أزواج المصدر-الوجهة حسب الحجم، مع الهامش والمسافة والتكلفة الوحدوية.",
    },
    formula: "GROUP BY wilaya_depart, wilaya_arrivee\nTrié par SUM(nbr_requests) DESC\nLIMIT 10",
    source: ["warehouse.agg_demande_transport"],
    dimensions: {
      fr: ["Année", "Mois", "Type de service", "Type de client"],
      en: ["Year", "Month", "Service Type", "Client Type"],
      ar: ["السنة", "الشهر", "نوع الخدمة", "نوع العميل"],
    },
    updateFreq: FREQ,
    calcNotes: {
      fr: "Relation : Revenu ≈ Demandes × Dist_moy × DZD/km. Les 10 premiers corridors sont affichés.",
      en: "Relation: Revenue ≈ Requests × Avg_dist × DZD/km. Top 10 corridors are displayed.",
      ar: "علاقة: الإيرادات ≈ الطلبات × المتوسط_المسافة × دج/كم. أفضل 10 ممرات معروضة.",
    },
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

  const { t, locale } = useTranslation();
  const p = t.pages.transport;
  const pc = t.pages.common;

  const resolveInfo = (raw: RawInfoEntry, title: string): KpiInfo => ({
    title,
    meaning: raw.meaning[locale],
    formula: raw.formula,
    source: raw.source,
    dimensions: raw.dimensions?.[locale],
    updateFreq: raw.updateFreq?.[locale],
    calcNotes: raw.calcNotes?.[locale],
    warning: raw.warning?.[locale],
  });
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
        <KpiCard title={p.kpiTotalRequests}    value={formatNumber(cur.total_requests)}                 trend={d.mom_requests}          trendLabel={trendLabel} icon={<Truck size={16} />}        index={0}  onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.totalRequests, p.kpiTotalRequests))} />
        <KpiCard title={p.kpiCompletionRate}   value={formatPercent(d.completion_rate)}                 trend={d.mom_completion_rate}   trendLabel={trendLabel} icon={<PackageCheck size={16} />}  index={1}  onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.completionRate, p.kpiCompletionRate))} />
        <KpiCard title={p.kpiCancellationRate} value={formatPercent(d.cancellation_rate)}               trend={d.mom_cancellation_rate} trendLabel={trendLabel} icon={<Ban size={16} />}           index={2}  onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.cancellationRate, p.kpiCancellationRate))} />
        <KpiCard title={p.kpiAvgStops}         value={cur.avg_arrets_par_demande?.toFixed(1) ?? "—"}   trend={d.mom_avg_arrets}        trendLabel={trendLabel} icon={<Route size={16} />}         index={3}  onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.avgStops, p.kpiAvgStops))} />
      </div>

      {/* ── Revenue & Cost Efficiency ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title={p.kpiTotalRevenue}      value={formatDZD(cur.total_revenue)}          trend={d.mom_revenue}              trendLabel={trendLabel} icon={<DollarSign size={16} />} index={4}  onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.totalRevenue, p.kpiTotalRevenue))} />
        <KpiCard title={p.kpiGrossMargin}       value={formatPercent(d.gross_margin_pct)}     trend={d.mom_margin}               trendLabel={trendLabel} icon={<TrendingUp size={16} />} index={5}  onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.grossMargin, p.kpiGrossMargin))} />
        <KpiCard title={p.kpiAvgCostPerRequest} value={formatDZD(cur.avg_cout_par_demande)}  trend={d.mom_avg_cout_par_demande} trendLabel={trendLabel} icon={<DollarSign size={16} />} index={6}  onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.avgCostPerRequest, p.kpiAvgCostPerRequest))} />
        <KpiCard title={p.kpiCostPerKm}         value={`${d.cost_per_km} DZD`}               trend={d.mom_cost_per_km}          trendLabel={trendLabel} icon={<Route size={16} />}      index={7}  onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.costPerKm, p.kpiCostPerKm))} />
      </div>

      {/* ── Quality & Cost Structure ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title={p.kpiPunctuality}     value={formatPercent(cur.avg_ponctualite_pct)}  trend={d.mom_on_time}            trendLabel={trendLabel} icon={<Gauge size={16} />}       index={8}  onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.punctuality, p.kpiPunctuality))} />
        <KpiCard title={p.kpiAvgNote}         value={cur.avg_note_client?.toFixed(1) ?? "—"}  trend={d.mom_avg_note}           trendLabel={trendLabel} icon={<Star size={16} />}        index={9}  onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.avgNote, p.kpiAvgNote))} />
        <KpiCard title={p.kpiAvgCostPerPiece} value={formatDZD(cur.avg_cout_par_piece)}       trend={d.mom_avg_cout_par_piece} trendLabel={trendLabel} icon={<DollarSign size={16} />}  index={10} onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.avgCostPerPiece, p.kpiAvgCostPerPiece))} />
        <KpiCard title={p.kpiInsuranceRatio}  value={formatPercent(insuranceRatio)}           trend={d.mom_insurance_ratio}    trendLabel={trendLabel} icon={<TrendingUp size={16} />}  index={11} onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.insuranceRatio, p.kpiInsuranceRatio))} />
      </div>

      {/* ── Trends: Revenue vs Cost + Requests by Status ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionRevenueCost} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.revenueCost, p.sectionRevenueCost))}>
          {loading ? <Skeleton /> : <AreaChart data={areaData} height={280} />}
        </SectionCard>
        <SectionCard title={p.sectionRequestsByStatus} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.requestsByStatus, p.sectionRequestsByStatus))}>
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
        <SectionCard title={p.sectionCostStructure} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.costStructure, p.sectionCostStructure))}>
          {loading ? <Skeleton /> : <PieChart data={costDonutData} height={280} />}
        </SectionCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionCard title={p.sectionCurrentPunctuality} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.punctualityGauge, p.sectionCurrentPunctuality))}>
            {loading ? <Skeleton h="h-full" /> : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
                <ReactECharts option={buildOnTimeGaugeOption(cur.avg_ponctualite_pct, p.kpiPunctuality, ct)} style={{ height: 220 }} notMerge />
              </motion.div>
            )}
          </SectionCard>
          <SectionCard title={p.sectionPunctualityTrend} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.punctualityTrend, p.sectionPunctualityTrend))}>
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
        <SectionCard title={p.sectionCostKmTrend} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.costKmTrend, p.sectionCostKmTrend))}>
          {loading ? <Skeleton /> : (
            <LineChart
              categories={costKmTrend.categories}
              series={costKmTrend.series}
              height={260}
              yFormatter={(v) => `${v} DZD`}
            />
          )}
        </SectionCard>
        <SectionCard title={p.sectionDelayDistribution} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.delayDistribution, p.sectionDelayDistribution))}>
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
        <SectionCard title={p.sectionVehicleEfficiency} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.vehicleEfficiency, p.sectionVehicleEfficiency))}>
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
        <SectionCard title={p.sectionServiceBreakdown} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.serviceBreakdown, p.sectionServiceBreakdown))}>
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
      <SectionCard title={p.sectionODMatrix} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.odMatrix, p.sectionODMatrix))}>
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
      <SectionCard title={p.sectionCorridors} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.corridors, p.sectionCorridors))}>
        {loading ? <Skeleton h="h-48" /> : (
          <DataTable columns={corridorCols} data={corridors} />
        )}
      </SectionCard>

      <InfoPanel info={activeInfo} onClose={() => setActiveInfo(null)} />
    </div>
  );
}
