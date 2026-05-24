"use client";

import { useEffect, useState, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import { motion } from "framer-motion";
import {
  Package, TrendingDown, DollarSign, AlertTriangle, ChevronDown,
  BarChart2, Truck, Users, ChevronLeft, ChevronRight, Info,
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
  ParcelDeliveryTypeData,
  DailyVolumePoint,
  DurationBucket,
  SinistresData,
  FreelanceEfficiencyItem,
  ParcelsPaginatedResponse,
} from "@/types/parcel_costs";

// ─── Constants ────────────────────────────────────────────────────────────────

const YEARS = [2023, 2024, 2025];
// MONTHS and DELIVERY_TYPES are built inside the component from translations

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

const DIM_PARCEL_BASE = {
  fr: ["Année", "Mois", "Type de livraison (HD/SD)"],
  en: ["Year", "Month", "Delivery Type (HD/SD)"],
  ar: ["السنة", "الشهر", "نوع التسليم (HD/SD)"],
};
const DIM_PARCEL_AGENCY = {
  fr: ["Année", "Mois", "Type de livraison", "Agence"],
  en: ["Year", "Month", "Delivery Type", "Agency"],
  ar: ["السنة", "الشهر", "نوع التسليم", "الوكالة"],
};
const DIM_MONTH_ONLY = {
  fr: ["Année", "Mois"],
  en: ["Year", "Month"],
  ar: ["السنة", "الشهر"],
};

const KPI_INFO: Record<string, RawInfoEntry> = {
  kpiParcels: {
    meaning: {
      fr: "Nombre total de colis pris en charge sur la période — toutes agences et tous types de livraison confondus.",
      en: "Total number of parcels handled over the period — across all agencies and delivery types.",
      ar: "إجمالي عدد الطرود المعالجة خلال الفترة — عبر جميع الوكالات وأنواع التسليم.",
    },
    formula: "SUM(nbr_colis_total)",
    source: ["warehouse.agg_profitabilite_colis"],
    dimensions: DIM_PARCEL_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Inclut tous les colis quel que soit leur statut final (livrés, retournés, en cours). Le groupe TEST (company_id=9) est exclu.",
      en: "Includes all parcels regardless of final status (delivered, returned, in progress). The TEST group (company_id=9) is excluded.",
      ar: "يشمل جميع الطرود بصرف النظر عن حالتها النهائية (مُسلَّمة، مُرتجَعة، قيد التنفيذ). مجموعة TEST (company_id=9) مستبعدة.",
    },
  },
  kpiDeliveryRate: {
    meaning: {
      fr: "Proportion de colis effectivement livrés parmi tous les colis pris en charge sur la période.",
      en: "Share of parcels successfully delivered out of all parcels handled over the period.",
      ar: "نسبة الطرود المُسلَّمة فعلياً من إجمالي الطرود المعالجة خلال الفترة.",
    },
    formula: "SUM(nbr_livres) / SUM(nbr_colis_total) × 100",
    source: ["warehouse.agg_profitabilite_colis"],
    dimensions: DIM_PARCEL_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Les colis en cours de livraison (non encore finalisés) pèsent sur le taux. Filtrez sur un mois terminé pour une mesure plus précise.",
      en: "Parcels still in transit (not yet finalised) pull the rate down. Filter on a completed month for a more accurate reading.",
      ar: "الطرود لا تزال في العبور (غير منتهية بعد) تُخفّض المعدل. اختر شهراً مكتملاً للحصول على قياس أدق.",
    },
  },
  kpiFeesCollected: {
    meaning: {
      fr: "Total des frais de livraison facturés aux expéditeurs et collectés auprès des destinataires sur la période.",
      en: "Total delivery fees billed to shippers and collected from recipients over the period.",
      ar: "إجمالي رسوم التسليم المفوترة للمرسِلين والمحصَّلة من المستلمين خلال الفترة.",
    },
    formula: "SUM(total_fees_dzd)",
    source: ["warehouse.agg_profitabilite_colis"],
    dimensions: DIM_PARCEL_BASE,
    updateFreq: FREQ,
  },
  kpiTotalCost: {
    meaning: {
      fr: "Coût opérationnel total incluant les salaires du personnel, les dépenses de fonctionnement, les paiements aux livreurs freelance et les remboursements sinistres.",
      en: "Total operational cost including staff salaries, operating expenses, freelance driver payments, and claims refunds.",
      ar: "إجمالي التكلفة التشغيلية تشمل رواتب الموظفين والمصروفات التشغيلية ومدفوعات السائقين المستقلين وتعويضات الحوادث.",
    },
    formula: "total_salaires + total_depenses + total_freelance + total_sinistres",
    source: ["warehouse.agg_depenses_mensuelles", "warehouse.agg_cout_total_mensuel", "warehouse.fact_sinistres"],
    dimensions: DIM_MONTH_ONLY,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Coût construit par agrégation de 3 sources distinctes. Non filtrable par type de livraison — s'applique à toute l'activité colis de la période.",
      en: "Cost is built by aggregating 3 distinct sources. Not filterable by delivery type — applies to the entire parcel activity of the period.",
      ar: "يُبنى التكلفة بتجميع 3 مصادر مختلفة. غير قابلة للتصفية حسب نوع التسليم — تُطبَّق على كامل نشاط الطرود خلال الفترة.",
    },
  },
  kpiUnderTariff: {
    meaning: {
      fr: "Part des colis (avec tarif théorique connu) dont le frais de livraison réel est inférieur au tarif théorique — indicateur clé PCC (Parcel Cost Control).",
      en: "Share of parcels (with known theoretical tariff) where the actual delivery fee is below the theoretical tariff — key PCC (Parcel Cost Control) indicator.",
      ar: "نسبة الطرود (ذات التعريفة النظرية المعروفة) التي تكون فيها رسوم التسليم الفعلية أقل من التعريفة النظرية — مؤشر PCC الرئيسي.",
    },
    formula: "SUM(nbr_sous_tarif) / SUM(nbr_avec_tarif) × 100\nOù ecart_tarif_dzd = delivery_fee − tarif_theorique < 0",
    source: ["warehouse.agg_profitabilite_colis"],
    dimensions: DIM_PARCEL_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Seuls les colis avec tarif_theorique renseigné (non NULL) entrent au dénominateur. Les colis sans tarif ne sont ni comptés comme conformes ni sous-tarif.",
      en: "Only parcels with a known tarif_theorique (non-NULL) are in the denominator. Parcels without a tariff are counted as neither compliant nor under-tariff.",
      ar: "فقط الطرود ذات tarif_theorique معروف (غير NULL) تدخل في المقام. الطرود بدون تعريفة لا تُحتسب لا امتثالاً ولا دون-تعريفة.",
    },
    warning: {
      fr: "Un taux élevé peut signaler une erreur de saisie tarifaire, un accord client non mis à jour, ou des livraisons à prix préférentiel non documentées.",
      en: "A high rate may signal a tariff data entry error, an outdated client agreement, or undocumented preferential-rate deliveries.",
      ar: "قد يُشير المعدل المرتفع إلى خطأ في إدخال بيانات التعريفة، أو اتفاقية عميل غير محدَّثة، أو توصيلات بأسعار تفضيلية غير موثَّقة.",
    },
  },
  kpiAvgFee: {
    meaning: {
      fr: "Frais de livraison moyen collecté par colis sur la période — indicateur de revenus unitaires.",
      en: "Average delivery fee collected per parcel over the period — unit revenue indicator.",
      ar: "متوسط رسوم التسليم المحصَّلة لكل طرد خلال الفترة — مؤشر الإيرادات الوحدوية.",
    },
    formula: "SUM(total_fees_dzd) / SUM(nbr_colis_total)",
    source: ["warehouse.agg_profitabilite_colis"],
    dimensions: DIM_PARCEL_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Moyenne pondérée par les volumes réels — corrige l'artefact statistique d'une simple moyenne de moyennes.",
      en: "Volume-weighted average — corrects the statistical artefact of a simple average of averages.",
      ar: "متوسط مرجَّح بالحجوم الفعلية — يصحح الخطأ الإحصائي لمتوسط المتوسطات البسيط.",
    },
  },
  kpiCostPerDelivery: {
    meaning: {
      fr: "Coût opérationnel total rapporté au nombre de colis effectivement livrés — mesure la rentabilité réelle de chaque livraison.",
      en: "Total operational cost divided by the number of parcels actually delivered — measures the real profitability of each delivery.",
      ar: "إجمالي التكلفة التشغيلية مقسوماً على عدد الطرود المُسلَّمة فعلياً — يقيس الربحية الحقيقية لكل عملية تسليم.",
    },
    formula: "cout_total / SUM(nbr_livres)",
    source: ["warehouse.agg_cout_total_mensuel", "warehouse.agg_profitabilite_colis"],
    dimensions: DIM_MONTH_ONLY,
    updateFreq: FREQ,
    warning: {
      fr: "Si le coût/colis dépasse significativement le frais moyen, l'opération colis génère une perte nette.",
      en: "If cost/parcel significantly exceeds the average fee, the parcel operation generates a net loss.",
      ar: "إذا تجاوزت التكلفة/الطرد الرسوم المتوسطة بشكل ملحوظ، فإن عملية الطرود تُولِّد خسارة صافية.",
    },
  },
  kpiCompliance: {
    meaning: {
      fr: "Taux de conformité tarifaire — proportion de colis (avec tarif théorique connu) dont la facturation est égale ou supérieure au tarif théorique.",
      en: "Tariff compliance rate — share of parcels (with known theoretical tariff) billed at or above the theoretical tariff.",
      ar: "معدل الامتثال التعريفي — نسبة الطرود (ذات التعريفة النظرية المعروفة) المفوترة بالتعريفة النظرية أو أعلى منها.",
    },
    formula: "100 − taux_sous_tarif_pct\n= SUM(nbr_avec_tarif − nbr_sous_tarif) / SUM(nbr_avec_tarif) × 100",
    source: ["warehouse.agg_profitabilite_colis"],
    dimensions: DIM_PARCEL_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "Complément arithmétique du taux sous-tarif. Objectif interne recommandé : ≥ 75%. En dessous de 60% : alerte critique PCC.",
      en: "Arithmetic complement of the under-tariff rate. Recommended internal target: ≥ 75%. Below 60%: critical PCC alert.",
      ar: "المكمل الحسابي لمعدل ما دون التعريفة. الهدف الداخلي الموصى به: ≥ 75%. أقل من 60%: تنبيه PCC حرج.",
    },
  },
};

const CHART_INFO: Record<string, RawInfoEntry> = {
  sectionFeesVsCost: {
    meaning: {
      fr: "Évolution mensuelle des frais collectés (revenus) face au coût opérationnel total — permet de visualiser la rentabilité de l'activité colis dans le temps.",
      en: "Monthly trend of fees collected (revenue) against total operational cost — visualises the profitability of the parcel activity over time.",
      ar: "الاتجاه الشهري للرسوم المحصَّلة (الإيرادات) مقابل إجمالي التكلفة التشغيلية — يُصوِّر ربحية نشاط الطرود عبر الزمن.",
    },
    formula: "Frais : SUM(total_fees_dzd) par mois\nCoût : total_salaires + total_depenses + total_freelance + total_sinistres",
    source: ["warehouse.agg_profitabilite_colis", "warehouse.agg_cout_total_mensuel"],
    dimensions: { fr: ["Année"], en: ["Year"], ar: ["السنة"] },
    updateFreq: FREQ,
    warning: {
      fr: "En données mock, les frais peuvent paraître très faibles face aux coûts (volume simulé ~500 colis/jour vs ~12 000 en réel). Ce rapport sera juste avec des données réelles.",
      en: "In mock data, fees may appear very low compared to costs (simulated volume ~500 parcels/day vs ~12,000 in real). This ratio will be correct with real data.",
      ar: "في البيانات التجريبية، قد تبدو الرسوم منخفضة جداً مقارنة بالتكاليف (حجم محاكى ~500 طرد/يوم مقابل ~12,000 في الواقع). ستكون هذه النسبة صحيحة مع البيانات الحقيقية.",
    },
  },
  sectionDeliveryVsCompliance: {
    meaning: {
      fr: "Double tendance mensuelle : taux de livraison (courbe verte) et taux sous-tarif PCC (courbe rouge) — identifie les mois où la performance opérationnelle et la conformité tarifaire évoluent dans des directions opposées.",
      en: "Dual monthly trend: delivery rate (green line) and PCC under-tariff rate (red line) — identifies months where operational performance and tariff compliance move in opposite directions.",
      ar: "اتجاه شهري مزدوج: معدل التسليم (الخط الأخضر) ومعدل ما دون التعريفة PCC (الخط الأحمر) — يحدد الأشهر التي يتحركان فيها في اتجاهين متعاكسين.",
    },
    formula: "Livraison : SUM(nbr_livres) / SUM(nbr_colis_total) × 100\nSous-tarif : SUM(nbr_sous_tarif) / SUM(nbr_avec_tarif) × 100",
    source: ["warehouse.agg_profitabilite_colis"],
    dimensions: { fr: ["Année"], en: ["Year"], ar: ["السنة"] },
    updateFreq: FREQ,
  },
  sectionEcartDistribution: {
    meaning: {
      fr: "Histogramme de la distribution des écarts tarifaires sur le mois sélectionné — chaque barre représente un intervalle d'écart (delivery_fee − tarif_theorique) en DZD.",
      en: "Histogram of tariff gap distribution for the selected month — each bar represents a gap bracket (delivery_fee − tarif_theorique) in DZD.",
      ar: "مخطط توزيع فجوات التعريفة للشهر المحدد — كل شريط يمثل نطاق فجوة (delivery_fee − tarif_theorique) بالدينار.",
    },
    formula: "ecart_tarif_dzd = delivery_fee − tarif_theorique\nCOUNT(*) GROUP BY ecart_bucket",
    source: ["warehouse.fact_colis", "warehouse.dim_date"],
    dimensions: { fr: ["Mois sélectionné"], en: ["Selected Month"], ar: ["الشهر المحدد"] },
    updateFreq: FREQ,
    calcNotes: {
      fr: "Disponible uniquement lorsqu'un mois est sélectionné. Barres rouges = sous-tarif (pertes), barres vertes = sur-tarif (conformes).",
      en: "Available only when a month is selected. Red bars = under-tariff (losses), green bars = over-tariff (compliant).",
      ar: "متاح فقط عند اختيار شهر. الأشرطة الحمراء = دون التعريفة (خسائر)، الأشرطة الخضراء = فوق التعريفة (مطابقة).",
    },
  },
  sectionPCCSummary: {
    meaning: {
      fr: "Tableau de bord résumé PCC (Parcel Cost Control) — consolide les 4 métriques clés de conformité tarifaire sur la période.",
      en: "PCC (Parcel Cost Control) summary dashboard — consolidates the 4 key tariff compliance metrics over the period.",
      ar: "لوحة ملخص PCC (مراقبة تكاليف الطرود) — تجمع 4 مقاييس امتثال تعريفية رئيسية خلال الفترة.",
    },
    formula: "Avec tarif : COUNT(tarif_theorique IS NOT NULL)\nSous-tarif : COUNT(ecart_tarif_dzd < 0)\nÉcart total : SUM(ecart_tarif_dzd WHERE < 0)\nÉcart moy : SUM(total_ecart_dzd) / SUM(nbr_avec_tarif)",
    source: ["warehouse.agg_profitabilite_colis"],
    dimensions: DIM_PARCEL_BASE,
    updateFreq: FREQ,
    calcNotes: {
      fr: "L'écart moyen est calculé en pondérant par les volumes agence × mois — pas comme une simple moyenne des moyennes.",
      en: "The average gap is volume-weighted across agency × month rows — not a simple average of averages.",
      ar: "يُحسب متوسط الفجوة مرجَّحاً بالحجوم عبر صفوف الوكالة × الشهر — وليس متوسطاً بسيطاً.",
    },
  },
  sectionAgencyRanking: {
    meaning: {
      fr: "Classement des 5 agences ayant le plus fort taux sous-tarif PCC (pires en premier) sur la période — aide à cibler les agences nécessitant une revue tarifaire.",
      en: "Ranking of the 5 agencies with the highest under-tariff PCC rate (worst first) over the period — helps target agencies needing a tariff review.",
      ar: "ترتيب أسوأ 5 وكالات من حيث معدل ما دون التعريفة PCC (الأسوأ أولاً) خلال الفترة — يساعد في استهداف الوكالات التي تحتاج إلى مراجعة تعريفية.",
    },
    formula: "GROUP BY agence\nSUM(nbr_sous_tarif) / SUM(nbr_avec_tarif) × 100\nORDER BY taux_sous_tarif_pct DESC\nLIMIT 5",
    source: ["warehouse.agg_profitabilite_colis"],
    dimensions: DIM_PARCEL_AGENCY,
    updateFreq: FREQ,
    calcNotes: {
      fr: "L'écart moyen par agence est pondéré par le volume agence × mois — évite la distorsion des petits volumes.",
      en: "Average gap per agency is volume-weighted across agency × month — avoids small-volume distortion.",
      ar: "متوسط الفجوة لكل وكالة مرجَّح بحجم الوكالة × الشهر — يتجنب تشويه الأحجام الصغيرة.",
    },
  },
  sectionCostStructure: {
    meaning: {
      fr: "Répartition en donut du coût opérationnel total entre ses 4 grandes composantes : Salaires, Dépenses de fonctionnement, Freelance et Sinistres.",
      en: "Donut breakdown of total operational cost into its 4 main components: Salaries, Operating Expenses, Freelance, and Claims.",
      ar: "تقسيم الدائرة التفصيلية لإجمالي التكلفة التشغيلية إلى 4 مكونات رئيسية: الرواتب، المصروفات التشغيلية، المستقلون، والحوادث.",
    },
    formula: "Salaires : SUM(total_salaires)\nDépenses : SUM(total_depenses)\nFreelance : SUM(total_freelance)\nSinistres : SUM(sum_rembourse_dzd)",
    source: ["warehouse.agg_depenses_mensuelles", "warehouse.agg_cout_total_mensuel", "warehouse.fact_sinistres"],
    dimensions: DIM_MONTH_ONLY,
    updateFreq: FREQ,
  },
  sectionCostByNature: {
    meaning: {
      fr: "Détail des dépenses de fonctionnement par nature comptable (carburant, loyers, fournitures…) — identifie les postes les plus impactants.",
      en: "Breakdown of operating expenses by accounting category (fuel, rent, supplies…) — identifies the most impactful cost items.",
      ar: "تفصيل مصروفات التشغيل حسب الفئة المحاسبية (وقود، إيجارات، مستلزمات…) — يحدد بنود التكلفة الأكثر تأثيراً.",
    },
    formula: "SUM(total_dzd) GROUP BY nature_depense\nORDER BY total_dzd DESC",
    source: ["warehouse.agg_depenses_mensuelles"],
    dimensions: DIM_MONTH_ONLY,
    updateFreq: FREQ,
  },
  sectionHDvsSD: {
    meaning: {
      fr: "Comparaison des deux types de livraison — HD (livraison à domicile) et SD (Stop Desk, retrait en agence) — sur les 4 métriques clés.",
      en: "Comparison of the two delivery types — HD (Home Delivery) and SD (Stop Desk, agency pickup) — on 4 key metrics.",
      ar: "مقارنة نوعَي التسليم — HD (التوصيل المنزلي) و SD (Stop Desk، الاستلام من الوكالة) — على 4 مقاييس رئيسية.",
    },
    formula: "GROUP BY delivery_type\nTaux livraison, frais moy, durée moy, taux retour",
    source: ["warehouse.agg_profitabilite_colis"],
    dimensions: DIM_MONTH_ONLY,
    updateFreq: FREQ,
    calcNotes: {
      fr: "SD présente généralement un taux de livraison plus élevé car le destinataire se déplace lui-même en agence. HD est plus exposé aux retours.",
      en: "SD typically shows a higher delivery rate since the recipient comes to collect at the agency. HD is more exposed to returns.",
      ar: "يُظهر SD عادةً معدل تسليم أعلى لأن المستلِم يتوجه بنفسه للوكالة. HD أكثر تعرضاً للإرجاعات.",
    },
  },
  sectionDailyVolume: {
    meaning: {
      fr: "Volume quotidien de colis livrés et retournés sur le mois sélectionné — visualise les pics d'activité et les effets calendaires (vendredis, week-ends).",
      en: "Daily volume of delivered and returned parcels for the selected month — visualises activity peaks and calendar effects (Fridays, weekends).",
      ar: "الحجم اليومي للطرود المُسلَّمة والمُرتجَعة للشهر المحدد — يُصوِّر ذروات النشاط والتأثيرات التقويمية (الجمعة، نهاية الأسبوع).",
    },
    formula: "SUM(nbr_livres), SUM(nbr_retours)\nGROUP BY full_date",
    source: ["warehouse.agg_livraisons_journalieres"],
    dimensions: { fr: ["Mois sélectionné"], en: ["Selected Month"], ar: ["الشهر المحدد"] },
    updateFreq: FREQ,
    calcNotes: {
      fr: "Couleur cyan = vendredi (activité réduite). Gris = samedi (activité très réduite). La couleur des barres 'Livrés' reflète le type de jour.",
      en: "Cyan = Friday (reduced activity). Grey = Saturday (very low activity). The 'Delivered' bar colour reflects the day type.",
      ar: "سماوي = الجمعة (نشاط منخفض). رمادي = السبت (نشاط منخفض جداً). لون شريط 'المُسلَّمة' يعكس نوع اليوم.",
    },
  },
  sectionDurationDistribution: {
    meaning: {
      fr: "Répartition des colis livrés par tranche de durée de livraison (de la prise en charge à la livraison effective) — mesure la performance opérationnelle.",
      en: "Breakdown of delivered parcels by delivery duration bracket (from pickup to actual delivery) — measures operational performance.",
      ar: "توزيع الطرود المُسلَّمة حسب فترة مدة التسليم (من الاستلام إلى التسليم الفعلي) — يقيس الأداء التشغيلي.",
    },
    formula: "duree_livraison_minutes = date_livraison − date_prise_en_charge\nCOUNT(*) GROUP BY tranche_heure",
    source: ["warehouse.fact_colis", "warehouse.dim_date"],
    dimensions: { fr: ["Mois sélectionné", "Type de livraison (HD/SD)"], en: ["Selected Month", "Delivery Type (HD/SD)"], ar: ["الشهر المحدد", "نوع التسليم (HD/SD)"] },
    updateFreq: FREQ,
    calcNotes: {
      fr: "Disponible uniquement lorsqu'un mois est sélectionné. Seuls les colis au statut 'Livré' sont inclus.",
      en: "Available only when a month is selected. Only parcels with status 'Delivered' are included.",
      ar: "متاح فقط عند اختيار شهر. تُضمَّن فقط الطرود بحالة 'مُسلَّمة'.",
    },
  },
  sectionSinistresType: {
    meaning: {
      fr: "Répartition des sinistres déclarés par type (perte, vol, détérioration, retard…) — identifie les risques dominants.",
      en: "Breakdown of declared claims by type (loss, theft, damage, delay…) — identifies dominant risks.",
      ar: "توزيع الحوادث المُبلَّغ عنها حسب النوع (فقدان، سرقة، تلف، تأخير…) — يحدد المخاطر السائدة.",
    },
    formula: "COUNT(*) GROUP BY sinistre_type",
    source: ["warehouse.fact_sinistres"],
    dimensions: DIM_MONTH_ONLY,
    updateFreq: FREQ,
  },
  sectionSinistresKPI: {
    meaning: {
      fr: "KPIs résumés des sinistres : nombre déclaré, montant déclaré, montant remboursé, taux de couverture et remboursement moyen.",
      en: "Summary KPIs for claims: number declared, amount declared, amount refunded, coverage rate and average refund.",
      ar: "مؤشرات ملخصة للحوادث: العدد المُعلَن، المبلغ المُعلَن، المبلغ المُسترد، معدل التغطية ومتوسط التعويض.",
    },
    formula: "nbr_sinistres : COUNT(*)\nsum_declared_dzd : SUM(montant_declare_dzd)\nsum_rembourse_dzd : SUM(montant_rembourse_dzd)\ntaux_couverture : SUM(rembourse) / SUM(declare) × 100",
    source: ["warehouse.fact_sinistres"],
    dimensions: DIM_MONTH_ONLY,
    updateFreq: FREQ,
  },
  sectionFreelance: {
    meaning: {
      fr: "Résumé opérationnel des livreurs freelance : effectif actif, colis livrés, coût moyen par colis et paiements totaux versés.",
      en: "Operational summary of freelance drivers: active headcount, parcels delivered, average cost per parcel and total payments made.",
      ar: "ملخص تشغيلي للسائقين المستقلين: العدد النشط، الطرود المُسلَّمة، متوسط التكلفة لكل طرد وإجمالي المدفوعات.",
    },
    formula: "nbr_livreurs : COUNT(DISTINCT livreur_id)\nnbr_colis_livres : SUM(nbr_colis_livres)\ntotal_paiements_dzd : SUM(total_paiements_dzd)\ncout_moyen : SUM(paiements) / SUM(colis_livres)",
    source: ["warehouse.agg_cout_total_mensuel"],
    dimensions: DIM_MONTH_ONLY,
    updateFreq: FREQ,
  },
  sectionParcelDetail: {
    meaning: {
      fr: "Table paginée des colis individuels du mois sélectionné avec tracking, statut, frais réels, tarif théorique et écart calculé.",
      en: "Paginated table of individual parcels for the selected month with tracking, status, actual fees, theoretical tariff and calculated gap.",
      ar: "جدول مُقسَّم صفحياً للطرود الفردية للشهر المحدد مع التتبع والحالة والرسوم الفعلية والتعريفة النظرية والفجوة المحسوبة.",
    },
    formula: "SELECT * FROM fact_colis\nWHERE year=? AND month=? AND delivery_type=?\nORDER BY ecart_tarif_dzd ASC",
    source: ["warehouse.fact_colis", "warehouse.dim_agence", "warehouse.dim_date"],
    dimensions: { fr: ["Mois sélectionné", "Type de livraison"], en: ["Selected Month", "Delivery Type"], ar: ["الشهر المحدد", "نوع التسليم"] },
    updateFreq: FREQ,
    calcNotes: {
      fr: "Disponible uniquement lorsqu'un mois est sélectionné. Données paginées (20 lignes/page). Triées par écart croissant (pires cas en premier).",
      en: "Available only when a month is selected. Paginated data (20 rows/page). Sorted by ascending gap (worst cases first).",
      ar: "متاح فقط عند اختيار شهر. بيانات مُقسَّمة صفحياً (20 صفاً/صفحة). مرتبة حسب الفجوة تصاعدياً (أسوأ الحالات أولاً).",
    },
  },
};

// ─── Chart theme type ─────────────────────────────────────────────────────────

interface CT {
  tooltip: { backgroundColor: string; borderColor: string; textStyle: { color: string; fontSize: number } }
  splitLine: { lineStyle: { color: string; type: "dashed" } }
  axisLabel: { color: string; fontSize: number }
  axisColor: string; legendColor: string; labelColor: string; textColor: string; surface: string; bgColor: string;
}

// ─── Page state ───────────────────────────────────────────────────────────────

interface PageData {
  summary:       ParcelCostsSummaryData;
  trends:        ParcelCostsTrendPoint[];
  pccSummary:    ParcelPCCSummary;
  pccByAgency:   ParcelPCCAgency[];
  costStructure: CostStructureData;
  costByNature:  CostByNatureItem[];
  byDeliveryType:ParcelDeliveryTypeData[];
  dailyVolume:   DailyVolumePoint[];
  sinistres:     SinistresData;
  freelance:     FreelanceEfficiencyItem[];
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

// ─── Chart builders ───────────────────────────────────────────────────────────

function buildDailyVolumeOption(daily: DailyVolumePoint[], seriesNames: { delivered: string; returns: string }, ct: CT) {
  const cats = daily.map((d) => d.full_date.slice(5));
  return {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis" as const,
      ...ct.tooltip,
      axisPointer: { type: "shadow" as const },
      formatter: (params: { name: string; data: number; seriesName: string }[]) => {
        const day = daily.find((d) => d.full_date.slice(5) === params[0]?.name);
        const label = day ? ` (${day.day_of_week})` : "";
        return params.map((p) => `${p.seriesName}: ${p.data}`).join("<br/>") + `<br/>${params[0]?.name}${label}`;
      },
    },
    legend: { top: 0, right: 0, textStyle: { color: ct.legendColor, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
    grid: { left: 16, right: 16, top: 36, bottom: 0, containLabel: true },
    xAxis: {
      type: "category" as const,
      data: cats,
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisTick: { show: false },
      axisLabel: { ...ct.axisLabel, rotate: 40, interval: 4 },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      splitLine: ct.splitLine,
      axisLabel: ct.axisLabel,
    },
    series: [
      {
        name: seriesNames.delivered,
        type: "bar" as const,
        stack: "s",
        data: daily.map((d) => ({
          value: d.nbr_livres,
          itemStyle: { color: d.is_friday ? "#22D3EE" : d.is_weekend ? "#475569" : "#10B981" },
        })),
      },
      {
        name: seriesNames.returns,
        type: "bar" as const,
        stack: "s",
        data: daily.map((d) => d.nbr_retours),
        itemStyle: { color: "#F59E0B", borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}

function buildEcartHistogramOption(buckets: EcartBucketItem[], ct: CT) {
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
      ...ct.tooltip,
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
      axisLine: { lineStyle: { color: ct.axisColor } },
      axisTick: { show: false },
      axisLabel: { ...ct.axisLabel, rotate: 20, interval: 0 },
    },
    yAxis: {
      type: "value" as const,
      axisLine: { show: false },
      splitLine: ct.splitLine,
      axisLabel: ct.axisLabel,
    },
    series: [{
      type: "bar" as const,
      data: buckets.map((b) => ({
        value: b.nbr_colis,
        itemStyle: { color: BUCKET_COLORS[b.bucket_order] ?? ct.labelColor, borderRadius: [4, 4, 0, 0] },
      })),
      label: { show: true, position: "top" as const, color: ct.legendColor, fontSize: 11, formatter: (p: { value: number }) => formatNumber(p.value) },
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
  const [activeInfo, setActiveInfo] = useState<KpiInfo | null>(null);

  const { t, locale } = useTranslation();
  const p = t.pages.parcelCosts;
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
  const DELIVERY_TYPES = [
    { label: p.hdAndSd,       value: "all" },
    { label: p.homeDelivery,  value: "HD"  },
    { label: p.pickupPoint,   value: "SD"  },
  ];

  const fetchMain = useCallback(async () => {
    setLoading(true);
    const f = { year, month: month ?? undefined, delivery_type: deliveryType !== "all" ? deliveryType : undefined };
    try {
      const [summary, trends, pccSummary, pccByAgency, costStructure, costByNature,
             byDeliveryType, dailyVolume, sinistres, freelance] =
        await Promise.all([
          parcelCostsApi.summary(f),
          parcelCostsApi.trends({ delivery_type: f.delivery_type }),
          parcelCostsApi.pccSummary(f),
          parcelCostsApi.pccByAgency({ year, month: month ?? undefined, delivery_type: f.delivery_type, limit: 5 }),
          parcelCostsApi.costStructure({ year, month: month ?? undefined }),
          parcelCostsApi.costByNature({ year, month: month ?? undefined }),
          parcelCostsApi.byDeliveryType({ year, month: month ?? undefined }),
          parcelCostsApi.dailyVolume({ year, month: month ?? undefined }),
          parcelCostsApi.sinistres({ year, month: month ?? undefined }),
          parcelCostsApi.freelanceEfficiency({ year, month: month ?? undefined }),
        ]);
      setData({ summary, trends, pccSummary, pccByAgency, costStructure, costByNature,
                byDeliveryType, dailyVolume, sinistres, freelance });
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
          byDeliveryType, dailyVolume, sinistres, freelance } = data;
  const { ecartDistribution, durationDistribution, parcels } = detail;
  const { current: cur, derived: d } = summary;

  const trendLabel = month !== null ? p.vsPrevMonth : p.vsLastYear;

  // ── Derived chart data ──────────────────────────────────────────────────────

  const trendCats = trends.map((tr) => `${pc.monthsShort[tr.month_num - 1] ?? tr.month_name_fr.slice(0, 3)} ${String(tr.year).slice(2)}`);

  const areaData = trends.map((tr, i) => ({
    month: trendCats[i],
    revenue: tr.total_fees,
    cost: tr.cout_total,
  }));

  const livTrend = {
    categories: trendCats,
    series: [
      { name: p.colDeliveryRate, data: trends.map((tr) => tr.taux_livraison_pct),  color: "#10B981" },
      { name: p.colUnderTariff,  data: trends.map((tr) => tr.taux_sous_tarif_pct), color: "#EF4444" },
    ],
  };

  const costDonutData = [
    { name: "Salaires",  value: costStructure.total_salaires  },
    { name: "Dépenses",  value: costStructure.total_depenses  },
    { name: "Freelance", value: costStructure.total_freelance },
    { name: "Sinistres", value: costStructure.total_sinistres },
  ].filter((x) => x.value > 0);

  const natureBarData = costByNature.map((n) => ({ name: n.nature_name, value: Math.round(n.total_dzd) }));
  const durationBarData = durationDistribution.map((d) => ({ name: d.bucket, value: d.nbr_colis }));
  const sinPieData = sinistres.by_type.map((t) => ({ name: t.sinistre_type, value: t.nbr_sinistres }));

  // ── Column defs ─────────────────────────────────────────────────────────────

  const pccAgencyCols: Column<ParcelPCCAgency>[] = [
    { key: "agence_name",        header: p.colAgency,       sortable: true },
    { key: "wilaya_name",        header: p.colWilaya,       sortable: true },
    { key: "nbr_colis_total",    header: p.colParcels,      sortable: true, render: (r) => formatNumber(r.nbr_colis_total) },
    {
      key: "nbr_sous_tarif", header: p.colUnderTariffN, sortable: true,
      render: (r) => <span className="text-red-400 font-semibold">{formatNumber(r.nbr_sous_tarif)}</span>,
    },
    {
      key: "taux_sous_tarif_pct", header: p.colUnderTariff, sortable: true,
      render: (r) => (
        <span className={`font-semibold ${r.taux_sous_tarif_pct >= 25 ? "text-red-400" : r.taux_sous_tarif_pct >= 20 ? "text-amber-400" : "text-emerald-400"}`}>
          {r.taux_sous_tarif_pct?.toFixed(1)}%
        </span>
      ),
    },
    {
      key: "total_ecart_dzd", header: p.colGapTotal, sortable: true,
      render: (r) => <span className="font-mono text-red-400 text-sm">{formatDZD(r.total_ecart_dzd)}</span>,
    },
    { key: "avg_ecart_dzd", header: p.colGapAvg, sortable: true, render: (r) => `${r.avg_ecart_dzd?.toFixed(1)} DZD` },
  ];

  // Freelance aggregate summary (compact panel)
  const flTotalDrivers   = freelance.reduce((s, r) => s + r.nbr_livreurs, 0);
  const flTotalDelivered = freelance.reduce((s, r) => s + r.nbr_colis_livres, 0);
  const flTotalPayments  = freelance.reduce((s, r) => s + r.total_paiements_dzd, 0);
  const flAvgCostParcel  = flTotalDelivered > 0 ? flTotalPayments / flTotalDelivered : 0;

  const parcelCols: Column<(typeof parcels.results)[0]>[] = [
    { key: "tracking",     header: p.colTracking,  render: (r) => <span className="font-mono text-xs text-[var(--text-secondary)]">{r.tracking}</span> },
    { key: "agence_nom",   header: p.colAgency,    sortable: true },
    { key: "wilaya_destination", header: p.colWilayaDest, sortable: true },
    {
      key: "delivery_type", header: p.colType,
      render: (r) => <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${r.delivery_type === "HD" ? "bg-indigo-500/10 text-indigo-400" : "bg-cyan-500/10 text-cyan-400"}`}>{r.delivery_type}</span>,
    },
    {
      key: "statut_actuel", header: p.colStatus,
      render: (r) => {
        const color = r.statut_actuel === "Livré" ? "text-emerald-400" : r.statut_actuel === "Retourné" ? "text-red-400" : "text-amber-400";
        return <span className={`text-xs font-semibold ${color}`}>{r.statut_actuel}</span>;
      },
    },
    { key: "delivery_fee",      header: p.colFees,        sortable: true, render: (r) => `${r.delivery_fee} DZD` },
    { key: "tarif_theorique",   header: p.colTariff,      render: (r) => r.tarif_theorique != null ? `${r.tarif_theorique} DZD` : "—" },
    {
      key: "ecart_tarif_dzd", header: p.colGap, sortable: true,
      render: (r) => {
        if (r.ecart_tarif_dzd == null) return <span className="text-slate-500">—</span>;
        const color = r.ecart_tarif_dzd < 0 ? "text-red-400" : r.ecart_tarif_dzd > 0 ? "text-emerald-400" : "text-slate-400";
        return <span className={`font-semibold text-sm ${color}`}>{r.ecart_tarif_dzd > 0 ? "+" : ""}{r.ecart_tarif_dzd} DZD</span>;
      },
    },
    {
      key: "duree_livraison_minutes", header: p.colDuration, sortable: true,
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
            {p.demoData}
          </span>
        )}
        {loading && (
          <span className="ml-auto text-xs text-slate-400 animate-pulse">{p.loading}</span>
        )}
      </div>

      {/* ── Primary KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title={p.kpiParcels}       value={formatNumber(cur.nbr_colis)}             trend={d.mom_colis}     trendLabel={trendLabel} icon={<Package size={16} />}    index={0} onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.kpiParcels,        p.kpiParcels))} />
        <KpiCard title={p.kpiDeliveryRate}  value={formatPercent(d.taux_livraison_pct)}     trend={d.mom_livraison} trendLabel={trendLabel} icon={<Truck size={16} />}      index={1} onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.kpiDeliveryRate,  p.kpiDeliveryRate))} />
        <KpiCard title={p.kpiFeesCollected} value={formatDZD(cur.total_fees)}               trend={d.mom_fees}      trendLabel={trendLabel} icon={<DollarSign size={16} />} index={2} onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.kpiFeesCollected, p.kpiFeesCollected))} />
        <KpiCard title={p.kpiTotalCost}     value={formatDZD(summary.costs.cout_total)}                             icon={<BarChart2 size={16} />}                          index={3} onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.kpiTotalCost,     p.kpiTotalCost))} />
      </div>

      {/* ── Secondary KPI cards ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard title={p.kpiUnderTariff}     value={formatPercent(d.taux_sous_tarif_pct)}       trend={-d.taux_sous_tarif_pct} trendLabel={trendLabel} icon={<AlertTriangle size={16} />} index={4} onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.kpiUnderTariff,     p.kpiUnderTariff))} />
        <KpiCard title={p.kpiAvgFee}          value={`${d.avg_fee_par_colis.toFixed(0)} DZD`}                                   icon={<Package size={16} />}       index={5} onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.kpiAvgFee,          p.kpiAvgFee))} />
        <KpiCard title={p.kpiCostPerDelivery} value={`${d.cout_par_colis_livre.toFixed(0)} DZD`}                                icon={<TrendingDown size={16} />}  index={6} onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.kpiCostPerDelivery, p.kpiCostPerDelivery))} />
        <KpiCard title={p.kpiCompliance}      value={formatPercent(100 - d.taux_sous_tarif_pct)} trend={d.mom_compliance}       trendLabel={trendLabel} icon={<DollarSign size={16} />}    index={7} onInfoClick={() => setActiveInfo(resolveInfo(KPI_INFO.kpiCompliance,      p.kpiCompliance))} />
      </div>

      {/* ── Trends: Fees vs Costs + Delivery & compliance rates ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionFeesVsCost} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionFeesVsCost, p.sectionFeesVsCost))}>
          {loading ? <Skeleton /> : <AreaChart data={areaData} height={280} />}
        </SectionCard>
        <SectionCard title={p.sectionDeliveryVsCompliance} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionDeliveryVsCompliance, p.sectionDeliveryVsCompliance))}>
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
          <SectionCard title={p.sectionEcartDistribution} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionEcartDistribution, p.sectionEcartDistribution))}>
            {loading || loadingDetail ? <Skeleton /> : (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                <ReactECharts option={buildEcartHistogramOption(ecartDistribution, ct)} style={{ height: 280 }} notMerge />
              </motion.div>
            )}
          </SectionCard>
        ) : (
          <SectionCard title={p.sectionEcartDistribution} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionEcartDistribution, p.sectionEcartDistribution))}>
            <div className="h-64 flex items-center justify-center text-slate-500 text-sm">
              {p.selectMonthPrompt}
            </div>
          </SectionCard>
        )}

        <SectionCard title={p.sectionPCCSummary} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionPCCSummary, p.sectionPCCSummary))}>
          {loading ? <Skeleton /> : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: p.pccWithTariff, value: formatNumber(pccSummary.nbr_avec_tarif), sub: `/ ${formatNumber(pccSummary.nbr_colis)}` },
                  { label: p.pccUnderTariff, value: formatNumber(pccSummary.nbr_sous_tarif), sub: `${pccSummary.taux_sous_tarif_pct?.toFixed(1)}%`, warn: true },
                  { label: p.pccTotalGap, value: formatDZD(pccSummary.total_ecart_dzd), sub: `${pccSummary.taux_ecart_global_pct?.toFixed(1)}%`, warn: true },
                  { label: p.pccAvgGap, value: `${pccSummary.avg_ecart_dzd?.toFixed(1)} DZD`, sub: `~${pccSummary.avg_ecart_absolu_dzd?.toFixed(1)} DZD` },
                ].map(({ label, value, sub, warn }) => (
                  <div key={label} className="bg-[var(--surface-secondary)] rounded-lg p-3">
                    <p className="text-xs text-slate-400 mb-1">{label}</p>
                    <p className={`text-lg font-bold ${warn ? "text-red-400" : "text-[var(--text-primary)]"}`}>{value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── PCC by Agency ranking ── */}
      <SectionCard title={p.sectionAgencyRanking} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionAgencyRanking, p.sectionAgencyRanking))}>
        {loading ? <Skeleton h="h-48" /> : (
          <DataTable columns={pccAgencyCols} data={pccByAgency} />
        )}
      </SectionCard>

      {/* ── Cost structure + Cost by nature ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionCostStructure} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionCostStructure, p.sectionCostStructure))}>
          {loading ? <Skeleton /> : <PieChart data={costDonutData} height={280} />}
        </SectionCard>
        <SectionCard title={p.sectionCostByNature} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionCostByNature, p.sectionCostByNature))}>
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

      {/* ── Delivery type comparison ── */}
      {!loading && byDeliveryType.length > 0 && (
        <SectionCard title={p.sectionHDvsSD} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionHDvsSD, p.sectionHDvsSD))}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {byDeliveryType.map((dt, i) => (
              <motion.div
                key={dt.delivery_type}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[var(--surface-secondary)] rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold px-3 py-1 rounded-full ${dt.delivery_type === "HD" ? "bg-indigo-500/15 text-indigo-300" : "bg-cyan-500/15 text-cyan-300"}`}>
                    {dt.delivery_type === "HD" ? p.homeDelivery : p.pickupPoint}
                  </span>
                  <span className="text-lg font-bold text-[var(--text-primary)]">{formatNumber(dt.nbr_colis)}</span>
                </div>
                {[
                  { label: p.hdDeliveryRate, value: `${dt.taux_livraison_pct?.toFixed(1)}%`, color: dt.taux_livraison_pct >= 75 ? "text-emerald-400" : "text-amber-400" },
                  { label: p.hdAvgFee,       value: `${dt.avg_fee_dzd?.toFixed(0)} DZD`,      color: "text-[var(--text-primary)]" },
                  { label: p.hdAvgDuration,  value: `${Math.round(dt.avg_duree_livree_min / 60)} h`, color: "text-[var(--text-primary)]" },
                  { label: p.hdReturnRate,   value: `${dt.taux_retour_pct?.toFixed(1)}%`,     color: "text-amber-400" },
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
        <SectionCard title={`${p.sectionDailyVolume} — ${MONTHS.find((m) => m.value === month)?.label ?? ""} ${year}`} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionDailyVolume, p.sectionDailyVolume))}>
          {loading ? <Skeleton /> : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <ReactECharts option={buildDailyVolumeOption(dailyVolume, { delivered: p.deliveredSeries, returns: p.returnsSeries }, ct)} style={{ height: 280 }} notMerge />
              <div className="flex gap-4 mt-3 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#10B981]" /> {p.normalDay}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#22D3EE]" /> {p.friday}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#475569]" /> {p.weekend}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#F59E0B]" /> {p.returns}</span>
              </div>
            </motion.div>
          )}
        </SectionCard>
      ) : null}

      {/* ── Duration distribution (only when month selected) ── */}
      {month ? (
        <SectionCard title={p.sectionDurationDistribution} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionDurationDistribution, p.sectionDurationDistribution))}>
          {loading || loadingDetail ? <Skeleton /> : (
            <BarChart
              data={durationBarData}
              height={260}
              color="#22D3EE"
              label={p.colDelivered}
            />
          )}
        </SectionCard>
      ) : null}

      {/* ── Sinistres ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <SectionCard title={p.sectionSinistresType} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionSinistresType, p.sectionSinistresType))}>
          {loading ? <Skeleton /> : <PieChart data={sinPieData} height={260} />}
        </SectionCard>
        <SectionCard title={p.sectionSinistresKPI} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionSinistresKPI, p.sectionSinistresKPI))}>
          {loading ? <Skeleton /> : (
            <div className="space-y-3">
              {[
                { label: p.sinDeclared,       value: String(sinistres.summary.nbr_sinistres) },
                { label: p.sinAmountDeclared, value: formatDZD(sinistres.summary.sum_declared_dzd) },
                { label: p.sinRefunded,       value: formatDZD(sinistres.summary.sum_rembourse_dzd), warn: true },
                { label: p.sinCoverage,       value: `${sinistres.summary.taux_couverture_pct?.toFixed(1)}%` },
                { label: p.sinAvgRefund,      value: `${sinistres.summary.avg_rembourse_dzd?.toFixed(0)} DZD` },
              ].map(({ label, value, warn }) => (
                <div key={label} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                  <span className="text-sm text-slate-400">{label}</span>
                  <span className={`text-sm font-semibold ${warn ? "text-amber-400" : "text-[var(--text-primary)]"}`}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      {/* ── Freelance compact summary ── */}
      <SectionCard title={p.sectionFreelance} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionFreelance, p.sectionFreelance))}>
        {loading ? <Skeleton h="h-24" /> : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: p.colDrivers,  value: formatNumber(flTotalDrivers),           icon: <Users size={14} /> },
              { label: p.colDelivered, value: formatNumber(flTotalDelivered),         icon: <Package size={14} /> },
              { label: p.colCostParcel, value: `${flAvgCostParcel.toFixed(0)} DZD`,  icon: <TrendingDown size={14} /> },
              { label: p.colTotalPaid, value: formatDZD(flTotalPayments),            icon: <DollarSign size={14} /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-[var(--surface-secondary)] rounded-lg p-3 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5 text-slate-400">
                  {icon}
                  <span className="text-xs">{label}</span>
                </div>
                <span className="text-base font-bold text-[var(--text-primary)]">{value}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Parcel drill-down table (only when month selected) ── */}
      {month ? (
        <SectionCard title={`${p.sectionParcelDetail} — ${MONTHS.find((m) => m.value === month)?.label ?? ""} ${year}`} onInfoClick={() => setActiveInfo(resolveInfo(CHART_INFO.sectionParcelDetail, p.sectionParcelDetail))}>
          {loadingDetail ? <Skeleton h="h-48" /> : (
            <>
              <p className="text-xs text-slate-500 mb-3">
                {formatNumber(parcels.count)} · {p.pageOf} {parcels.page}/{parcels.pages}
              </p>
              <DataTable columns={parcelCols} data={parcels.results} />
              <div className="flex items-center justify-between mt-4">
                <button
                  disabled={parcelPage <= 1}
                  onClick={() => { const pg = parcelPage - 1; setParcelPage(pg); fetchDetail(pg); }}
                  className="flex items-center gap-1 text-sm text-slate-400 hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} /> {p.prevPage}
                </button>
                <span className="text-xs text-slate-500">{p.pageOf} {parcelPage} / {parcels.pages}</span>
                <button
                  disabled={parcelPage >= parcels.pages}
                  onClick={() => { const pg = parcelPage + 1; setParcelPage(pg); fetchDetail(pg); }}
                  className="flex items-center gap-1 text-sm text-slate-400 hover:text-[var(--text-primary)] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {p.nextPage} <ChevronRight size={14} />
                </button>
              </div>
            </>
          )}
        </SectionCard>
      ) : (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-5 flex items-center justify-center h-24 text-slate-500 text-sm">
          <Package size={16} className="mr-2" />
          {p.selectMonthPrompt}
        </div>
      )}

      <InfoPanel info={activeInfo} onClose={() => setActiveInfo(null)} />

    </div>
  );
}
