import type { Locale } from "@/lib/i18n";
import type { KpiInfo } from "@/components/ui/InfoPanel";

export type ParcelDeliveryKpiKey =
  // Operations
  | "ops_total_parcels"
  | "ops_delivered"
  | "ops_returns"
  | "ops_in_transit"
  | "ops_avg_duration"
  // Cost & Profitability
  | "cost_fees_collected"
  | "cost_total_cost"
  | "cost_gross_margin"
  | "cost_avg_fee"
  | "cost_per_delivery"
  // Performance
  | "perf_delivery_rate"
  | "perf_avg_attempts"
  | "perf_first_attempt_rate"
  | "perf_avg_duration"
  | "perf_claims_count";

// ─── Source tables (shared) ────────────────────────────────────────────────────

const SRC_OPS  = ["dim_parcel", "dim_parcel_status", "dim_date"];
const SRC_COST = ["fact_parcel_revenue", "fact_charges", "fact_cost_salaire", "dim_parcel", "dim_date"];
const SRC_PERF = ["dim_parcel", "dim_parcel_status", "dim_remboursement", "dim_date"];

// ─── Formulas (SQL / mathematical notation, language-neutral) ─────────────────

const F = {
  totalParcels: `COUNT(*)
WHERE date_creation_id BETWEEN début AND fin
  [AND delivery_type = filtre_type]`,

  delivered: `COUNT(*) FILTER (current_status_id = 13)
-- statut 13 = « Livré » (terminal)`,

  returns: `COUNT(*) FILTER (current_status_id = 19)
-- statut 19 = « Retourné au vendeur » (terminal)`,

  inTransit: `COUNT(*) FILTER (is_terminal = FALSE)
-- tous statuts non-terminaux (en cours de traitement)`,

  avgDuration: `AVG(duree_totale_minutes) / 60.0
FILTER (current_status_id = 13)
-- durée totale de la création jusqu'au statut "Livré"`,

  feesCollected: `SUM(delivery_fee)
FROM fact_parcel_revenue
WHERE date_terminal_id BETWEEN début AND fin`,

  totalCost: `SUM(fact_charges.montant)                  -- charges validées (depense_status_id = 2)
+ SUM(fact_cost_salaire.total_brut
      + fact_cost_salaire.total_charges_patronales)
[Si filtre type : coût_alloué = coût_total × (frais_filtrés / frais_total)]`,

  grossMargin: `(SUM(delivery_fee) − coût_total) / SUM(delivery_fee) × 100
-- marge brute en pourcentage des frais collectés`,

  avgFee: `SUM(delivery_fee) / COUNT(*) FILTER (current_status_id = 13)
-- frais moyens par colis livré`,

  costPerDelivery: `coût_total / COUNT(*) FILTER (current_status_id = 13)
-- charge opérationnelle moyenne par colis livré`,

  deliveryRate: `COUNT(*) FILTER (current_status_id = 13)
──────────────────────────────────────── × 100
               COUNT(*)
WHERE date_creation_id BETWEEN début ET fin`,

  avgAttempts: `AVG(nbr_tentatives_livraison + 1)
FILTER (current_status_id = 13)
-- tentatives totales = échecs + 1 (livraison finale)`,

  firstAttemptRate: `COUNT(*) FILTER (current_status_id = 13
                    AND nbr_tentatives_livraison = 0)
──────────────────────────────────────────────────────── × 100
     COUNT(*) FILTER (current_status_id = 13)`,

  claimsCount: `COUNT(*)
FROM dim_remboursement
WHERE date_remboursement_id BETWEEN début ET fin`,
};

// ─── Multilingual KPI info ─────────────────────────────────────────────────────

const INFO: Record<Locale, Record<ParcelDeliveryKpiKey, KpiInfo>> = {
  // ── FRENCH ───────────────────────────────────────────────────────────────────
  fr: {
    ops_total_parcels: {
      title: "Colis traités",
      meaning:
        "Nombre total de colis enregistrés dans le système sur la période sélectionnée, tous types de livraison confondus (domicile HD et stop desk SD). Représente le volume brut d'activité de la plateforme de livraison.",
      formula: F.totalParcels,
      source: SRC_OPS,
      dimensions: ["Période (date de création)", "Type de livraison (HD / SD)"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Inclut tous les statuts (livrés, retournés, en transit, en échec). Utiliser le filtre Type pour isoler HD ou SD.",
    },
    ops_delivered: {
      title: "Colis livrés",
      meaning:
        "Nombre de colis ayant atteint le statut terminal « Livré » (statut 13) sur la période. Indicateur direct du volume d'activité commerciale générateur de revenus.",
      formula: F.delivered,
      source: SRC_OPS,
      dimensions: ["Période (date de création)", "Type de livraison"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Seul le statut 13 est considéré comme livraison réussie. Les retours et les échecs sont exclus de ce compteur.",
    },
    ops_returns: {
      title: "Retours",
      meaning:
        "Nombre de colis retournés au vendeur (statut 19). Un retour représente un coût opérationnel sans génération de revenu de livraison, et reflète l'insatisfaction client ou une adresse incorrecte.",
      formula: F.returns,
      source: SRC_OPS,
      dimensions: ["Période (date de création)", "Type de livraison"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Statut 19 = « Retourné au vendeur » (statut terminal). Ne pas confondre avec les « Retours en cours » encore en transit.",
      warning:
        "Un volume élevé de retours grève directement la rentabilité. Croiser avec la zone de livraison et le type de service pour identifier les zones à risque.",
    },
    ops_in_transit: {
      title: "En transit",
      meaning:
        "Nombre de colis ayant un statut non-terminal (en cours de traitement dans le réseau de livraison). Reflète le volume en cours de traitement à un instant donné.",
      formula: F.inTransit,
      source: SRC_OPS,
      dimensions: ["Période (date de création)", "Type de livraison"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Inclut tous les statuts où `is_terminal = FALSE` (ex. : en préparation, expédié, en attente). Ce chiffre varie fortement selon la date d'interrogation.",
    },
    ops_avg_duration: {
      title: "Durée moy. livraison",
      meaning:
        "Durée moyenne entre la création du colis et son passage au statut « Livré », exprimée en heures. Mesure l'efficacité du circuit logistique de bout en bout.",
      formula: F.avgDuration,
      source: SRC_OPS,
      dimensions: ["Période (date de création)", "Type de livraison"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Calculé uniquement sur les colis livrés (statut 13). Inclut les délais de traitement, de tri, de transport et de tentatives de livraison.",
    },

    cost_fees_collected: {
      title: "Frais collectés",
      meaning:
        "Montant total des frais de livraison facturés et encaissés pour les colis ayant atteint un statut terminal sur la période. Représente le chiffre d'affaires du segment livraison colis.",
      formula: F.feesCollected,
      source: SRC_COST,
      dimensions: ["Période (date de terminal)", "Type de livraison"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Filtre sur `date_terminal_id` (date de résolution du colis), non sur la date de création. Exprimé en Dinars Algériens (DZD).",
    },
    cost_total_cost: {
      title: "Coût opérationnel total",
      meaning:
        "Somme des charges opérationnelles directes (dépenses validées et masse salariale) imputables à la livraison colis sur la période. Base de calcul de la marge brute.",
      formula: F.totalCost,
      source: SRC_COST,
      dimensions: ["Période (date de charge)", "Type de livraison"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Seules les dépenses avec `depense_status_id = 2` (validées) sont incluses. Les transferts de caisse internes sont exclus. Si un type de livraison est filtré, le coût est alloué proportionnellement aux frais.",
    },
    cost_gross_margin: {
      title: "Marge brute (%)",
      meaning:
        "Pourcentage des frais collectés qui reste après déduction des coûts opérationnels directs. Indicateur synthétique de la rentabilité du service de livraison.",
      formula: F.grossMargin,
      source: SRC_COST,
      dimensions: ["Période", "Type de livraison"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Exprimé en %, non en valeur absolue. Une marge négative signifie que les charges dépassent les frais collectés — signal critique.",
      warning:
        "Cette marge exclut les charges de structure (loyers, amortissements). La marge nette réelle est inférieure à ce chiffre.",
    },
    cost_avg_fee: {
      title: "Frais moy. / colis",
      meaning:
        "Frais de livraison moyens facturés par colis livré. Indicateur de positionnement tarifaire et de mix produit (HD vs SD, zones).",
      formula: F.avgFee,
      source: SRC_COST,
      dimensions: ["Période (date de terminal)", "Type de livraison"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Calculé sur les colis livrés uniquement (statut 13). Les retours et les colis en transit ne génèrent pas de frais de livraison comptabilisés.",
    },
    cost_per_delivery: {
      title: "Coût / colis livré",
      meaning:
        "Coût opérationnel moyen supporté par colis effectivement livré. Permet de comparer l'efficience entre agences, zones et types de livraison.",
      formula: F.costPerDelivery,
      source: SRC_COST,
      dimensions: ["Période", "Type de livraison"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Divise le coût total par le nombre de colis livrés (statut 13). Un coût/colis élevé peut indiquer un fort taux de retour ou une zone peu dense.",
      warning:
        "Comparer ce chiffre avec le frais moyen/colis pour évaluer la marge unitaire. Si coût > frais, la livraison est à perte.",
    },

    perf_delivery_rate: {
      title: "Taux de livraison",
      meaning:
        "Proportion de colis livrés avec succès (statut 13) par rapport au total des colis créés sur la période. Indicateur principal de la qualité opérationnelle du réseau.",
      formula: F.deliveryRate,
      source: SRC_PERF,
      dimensions: ["Période (date de création)", "Type de livraison"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Les colis « en transit » (statut non-terminal) sont inclus au dénominateur, ce qui peut faire baisser mécaniquement le taux sur les périodes très récentes.",
      warning:
        "Un taux < 73 % déclenche une alerte système. Comparer par wilaya, agence et type de livraison pour localiser les points de défaillance.",
    },
    perf_avg_attempts: {
      title: "Tentatives moy.",
      meaning:
        "Nombre moyen de tentatives de livraison nécessaires pour atteindre un statut « Livré ». Inclut la tentative finale réussie. Un chiffre élevé indique des problèmes d'accessibilité ou de contact client.",
      formula: F.avgAttempts,
      source: SRC_PERF,
      dimensions: ["Période (date de création)", "Type de livraison"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Calculé uniquement sur les colis livrés (statut 13). `nbr_tentatives_livraison` = nombre d'échecs avant livraison ; le +1 ajoute la tentative réussie.",
    },
    perf_first_attempt_rate: {
      title: "Succès 1ère tentative",
      meaning:
        "Proportion de colis livrés dès la première tentative, sans échec préalable. Indicateur d'efficience terrain et de qualité des données client (adresse, disponibilité).",
      formula: F.firstAttemptRate,
      source: SRC_PERF,
      dimensions: ["Période (date de création)", "Type de livraison"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Dénominateur = tous les colis livrés (statut 13). Numérateur = ceux pour lesquels `nbr_tentatives_livraison = 0` (aucun échec avant livraison).",
    },
    perf_avg_duration: {
      title: "Durée moy. livraison",
      meaning:
        "Durée moyenne entre la création du colis et sa livraison finale, exprimée en heures. Mesure de la vélocité opérationnelle du circuit logistique.",
      formula: F.avgDuration,
      source: SRC_PERF,
      dimensions: ["Période (date de création)", "Type de livraison"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Identique à l'indicateur de durée de l'onglet Opérations — calculé sur les colis livrés (statut 13). La durée inclut les délais inter-tentatives.",
    },
    perf_claims_count: {
      title: "Sinistres déclarés",
      meaning:
        "Nombre de dossiers de remboursement (sinistres) ouverts sur la période — pertes, avaries, colis non restitués. Mesure directe du risque qualité et du coût d'indemnisation.",
      formula: F.claimsCount,
      source: [...SRC_PERF, "dim_remboursement"],
      dimensions: ["Période (date de remboursement)", "Type de sinistre"],
      updateFreq: "Quotidienne — après chaque cycle ETL",
      calcNotes:
        "Filtré sur `date_remboursement_id`. Chaque dossier représente une indemnisation potentielle. Le graphe de répartition par type détaille les causes.",
      warning:
        "Un volume croissant de sinistres peut indiquer une dégradation des conditions de transport ou des problèmes d'emballage. Croiser avec les zones à fort taux de retour.",
    },
  },

  // ── ENGLISH ───────────────────────────────────────────────────────────────────
  en: {
    ops_total_parcels: {
      title: "Parcels Handled",
      meaning:
        "Total number of parcels registered in the system over the selected period, across all delivery types (home delivery HD and stop desk SD). Represents the raw volume of activity on the delivery platform.",
      formula: F.totalParcels,
      source: SRC_OPS,
      dimensions: ["Period (creation date)", "Delivery type (HD / SD)"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Includes all statuses (delivered, returned, in transit, failed). Use the Type filter to isolate HD or SD.",
    },
    ops_delivered: {
      title: "Delivered Parcels",
      meaning:
        "Number of parcels that reached the terminal status 'Delivered' (status 13) over the period. Direct indicator of the volume of commercial activity generating revenue.",
      formula: F.delivered,
      source: SRC_OPS,
      dimensions: ["Period (creation date)", "Delivery type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Only status 13 is considered a successful delivery. Returns and failures are excluded from this count.",
    },
    ops_returns: {
      title: "Returns",
      meaning:
        "Number of parcels returned to the sender (status 19). A return represents an operational cost with no delivery revenue, and reflects client dissatisfaction or incorrect address information.",
      formula: F.returns,
      source: SRC_OPS,
      dimensions: ["Period (creation date)", "Delivery type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Status 19 = 'Returned to sender' (terminal status). Not to be confused with returns still in transit.",
      warning:
        "A high return volume directly erodes profitability. Cross-reference with delivery zone and service type to identify high-risk areas.",
    },
    ops_in_transit: {
      title: "In Transit",
      meaning:
        "Number of parcels with a non-terminal status (currently being processed in the delivery network). Reflects the volume being handled at a given point in time.",
      formula: F.inTransit,
      source: SRC_OPS,
      dimensions: ["Period (creation date)", "Delivery type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Includes all statuses where `is_terminal = FALSE` (e.g. in preparation, shipped, awaiting pickup). This figure varies significantly depending on the query date.",
    },
    ops_avg_duration: {
      title: "Avg Delivery Duration",
      meaning:
        "Average time between parcel creation and the 'Delivered' status, expressed in hours. Measures end-to-end logistics circuit efficiency.",
      formula: F.avgDuration,
      source: SRC_OPS,
      dimensions: ["Period (creation date)", "Delivery type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Computed only on delivered parcels (status 13). Includes processing, sorting, transport, and delivery attempt delays.",
    },

    cost_fees_collected: {
      title: "Fees Collected",
      meaning:
        "Total delivery fees billed and collected for parcels that reached a terminal status over the period. Represents the revenue of the parcel delivery segment.",
      formula: F.feesCollected,
      source: SRC_COST,
      dimensions: ["Period (terminal date)", "Delivery type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Filtered on `date_terminal_id` (parcel resolution date), not the creation date. Expressed in Algerian Dinars (DZD).",
    },
    cost_total_cost: {
      title: "Total Operational Cost",
      meaning:
        "Sum of direct operational expenses (validated charges and payroll) attributable to parcel delivery over the period. Basis for gross margin calculation.",
      formula: F.totalCost,
      source: SRC_COST,
      dimensions: ["Period (charge date)", "Delivery type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Only expenses with `depense_status_id = 2` (validated) are included. Internal cash transfers are excluded. When a delivery type filter is applied, costs are allocated proportionally to fees.",
    },
    cost_gross_margin: {
      title: "Gross Margin (%)",
      meaning:
        "Percentage of collected fees remaining after deducting direct operational costs. Synthetic indicator of the profitability of the delivery service.",
      formula: F.grossMargin,
      source: SRC_COST,
      dimensions: ["Period", "Delivery type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Expressed as %, not an absolute value. A negative margin means charges exceed collected fees — a critical signal.",
      warning:
        "This margin excludes overhead costs (rent, depreciation). The actual net margin is lower than this figure.",
    },
    cost_avg_fee: {
      title: "Avg Fee / Parcel",
      meaning:
        "Average delivery fee charged per delivered parcel. Indicates tariff positioning and product mix (HD vs SD, zones).",
      formula: F.avgFee,
      source: SRC_COST,
      dimensions: ["Period (terminal date)", "Delivery type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Computed on delivered parcels only (status 13). Returns and parcels in transit do not generate accounted delivery fees.",
    },
    cost_per_delivery: {
      title: "Cost / Delivered Parcel",
      meaning:
        "Average operational cost borne per successfully delivered parcel. Enables efficiency comparison across agencies, zones, and delivery types.",
      formula: F.costPerDelivery,
      source: SRC_COST,
      dimensions: ["Period", "Delivery type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Divides total cost by the number of delivered parcels (status 13). A high cost/parcel may indicate a high return rate or a low-density zone.",
      warning:
        "Compare this figure with the avg fee/parcel to assess unit margin. If cost > fee, the delivery is loss-making.",
    },

    perf_delivery_rate: {
      title: "Delivery Rate",
      meaning:
        "Proportion of parcels successfully delivered (status 13) relative to the total parcels created over the period. Primary indicator of the network's operational quality.",
      formula: F.deliveryRate,
      source: SRC_PERF,
      dimensions: ["Period (creation date)", "Delivery type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Parcels 'in transit' (non-terminal status) are included in the denominator, which can mechanically lower the rate for very recent periods.",
      warning:
        "A rate < 73% triggers a system alert. Break down by wilaya, agency, and delivery type to pinpoint failure locations.",
    },
    perf_avg_attempts: {
      title: "Avg Attempts",
      meaning:
        "Average number of delivery attempts needed to reach 'Delivered' status. Includes the final successful attempt. A high figure indicates accessibility issues or poor client contact data.",
      formula: F.avgAttempts,
      source: SRC_PERF,
      dimensions: ["Period (creation date)", "Delivery type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Computed on delivered parcels only (status 13). `nbr_tentatives_livraison` = number of failures before delivery; +1 adds the successful attempt.",
    },
    perf_first_attempt_rate: {
      title: "1st Attempt Success",
      meaning:
        "Proportion of parcels delivered on the very first attempt, with no prior failure. Measures field efficiency and quality of client data (address, availability).",
      formula: F.firstAttemptRate,
      source: SRC_PERF,
      dimensions: ["Period (creation date)", "Delivery type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Denominator = all delivered parcels (status 13). Numerator = those where `nbr_tentatives_livraison = 0` (no failure before delivery).",
    },
    perf_avg_duration: {
      title: "Avg Delivery Duration",
      meaning:
        "Average time between parcel creation and final delivery, expressed in hours. Measures the operational velocity of the logistics circuit.",
      formula: F.avgDuration,
      source: SRC_PERF,
      dimensions: ["Period (creation date)", "Delivery type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Same as the Operations tab duration metric — computed on delivered parcels (status 13). Duration includes inter-attempt delays.",
    },
    perf_claims_count: {
      title: "Claims Declared",
      meaning:
        "Number of reimbursement claims (sinistres) opened over the period — losses, damage, unrecovered parcels. Direct measure of quality risk and indemnification cost.",
      formula: F.claimsCount,
      source: [...SRC_PERF, "dim_remboursement"],
      dimensions: ["Period (reimbursement date)", "Claim type"],
      updateFreq: "Daily — after each ETL cycle",
      calcNotes:
        "Filtered on `date_remboursement_id`. Each claim represents a potential indemnification. The breakdown chart shows causes by type.",
      warning:
        "A growing claims volume may indicate deteriorating transport conditions or packaging issues. Cross-reference with high-return zones.",
    },
  },

  // ── ARABIC ────────────────────────────────────────────────────────────────────
  ar: {
    ops_total_parcels: {
      title: "الطرود المعالجة",
      meaning:
        "العدد الإجمالي للطرود المسجلة في النظام خلال الفترة المحددة، لجميع أنواع التوصيل (التوصيل للمنزل HD وStop Desk SD). يُمثّل الحجم الخام لنشاط منصة التوصيل.",
      formula: F.totalParcels,
      source: SRC_OPS,
      dimensions: ["الفترة (تاريخ الإنشاء)", "نوع التوصيل (HD / SD)"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "يشمل جميع الحالات (مُسلَّمة، مُعادة، في الطريق، فاشلة). استخدم فلتر النوع لعزل HD أو SD.",
    },
    ops_delivered: {
      title: "الطرود المُسلَّمة",
      meaning:
        "عدد الطرود التي بلغت الحالة النهائية «مُسلَّم» (الحالة 13) خلال الفترة. مؤشر مباشر لحجم النشاط التجاري المُدرّ للإيرادات.",
      formula: F.delivered,
      source: SRC_OPS,
      dimensions: ["الفترة (تاريخ الإنشاء)", "نوع التوصيل"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "الحالة 13 وحدها تُعدّ تسليماً ناجحاً. تُستثنى الإعادات والفشل من هذا العداد.",
    },
    ops_returns: {
      title: "الإعادات",
      meaning:
        "عدد الطرود المُعادة إلى المُرسِل (الحالة 19). تُمثّل الإعادة تكلفة تشغيلية دون توليد إيراد توصيل، وتعكس عدم رضا العميل أو خطأ في العنوان.",
      formula: F.returns,
      source: SRC_OPS,
      dimensions: ["الفترة (تاريخ الإنشاء)", "نوع التوصيل"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "الحالة 19 = «مُعاد إلى المُرسِل» (حالة نهائية). لا يُخلط مع الإعادات لا تزال في الطريق.",
      warning:
        "يؤثر ارتفاع حجم الإعادات مباشرةً على الربحية. تقاطعه مع منطقة التوصيل ونوع الخدمة لتحديد المناطق عالية المخاطر.",
    },
    ops_in_transit: {
      title: "في الطريق",
      meaning:
        "عدد الطرود ذات الحالة غير النهائية (قيد المعالجة في شبكة التوصيل). يعكس الحجم الجاري معالجته في لحظة معينة.",
      formula: F.inTransit,
      source: SRC_OPS,
      dimensions: ["الفترة (تاريخ الإنشاء)", "نوع التوصيل"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "يشمل جميع الحالات حيث `is_terminal = FALSE` (مثل: في التحضير، مُشحون، في انتظار الاستلام). يتغير هذا الرقم بشكل ملحوظ حسب تاريخ الاستعلام.",
    },
    ops_avg_duration: {
      title: "متوسط مدة التوصيل",
      meaning:
        "متوسط الوقت بين إنشاء الطرد وبلوغه حالة «مُسلَّم»، معبراً عنه بالساعات. يقيس كفاءة الدائرة اللوجستية من البداية للنهاية.",
      formula: F.avgDuration,
      source: SRC_OPS,
      dimensions: ["الفترة (تاريخ الإنشاء)", "نوع التوصيل"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "يُحسب على الطرود المُسلَّمة فقط (الحالة 13). يشمل تأخيرات المعالجة والفرز والنقل ومحاولات التسليم.",
    },

    cost_fees_collected: {
      title: "الرسوم المحصَّلة",
      meaning:
        "إجمالي رسوم التوصيل المُفوترة والمحصَّلة للطرود التي بلغت حالة نهائية خلال الفترة. يُمثّل رقم أعمال قطاع توصيل الطرود.",
      formula: F.feesCollected,
      source: SRC_COST,
      dimensions: ["الفترة (تاريخ الإنهاء)", "نوع التوصيل"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "مُرشَّح على `date_terminal_id` (تاريخ حل الطرد)، لا تاريخ الإنشاء. يُعبَّر عنه بالدينار الجزائري (دج).",
    },
    cost_total_cost: {
      title: "التكلفة التشغيلية الإجمالية",
      meaning:
        "مجموع المصاريف التشغيلية المباشرة (المصاريف المُعتمدة والرواتب) المنسوبة لتوصيل الطرود خلال الفترة. أساس حساب الهامش الإجمالي.",
      formula: F.totalCost,
      source: SRC_COST,
      dimensions: ["الفترة (تاريخ المصروف)", "نوع التوصيل"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "تُدرج فقط المصاريف ذات `depense_status_id = 2` (مُعتمدة). تُستثنى التحويلات الداخلية للصندوق. عند تطبيق فلتر نوع التوصيل، يُخصَّص التكلفة بالتناسب مع الرسوم.",
    },
    cost_gross_margin: {
      title: "الهامش الإجمالي (%)",
      meaning:
        "نسبة الرسوم المحصَّلة المتبقية بعد خصم التكاليف التشغيلية المباشرة. مؤشر تركيبي لربحية خدمة التوصيل.",
      formula: F.grossMargin,
      source: SRC_COST,
      dimensions: ["الفترة", "نوع التوصيل"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "يُعبَّر عنه كنسبة مئوية، لا كقيمة مطلقة. الهامش السالب يعني أن التكاليف تتجاوز الرسوم المحصَّلة — إشارة حرجة.",
      warning:
        "يستثني هذا الهامش مصاريف الهيكل (الإيجارات، الاستهلاك). الهامش الصافي الفعلي أقل من هذا الرقم.",
    },
    cost_avg_fee: {
      title: "متوسط الرسوم / طرد",
      meaning:
        "متوسط رسوم التوصيل المُفوترة لكل طرد مُسلَّم. يُشير إلى الوضع التعريفي ومزيج المنتجات (HD مقابل SD، المناطق).",
      formula: F.avgFee,
      source: SRC_COST,
      dimensions: ["الفترة (تاريخ الإنهاء)", "نوع التوصيل"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "يُحسب على الطرود المُسلَّمة فقط (الحالة 13). لا تُولّد الإعادات والطرود في الطريق رسوم توصيل محسوبة.",
    },
    cost_per_delivery: {
      title: "التكلفة / طرد مُسلَّم",
      meaning:
        "متوسط التكلفة التشغيلية المتحمَّلة لكل طرد مُسلَّم فعلياً. يُتيح مقارنة الكفاءة بين الوكالات والمناطق وأنواع التوصيل.",
      formula: F.costPerDelivery,
      source: SRC_COST,
      dimensions: ["الفترة", "نوع التوصيل"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "يُقسِّم التكلفة الإجمالية على عدد الطرود المُسلَّمة (الحالة 13). قد تُشير التكلفة/الطرد المرتفعة إلى معدل إعادة مرتفع أو منطقة منخفضة الكثافة.",
      warning:
        "قارن هذا الرقم بمتوسط الرسوم/الطرد لتقييم الهامش الفردي. إذا كانت التكلفة > الرسوم، فالتسليم خاسر.",
    },

    perf_delivery_rate: {
      title: "معدل التسليم",
      meaning:
        "نسبة الطرود المُسلَّمة بنجاح (الحالة 13) من إجمالي الطرود المنشأة خلال الفترة. المؤشر الرئيسي لجودة الشبكة التشغيلية.",
      formula: F.deliveryRate,
      source: SRC_PERF,
      dimensions: ["الفترة (تاريخ الإنشاء)", "نوع التوصيل"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "الطرود «في الطريق» (غير نهائية) تُدرج في المقام، مما قد يُخفّض المعدل آلياً للفترات الحديثة جداً.",
      warning:
        "معدل < 73% يُطلق تنبيهاً تلقائياً. قسّمه على الولاية والوكالة ونوع التوصيل لتحديد نقاط الإخفاق.",
    },
    perf_avg_attempts: {
      title: "متوسط المحاولات",
      meaning:
        "متوسط عدد محاولات التوصيل اللازمة للوصول إلى حالة «مُسلَّم». يشمل المحاولة الأخيرة الناجحة. الرقم المرتفع يُشير إلى مشاكل إمكانية الوصول أو بيانات العميل.",
      formula: F.avgAttempts,
      source: SRC_PERF,
      dimensions: ["الفترة (تاريخ الإنشاء)", "نوع التوصيل"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "يُحسب على الطرود المُسلَّمة فقط (الحالة 13). `nbr_tentatives_livraison` = عدد الفشل قبل التسليم؛ +1 يُضيف المحاولة الناجحة.",
    },
    perf_first_attempt_rate: {
      title: "نجاح المحاولة الأولى",
      meaning:
        "نسبة الطرود المُسلَّمة من أول محاولة دون أي فشل سابق. يقيس الكفاءة الميدانية وجودة بيانات العميل (العنوان، التوفر).",
      formula: F.firstAttemptRate,
      source: SRC_PERF,
      dimensions: ["الفترة (تاريخ الإنشاء)", "نوع التوصيل"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "المقام = جميع الطرود المُسلَّمة (الحالة 13). البسط = تلك التي `nbr_tentatives_livraison = 0` (لا فشل قبل التسليم).",
    },
    perf_avg_duration: {
      title: "متوسط مدة التوصيل",
      meaning:
        "متوسط الوقت بين إنشاء الطرد والتسليم النهائي، معبراً عنه بالساعات. يقيس سرعة الدائرة اللوجستية التشغيلية.",
      formula: F.avgDuration,
      source: SRC_PERF,
      dimensions: ["الفترة (تاريخ الإنشاء)", "نوع التوصيل"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "مطابق لمؤشر المدة في تبويب العمليات — يُحسب على الطرود المُسلَّمة (الحالة 13). تشمل المدة تأخيرات ما بين المحاولات.",
    },
    perf_claims_count: {
      title: "السينيستر المُصرَّح بها",
      meaning:
        "عدد ملفات التعويض (السينيستر) المفتوحة خلال الفترة — ضياع، تلف، طرود غير مستردة. يقيس مخاطر الجودة ومصاريف التعويض.",
      formula: F.claimsCount,
      source: [...SRC_PERF, "dim_remboursement"],
      dimensions: ["الفترة (تاريخ التعويض)", "نوع السينيستر"],
      updateFreq: "يومياً — بعد كل دورة ETL",
      calcNotes:
        "مُرشَّح على `date_remboursement_id`. كل ملف يُمثّل تعويضاً محتملاً. يُوضّح رسم التوزيع الأسباب حسب النوع.",
      warning:
        "الارتفاع المتواصل في حجم السينيستر قد يُشير إلى تدهور أحوال النقل أو مشاكل التعبئة. تقاطعه مع مناطق الإعادة المرتفعة.",
    },
  },
};

export function getParcelDeliveryKpiInfo(locale: Locale): Record<ParcelDeliveryKpiKey, KpiInfo> {
  return INFO[locale] ?? INFO.fr;
}
