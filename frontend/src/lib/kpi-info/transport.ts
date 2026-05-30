import type { Locale } from "@/lib/i18n";
import type { KpiInfo } from "@/components/ui/InfoPanel";

export type TransportKpiKey =
  | "ops_total_requests"
  | "ops_completion_rate"
  | "ops_cancellation_rate"
  | "ops_avg_distance"
  | "ops_avg_stops"
  | "cost_total_revenue"
  | "cost_total_cost"
  | "cost_gross_margin"
  | "cost_margin_pct"
  | "cost_per_km"
  | "perf_on_time_rate"
  | "perf_avg_duration"
  | "perf_avg_rating"
  | "perf_avg_delay"
  | "perf_night_shift_rate";

// ─── Source tables (shared across locales) ─────────────────────────────────────

const SRC_OPS = ["dim_transport", "dim_transport_status", "dim_transport_service_type", "dim_date"];
const SRC_COST = ["fact_transport_billing", "fact_transport_cost", "dim_transport", "dim_date"];
const SRC_PERF = ["fact_transport_performance", "dim_transport", "dim_date"];

// ─── Formulas (shared — SQL/math notation) ─────────────────────────────────────

const F = {
  totalRequests: `COUNT(*)
WHERE created_date_id BETWEEN début AND fin
  [AND service_type_id = filtre_service]`,

  completionRate: `COUNT(*) FILTER (statut = 'terminée')
─────────────────────────────────────── × 100
               COUNT(*)`,

  cancellationRate: `COUNT(*) FILTER (statut = 'annulée')
──────────────────────────────────────── × 100
               COUNT(*)`,

  avgDistance: `AVG(distance_real_km)
-- distance réelle parcourue par trajet`,

  avgStops: `AVG(nbr_stops_total)
-- nombre d'arrêts intermédiaires par trajet`,

  totalRevenue: `SUM(amount_invoiced)
-- montant facturé HT par demande`,

  totalCost: `SUM(total_cost)
= SUM(cout_base + cout_carburant + cout_assurance
    + cout_distance_supp + cout_manutention
    + cout_peage + cout_emballage + cout_tarif_nuit)`,

  grossMargin: `SUM(marge_brute_dzd)
= SUM(amount_invoiced) − SUM(total_cost)`,

  marginPct: `      SUM(marge_brute_dzd)
─────────────────────────────── × 100
  NULLIF(SUM(amount_invoiced), 0)`,

  costPerKm: `       SUM(total_cost)
─────────────────────────────── (DZD/km)
NULLIF(SUM(distance_real_km), 0)`,

  onTimeRate: `COUNT(*) FILTER (is_on_time = true)
──────────────────────────────────────── × 100
COUNT(*) FILTER (is_on_time IS NOT NULL)`,

  avgDuration: `AVG(total_duration_minutes) / 60.0
-- durée totale du trajet (départ → livraison)`,

  avgRating: `AVG(client_rating)
-- note client sur 5 (uniquement trajets terminés et évalués)`,

  avgDelay: `AVG(arrival_delay_minutes)
FILTER (statut = 'terminée' AND arrival_delay_minutes IS NOT NULL)
-- retard = heure d'arrivée réelle − heure d'arrivée prévue`,

  nightShiftRate: `COUNT(*) FILTER (is_night_shift = true)
──────────────────────────────────────── × 100
                COUNT(*)
-- nuit = départ ou arrivée hors 06h–22h`,
};

// ─── Multilingual KPI info map ─────────────────────────────────────────────────

const INFO: Record<Locale, Record<TransportKpiKey, KpiInfo>> = {
  // ── FRENCH ───────────────────────────────────────────────────────────────────
  fr: {
    ops_total_requests: {
      title: "Demandes totales",
      meaning:
        "Nombre total de demandes de transport (courses dédiées, courrier, manutention) enregistrées sur la période sélectionnée. Cet indicateur donne la mesure brute du volume d'activité opérationnelle.",
      formula: F.totalRequests,
      source: SRC_OPS,
      dimensions: ["Période (date de création)", "Type de service"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Inclut tous les statuts (terminées, en cours, annulées). Utilisez le filtre Type de service pour isoler une ligne métier.",
    },
    ops_completion_rate: {
      title: "Taux de complétion",
      meaning:
        "Proportion de demandes menées à terme (statut « terminée ») par rapport au total des demandes de la période. Mesure l'efficacité opérationnelle du réseau de transport.",
      formula: F.completionRate,
      source: SRC_OPS,
      dimensions: ["Période", "Type de service"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Les demandes « en cours » sont incluses au dénominateur et font mécaniquement baisser le taux sur les périodes récentes.",
      warning:
        "Un faible taux peut indiquer des annulations côté client, des problèmes de disponibilité véhicules ou des incidents opérationnels.",
    },
    ops_cancellation_rate: {
      title: "Taux d'annulation",
      meaning:
        "Proportion de demandes annulées avant ou pendant l'exécution. Un taux élevé signale une friction entre l'offre de transport et la demande clients.",
      formula: F.cancellationRate,
      source: SRC_OPS,
      dimensions: ["Période", "Type de service"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Les annulations peuvent être initiées par le client ou par le système (indisponibilité chauffeur/véhicule). Le suivi par type de service permet de cibler les causes.",
      warning:
        "Un taux > 10 % sur une période courte mérite une investigation approfondie (motifs d'annulation, agences concernées).",
    },
    ops_avg_distance: {
      title: "Distance moy. (km)",
      meaning:
        "Distance réelle moyenne parcourue par trajet sur la période. Indicateur clé pour dimensionner les coûts carburant et évaluer le mix géographique de l'activité.",
      formula: F.avgDistance,
      source: [...SRC_OPS, "fact_transport_performance"],
      dimensions: ["Période", "Type de service"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "La distance réelle (GPS tracé) peut différer de la distance théorique route. Seules les demandes ayant une distance renseignée sont prises en compte.",
    },
    ops_avg_stops: {
      title: "Arrêts moy. / demande",
      meaning:
        "Nombre moyen d'arrêts intermédiaires par trajet. Reflète la complexité logistique de chaque course et impacte directement la durée et le coût d'exécution.",
      formula: F.avgStops,
      source: [...SRC_OPS, "fact_transport_performance"],
      dimensions: ["Période", "Type de service"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Un arrêt = livraison/collecte intermédiaire. Les courses dédiées ont généralement moins d'arrêts que le courrier multi-points.",
    },

    cost_total_revenue: {
      title: "Revenu total",
      meaning:
        "Montant total facturé aux clients pour les prestations de transport sur la période. Représente le chiffre d'affaires brut du segment transport à la demande.",
      formula: F.totalRevenue,
      source: SRC_COST,
      dimensions: ["Période", "Type de service"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Exprimé en Dinars Algériens (DZD). Inclut la tarification de base, les suppléments distance, manutention, nuit et péage facturés au client.",
    },
    cost_total_cost: {
      title: "Coût total",
      meaning:
        "Somme de toutes les charges opérationnelles liées aux trajets de transport : carburant, assurance, tarif de base conducteur, manutention, péages, emballages et supplément nuit.",
      formula: F.totalCost,
      source: SRC_COST,
      dimensions: ["Période", "Type de service"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Décomposé en 8 composantes dans le graphe « Structure des coûts ». Les coûts fixes (assurance) sont alloués par trajet proportionnellement à la distance.",
    },
    cost_gross_margin: {
      title: "Marge brute",
      meaning:
        "Différence entre les revenus facturés et les coûts opérationnels directs. Mesure la profitabilité brute du transport à la demande avant frais de structure.",
      formula: F.grossMargin,
      source: SRC_COST,
      dimensions: ["Période", "Type de service"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Une marge brute négative indique que les coûts opérationnels dépassent les revenus — signal critique nécessitant une révision tarifaire ou une optimisation des coûts.",
      warning:
        "Cette marge n'inclut pas les charges de structure (RH, amortissements, loyers). La marge nette est calculée séparément.",
    },
    cost_margin_pct: {
      title: "Marge (%)",
      meaning:
        "Taux de marge brute exprimé en pourcentage du revenu. Permet de comparer la rentabilité entre périodes, types de service et corridors, indépendamment du volume.",
      formula: F.marginPct,
      source: SRC_COST,
      dimensions: ["Période", "Type de service"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Cible opérationnelle indicative : > 20 %. En dessous de 10 %, le corridor ou le service est considéré en zone de risque financier.",
    },
    cost_per_km: {
      title: "Coût / km",
      meaning:
        "Coût opérationnel moyen par kilomètre parcouru. Indicateur d'efficience permettant de comparer l'économicité des différents types de véhicules et routes.",
      formula: F.costPerKm,
      source: SRC_COST,
      dimensions: ["Période", "Type de service", "Type de véhicule"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Diviseur protégé par NULLIF pour éviter les divisions par zéro. Les véhicules à faible kilométrage peuvent présenter des coûts/km artificiellement élevés.",
      warning:
        "Comparer uniquement des véhicules de catégories similaires. Un poids lourd aura un coût/km structurellement plus élevé qu'un véhicule léger.",
    },

    perf_on_time_rate: {
      title: "Ponctualité",
      meaning:
        "Proportion de trajets arrivés à destination dans le délai convenu (heure d'arrivée réelle ≤ heure d'arrivée prévue). Indicateur principal de la qualité de service.",
      formula: F.onTimeRate,
      source: SRC_PERF,
      dimensions: ["Période", "Type de service", "Type de véhicule"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Seuls les trajets avec une heure d'arrivée prévue renseignée entrent au dénominateur. Les trajets sans engagement horaire sont exclus.",
      warning:
        "Un taux < 80 % déclenche une alerte système. La tendance mensuelle (graphe ci-dessous) permet de distinguer un incident ponctuel d'une dégradation structurelle.",
    },
    perf_avg_duration: {
      title: "Durée moy. (h)",
      meaning:
        "Durée moyenne d'exécution d'un trajet (de la prise en charge à la livraison finale). Permet de détecter les dérives temporelles et d'optimiser la planification.",
      formula: F.avgDuration,
      source: SRC_PERF,
      dimensions: ["Période", "Type de service", "Type de véhicule"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Durée totale en minutes convertie en heures. Inclut les temps d'attente, de chargement/déchargement et de transit. Hors temps de préparation (avant départ).",
    },
    perf_avg_rating: {
      title: "Note client moy.",
      meaning:
        "Moyenne des évaluations clients sur une échelle de 1 à 5 étoiles. Reflète la satisfaction globale vis-à-vis de la qualité du service de transport.",
      formula: F.avgRating,
      source: SRC_PERF,
      dimensions: ["Période", "Type de service"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Uniquement les trajets terminés ayant reçu une évaluation. Le taux de réponse peut varier selon les agences et types de service.",
      warning:
        "Note < 3.5 / 5 : signal de dégradation de l'expérience client à investiguer. Croiser avec le taux de ponctualité et les motifs d'annulation.",
    },
    perf_avg_delay: {
      title: "Retard arrivée moy.",
      meaning:
        "Retard moyen à l'arrivée, en minutes, calculé uniquement sur les trajets terminés avec une heure d'arrivée prévue. Une valeur négative indiquerait une avance systématique.",
      formula: F.avgDelay,
      source: SRC_PERF,
      dimensions: ["Période", "Type de service"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Retard = heure_arrivée_réelle − heure_arrivée_prévue (en minutes). Valeurs positives = retard, négatif = avance. Uniquement statut 'terminée'.",
    },
    perf_night_shift_rate: {
      title: "Taux de nuit",
      meaning:
        "Part des trajets effectués en horaire nocturne (départ ou arrivée hors de la plage 06h00–22h00). Impact sur les coûts (supplément nuit) et la gestion RH des conducteurs.",
      formula: F.nightShiftRate,
      source: SRC_PERF,
      dimensions: ["Période", "Type de service"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Un trajet est classé « nuit » dès que l'heure de départ ou d'arrivée sort de la plage 06h–22h. Le supplément nuit est répercuté dans le coût total.",
    },
  },

  // ── ENGLISH ───────────────────────────────────────────────────────────────────
  en: {
    ops_total_requests: {
      title: "Total Requests",
      meaning:
        "Total number of transport requests (dedicated trips, courier, handling) recorded over the selected period. This is the raw measure of operational activity volume.",
      formula: F.totalRequests,
      source: SRC_OPS,
      dimensions: ["Period (creation date)", "Service type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Includes all statuses (completed, in progress, cancelled). Use the Service Type filter to isolate a specific business line.",
    },
    ops_completion_rate: {
      title: "Completion Rate",
      meaning:
        "Proportion of requests successfully completed (status 'completed') relative to the total requests for the period. Measures the operational efficiency of the transport network.",
      formula: F.completionRate,
      source: SRC_OPS,
      dimensions: ["Period", "Service type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Requests 'in progress' are included in the denominator, mechanically lowering the rate for recent periods.",
      warning:
        "A low rate may indicate client-side cancellations, vehicle availability issues, or operational incidents.",
    },
    ops_cancellation_rate: {
      title: "Cancellation Rate",
      meaning:
        "Proportion of requests cancelled before or during execution. A high rate signals friction between transport supply and client demand.",
      formula: F.cancellationRate,
      source: SRC_OPS,
      dimensions: ["Period", "Service type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Cancellations may be client-initiated or system-initiated (driver/vehicle unavailability). Tracking by service type helps identify root causes.",
      warning:
        "A rate > 10% over a short period warrants deeper investigation (cancellation reasons, agencies involved).",
    },
    ops_avg_distance: {
      title: "Avg Distance (km)",
      meaning:
        "Average actual distance covered per trip over the period. A key metric for sizing fuel costs and assessing the geographic mix of the operation.",
      formula: F.avgDistance,
      source: [...SRC_OPS, "fact_transport_performance"],
      dimensions: ["Period", "Service type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Actual distance (GPS-tracked) may differ from the theoretical road distance. Only requests with a recorded distance are included.",
    },
    ops_avg_stops: {
      title: "Avg Stops / Request",
      meaning:
        "Average number of intermediate stops per trip. Reflects the logistical complexity of each run and directly impacts execution time and cost.",
      formula: F.avgStops,
      source: [...SRC_OPS, "fact_transport_performance"],
      dimensions: ["Period", "Service type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "One stop = intermediate delivery/pickup. Dedicated trips generally have fewer stops than multi-point courier runs.",
    },

    cost_total_revenue: {
      title: "Total Revenue",
      meaning:
        "Total amount invoiced to clients for transport services over the period. Represents the gross revenue of the on-demand transport segment.",
      formula: F.totalRevenue,
      source: SRC_COST,
      dimensions: ["Period", "Service type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Expressed in Algerian Dinars (DZD). Includes base tariff, distance surcharges, handling, night and toll fees billed to the client.",
    },
    cost_total_cost: {
      title: "Total Cost",
      meaning:
        "Sum of all operational charges related to transport trips: fuel, insurance, base driver fee, handling, tolls, packaging, and night surcharge.",
      formula: F.totalCost,
      source: SRC_COST,
      dimensions: ["Period", "Service type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Broken down into 8 components in the 'Cost Breakdown' chart. Fixed costs (insurance) are allocated per trip proportionally to distance.",
    },
    cost_gross_margin: {
      title: "Gross Margin",
      meaning:
        "Difference between invoiced revenue and direct operational costs. Measures the gross profitability of on-demand transport before overhead expenses.",
      formula: F.grossMargin,
      source: SRC_COST,
      dimensions: ["Period", "Service type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "A negative gross margin means operational costs exceed revenue — a critical signal requiring a tariff review or cost optimization.",
      warning:
        "This margin excludes overhead (HR, depreciation, rent). Net margin is calculated separately.",
    },
    cost_margin_pct: {
      title: "Margin (%)",
      meaning:
        "Gross margin rate expressed as a percentage of revenue. Enables profitability comparison across periods, service types, and corridors, independent of volume.",
      formula: F.marginPct,
      source: SRC_COST,
      dimensions: ["Period", "Service type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Indicative operational target: > 20%. Below 10%, the corridor or service is considered in a financial risk zone.",
    },
    cost_per_km: {
      title: "Cost / km",
      meaning:
        "Average operational cost per kilometre travelled. An efficiency indicator used to compare the cost-effectiveness of different vehicle types and routes.",
      formula: F.costPerKm,
      source: SRC_COST,
      dimensions: ["Period", "Service type", "Vehicle type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Divisor protected by NULLIF to avoid division by zero. Vehicles with low mileage may show artificially high cost/km figures.",
      warning:
        "Compare only vehicles of similar categories. Heavy trucks have a structurally higher cost/km than light vehicles.",
    },

    perf_on_time_rate: {
      title: "On-Time Rate",
      meaning:
        "Proportion of trips that arrived at the destination within the agreed time (actual arrival ≤ planned arrival). Primary service quality indicator.",
      formula: F.onTimeRate,
      source: SRC_PERF,
      dimensions: ["Period", "Service type", "Vehicle type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Only trips with a recorded planned arrival time enter the denominator. Trips with no time commitment are excluded.",
      warning:
        "A rate < 80% triggers a system alert. The monthly trend chart below distinguishes isolated incidents from structural degradation.",
    },
    perf_avg_duration: {
      title: "Avg Duration (h)",
      meaning:
        "Average trip execution time (from pickup to final delivery). Helps detect time overruns and optimise planning.",
      formula: F.avgDuration,
      source: SRC_PERF,
      dimensions: ["Period", "Service type", "Vehicle type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Total duration in minutes converted to hours. Includes waiting, loading/unloading, and transit times. Excludes preparation time (before departure).",
    },
    perf_avg_rating: {
      title: "Avg Client Rating",
      meaning:
        "Average client rating on a 1-to-5 star scale. Reflects overall satisfaction with the transport service quality.",
      formula: F.avgRating,
      source: SRC_PERF,
      dimensions: ["Period", "Service type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Only completed trips that received a rating are included. Response rate may vary across agencies and service types.",
      warning:
        "Rating < 3.5 / 5: signal of degraded client experience requiring investigation. Cross-reference with on-time rate and cancellation reasons.",
    },
    perf_avg_delay: {
      title: "Avg Arrival Delay",
      meaning:
        "Average arrival delay in minutes, computed only on completed trips that had a planned arrival time. A negative value would indicate a systematic early arrival.",
      formula: F.avgDelay,
      source: SRC_PERF,
      dimensions: ["Period", "Service type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Delay = actual_arrival − planned_arrival (in minutes). Positive = late, negative = early. Only 'completed' status included.",
    },
    perf_night_shift_rate: {
      title: "Night Shift Rate",
      meaning:
        "Share of trips performed during night hours (departure or arrival outside the 06:00–22:00 window). Impacts costs (night surcharge) and driver HR management.",
      formula: F.nightShiftRate,
      source: SRC_PERF,
      dimensions: ["Period", "Service type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "A trip is classified as 'night' if departure or arrival falls outside 06:00–22:00. The night surcharge is reflected in the total cost.",
    },
  },

  // ── ARABIC ────────────────────────────────────────────────────────────────────
  ar: {
    ops_total_requests: {
      title: "إجمالي الطلبات",
      meaning:
        "العدد الإجمالي لطلبات النقل (الرحلات المخصصة، البريد السريع، الشحن) المسجلة خلال الفترة المحددة. يُعدّ هذا المؤشر القياسَ الخام لحجم النشاط التشغيلي.",
      formula: F.totalRequests,
      source: SRC_OPS,
      dimensions: ["الفترة (تاريخ الإنشاء)", "نوع الخدمة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "يشمل جميع الحالات (مكتملة، قيد التنفيذ، ملغاة). استخدم فلتر نوع الخدمة لعزل قطاع عمل محدد.",
    },
    ops_completion_rate: {
      title: "معدل الإنجاز",
      meaning:
        "نسبة الطلبات المُنجزة بنجاح (الحالة 'مكتملة') من إجمالي طلبات الفترة. يقيس الكفاءة التشغيلية لشبكة النقل.",
      formula: F.completionRate,
      source: SRC_OPS,
      dimensions: ["الفترة", "نوع الخدمة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "تُدرج الطلبات 'قيد التنفيذ' في المقام، مما يُخفّض المعدل آلياً للفترات الحديثة.",
      warning:
        "قد يشير المعدل المنخفض إلى إلغاءات من جانب العميل، أو مشاكل في توفر المركبات، أو حوادث تشغيلية.",
    },
    ops_cancellation_rate: {
      title: "معدل الإلغاء",
      meaning:
        "نسبة الطلبات الملغاة قبل التنفيذ أو أثناءه. يُشير المعدل المرتفع إلى احتكاك بين عرض النقل وطلب العملاء.",
      formula: F.cancellationRate,
      source: SRC_OPS,
      dimensions: ["الفترة", "نوع الخدمة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "قد تكون الإلغاءات من طرف العميل أو من النظام (عدم توفر السائق/المركبة). يُساعد التتبع حسب نوع الخدمة في تحديد الأسباب الجذرية.",
      warning:
        "معدل > 10% خلال فترة قصيرة يستدعي تحقيقاً معمّقاً (أسباب الإلغاء، الوكالات المعنية).",
    },
    ops_avg_distance: {
      title: "متوسط المسافة (كم)",
      meaning:
        "متوسط المسافة الفعلية المقطوعة لكل رحلة خلال الفترة. مؤشر رئيسي لتقدير تكاليف الوقود وتقييم التوزيع الجغرافي للنشاط.",
      formula: F.avgDistance,
      source: [...SRC_OPS, "fact_transport_performance"],
      dimensions: ["الفترة", "نوع الخدمة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "قد تختلف المسافة الفعلية (تتبع GPS) عن المسافة النظرية للطريق. تُؤخذ في الحسبان الطلبات التي تحتوي على مسافة مُسجَّلة فقط.",
    },
    ops_avg_stops: {
      title: "متوسط التوقفات / طلب",
      meaning:
        "متوسط عدد التوقفات الوسيطة لكل رحلة. يعكس التعقيد اللوجستي لكل رحلة ويؤثر مباشرةً على مدة التنفيذ والتكلفة.",
      formula: F.avgStops,
      source: [...SRC_OPS, "fact_transport_performance"],
      dimensions: ["الفترة", "نوع الخدمة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "التوقف = تسليم/استلام وسيط. تمتلك الرحلات المخصصة عادةً توقفات أقل من رحلات البريد متعددة النقاط.",
    },

    cost_total_revenue: {
      title: "إجمالي الإيرادات",
      meaning:
        "إجمالي المبالغ المفوترة للعملاء مقابل خدمات النقل خلال الفترة. يُمثّل رقم الأعمال الإجمالي لقطاع النقل عند الطلب.",
      formula: F.totalRevenue,
      source: SRC_COST,
      dimensions: ["الفترة", "نوع الخدمة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "يُعبَّر عنه بالدينار الجزائري (دج). يشمل التعريفة الأساسية ورسوم المسافة الإضافية والشحن والليل والرسوم المفوترة للعميل.",
    },
    cost_total_cost: {
      title: "التكلفة الإجمالية",
      meaning:
        "مجموع جميع الأعباء التشغيلية المتعلقة برحلات النقل: الوقود، التأمين، تعريفة السائق الأساسية، الشحن، الرسوم، التعبئة، والإضافة الليلية.",
      formula: F.totalCost,
      source: SRC_COST,
      dimensions: ["الفترة", "نوع الخدمة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "مُقسَّمة إلى 8 مكونات في رسم 'تفصيل التكاليف'. تُخصَّص التكاليف الثابتة (التأمين) لكل رحلة بالتناسب مع المسافة.",
    },
    cost_gross_margin: {
      title: "الهامش الإجمالي",
      meaning:
        "الفرق بين الإيرادات المفوترة والتكاليف التشغيلية المباشرة. يقيس الربحية الإجمالية للنقل عند الطلب قبل مصاريف الهيكل.",
      formula: F.grossMargin,
      source: SRC_COST,
      dimensions: ["الفترة", "نوع الخدمة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "الهامش الإجمالي السلبي يعني أن التكاليف التشغيلية تتجاوز الإيرادات — إشارة حرجة تستوجب مراجعة التسعير أو تحسين التكاليف.",
      warning:
        "لا يشمل هذا الهامش مصاريف الهيكل (الموارد البشرية، الاستهلاك، الإيجارات). يُحسب الهامش الصافي بشكل منفصل.",
    },
    cost_margin_pct: {
      title: "الهامش (%)",
      meaning:
        "معدل الهامش الإجمالي معبراً عنه كنسبة مئوية من الإيرادات. يُتيح مقارنة الربحية بين الفترات وأنواع الخدمة والممرات بمعزل عن الحجم.",
      formula: F.marginPct,
      source: SRC_COST,
      dimensions: ["الفترة", "نوع الخدمة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "الهدف التشغيلي التوجيهي: > 20%. أقل من 10%، يُعتبر الممر أو الخدمة في منطقة خطر مالي.",
    },
    cost_per_km: {
      title: "التكلفة / كم",
      meaning:
        "متوسط التكلفة التشغيلية لكل كيلومتر مقطوع. مؤشر الكفاءة الذي يُتيح مقارنة اقتصادية أنواع المركبات والمسارات المختلفة.",
      formula: F.costPerKm,
      source: SRC_COST,
      dimensions: ["الفترة", "نوع الخدمة", "نوع المركبة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "المقسوم عليه محمي بـ NULLIF لتفادي القسمة على صفر. قد تُظهر المركبات ذات الكيلومترية المنخفضة تكلفة/كم مرتفعة بشكل مصطنع.",
      warning:
        "قارن فقط المركبات من فئات مماثلة. الشاحنات الثقيلة لها تكلفة/كم هيكلياً أعلى من المركبات الخفيفة.",
    },

    perf_on_time_rate: {
      title: "معدل الانتظام",
      meaning:
        "نسبة الرحلات التي وصلت إلى وجهتها في الموعد المتفق عليه (الوصول الفعلي ≤ الوصول المخطط). المؤشر الرئيسي لجودة الخدمة.",
      formula: F.onTimeRate,
      source: SRC_PERF,
      dimensions: ["الفترة", "نوع الخدمة", "نوع المركبة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "تُدرج في المقام فقط الرحلات التي تحتوي على وقت وصول مخطط مُسجَّل. تُستبعد الرحلات غير المقيدة بجدول زمني.",
      warning:
        "معدل < 80% يُطلق تنبيهاً تلقائياً. مخطط الاتجاه الشهري يُميز بين الحوادث الفردية والتدهور البنيوي.",
    },
    perf_avg_duration: {
      title: "متوسط المدة (س)",
      meaning:
        "متوسط مدة تنفيذ الرحلة (من الاستلام إلى التسليم النهائي). يُساعد في الكشف عن تجاوزات الوقت وتحسين التخطيط.",
      formula: F.avgDuration,
      source: SRC_PERF,
      dimensions: ["الفترة", "نوع الخدمة", "نوع المركبة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "المدة الإجمالية بالدقائق مُحوَّلة إلى ساعات. تشمل أوقات الانتظار والشحن/التفريغ والعبور. لا تشمل وقت التحضير (قبل المغادرة).",
    },
    perf_avg_rating: {
      title: "متوسط تقييم العميل",
      meaning:
        "متوسط تقييمات العملاء على مقياس من 1 إلى 5 نجوم. يعكس الرضا العام عن جودة خدمة النقل.",
      formula: F.avgRating,
      source: SRC_PERF,
      dimensions: ["الفترة", "نوع الخدمة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "تُؤخذ في الحسبان فقط الرحلات المكتملة التي تلقّت تقييماً. قد تتفاوت نسبة الاستجابة بين الوكالات وأنواع الخدمة.",
      warning:
        "تقييم < 3.5 / 5: إشارة تدهور تجربة العميل تستوجب التحقيق. تقاطعه مع معدل الانتظام وأسباب الإلغاء.",
    },
    perf_avg_delay: {
      title: "متوسط التأخر عند الوصول",
      meaning:
        "متوسط تأخر الوصول بالدقائق، محسوباً فقط على الرحلات المكتملة التي كانت لها أوقات وصول مخططة. القيمة السالبة تعني تقدماً منهجياً في المواعيد.",
      formula: F.avgDelay,
      source: SRC_PERF,
      dimensions: ["الفترة", "نوع الخدمة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "التأخر = وقت_الوصول_الفعلي − وقت_الوصول_المخطط (بالدقائق). موجب = تأخر، سالب = تقدم. الحالة 'مكتملة' فقط.",
    },
    perf_night_shift_rate: {
      title: "معدل الوردية الليلية",
      meaning:
        "حصة الرحلات المُنفَّذة في الفترة الليلية (المغادرة أو الوصول خارج نطاق 06:00–22:00). يؤثر على التكاليف (الإضافة الليلية) وإدارة الموارد البشرية للسائقين.",
      formula: F.nightShiftRate,
      source: SRC_PERF,
      dimensions: ["الفترة", "نوع الخدمة"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "تُصنَّف الرحلة كـ'ليلية' إذا كانت المغادرة أو الوصول خارج 06:00–22:00. تنعكس الإضافة الليلية على إجمالي التكلفة.",
    },
  },
};

export function getTransportKpiInfo(locale: Locale): Record<TransportKpiKey, KpiInfo> {
  return INFO[locale] ?? INFO.fr;
}
