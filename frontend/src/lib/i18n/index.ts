import { useAuthStore } from '@/stores/authStore'

export type Locale = 'fr' | 'en' | 'ar'

// ─── Shape ───────────────────────────────────────────────────────────────────

export interface Translations {
  nav: {
    overview: string
    transport: string
    parcelCosts: string
    parcelDelivery: string
    routes: string
    alerts: string
    settings: string
    adminOverview: string
    users: string
    roles: string
    etl: string
    signOut: string
    adminSection: string
  }
  settings: {
    tabs: {
      profile: string
      preferences: string
      sessions: string
      bookmarks: string
      announcements: string
    }
    profile: {
      hrforceManagedNotice: string
      username: string
      email: string
      firstName: string
      lastName: string
      phone: string
      department: string
      company: string
      agency: string
      memberSince: string
      accessibleDashboards: string
      noDashboards: string
    }
    preferences: {
      display: string
      theme: string
      language: string
      themeDark: string
      themeLight: string
      themeSystem: string
      notifications: string
      saveButton: string
      saving: string
      saved: string
      notifInApp: string
      notifInAppDesc: string
      notifAlerts: string
      notifAlertsDesc: string
      notifEtl: string
      notifEtlDesc: string
      notifAnnouncements: string
      notifAnnouncementsDesc: string
      notifEmail: string
      notifEmailDesc: string
    }
    sessions: {
      noSessions: string
      current: string
    }
    bookmarks: {
      title: string
      new: string
      noBookmarks: string
      namePlaceholder: string
      shareTeam: string
      shared: string
      cancel: string
      save: string
    }
    announcements: {
      noAnnouncements: string
      pinned: string
    }
  }
  dashboard: {
    overview: string
    transport: string
    parcels: string
    routes: string
  }
  roles: {
    superadmin: string
    noRole: string
  }
  pages: {
    common: {
      vsLastMonth: string
      loading: string
      demoData: string
      monthAll: string
      months: [string,string,string,string,string,string,string,string,string,string,string,string]
      monthsShort: [string,string,string,string,string,string,string,string,string,string,string,string]
      infoPanel: {
        labelMeaning: string
        labelFormula: string
        labelSource: string
        labelDimensions: string
        labelUpdateFreq: string
        labelCalcNotes: string
      }
    }
    overview: {
      kpiTransportRequests:  string
      kpiPunctuality:        string
      kpiParcelHandled:      string
      kpiDeliveryRate:       string
      kpiTotalRevenue:       string
      vsLastMonth:           string
      sectionActivityTrend:  string
      sectionRevenueSplit:   string
      seriesTransport:       string
      seriesParcels:         string
      recentAlerts:          string
      viewAllAlerts:         string
      colSeverity:           string
      colAlert:              string
      colValueThreshold:     string
      colTime:               string
      colStatus:             string
    }
    transport: {
      kpiTotalRequests: string
      kpiCompletionRate: string
      kpiTotalRevenue: string
      kpiGrossMargin: string
      kpiPunctuality: string
      kpiCostPerKm: string
      kpiCancellationRate: string
      kpiAvgNote: string
      kpiAvgCostPerRequest: string
      kpiInsuranceRatio: string
      kpiAvgStops: string
      kpiAvgCostPerPiece: string
      vsPrevMonth: string
      vsLastYear: string
      demoData: string
      loading: string
      sectionRevenueCost: string
      sectionRequestsByStatus: string
      sectionCostStructure: string
      sectionCurrentPunctuality: string
      sectionPunctualityTrend: string
      sectionCostKmTrend: string
      sectionDelayDistribution: string
      sectionServiceBreakdown: string
      sectionVehicleEfficiency: string
      sectionODMatrix: string
      sectionCorridors: string
      sectionAgencyPerformance: string
      allServices: string
      dedicatedTrip: string
      courier: string
      handling: string
      colOrigin: string
      colDestination: string
      colRegion: string
      colRequests: string
      colMarginPct: string
      colAvgDist: string
      colDzdKm: string
      colRevenue: string
      colAgency: string
      colWilaya: string
      colCompletion: string
      colPunctuality: string
      colNote: string
      completedSeries: string
      inProgressSeries: string
      cancelledSeries: string
      punctualitySeries: string
      costKmSeries: string
      marginLegend: string
      costLabels: Record<string, string>
      regionOrder: [string, string, string]
      // ── Tabbed layout additions ──
      tabOperations: string
      tabCostProfit: string
      tabPerformance: string
      filterFrom: string
      filterTo: string
      kpiAvgDistance: string
      kpiTotalCost: string
      kpiMarginPct: string
      kpiAvgDuration: string
      kpiAvgDelay: string
      kpiNightShiftRate: string
      sectionMonthlyVolume: string
      sectionServicePie: string
      sectionDistanceCategory: string
      sectionRevCostTrend: string
      sectionCostCategories: string
      sectionCostPerKm: string
      sectionTopCorridors: string
      sectionOnTimeTrend: string
      sectionDelayBuckets: string
      sectionRatingDist: string
      sectionVehiclePerf: string
      seriesTerminees: string
      seriesEnCours: string
      seriesAnnulees: string
      seriesRevenue: string
      seriesCost: string
      seriesMarginPct: string
      seriesOnTimeRate: string
      seriesAvgDuration: string
      durationUnit: string
      minuteUnit: string
    }
    parcelCosts: {
      kpiParcels: string
      kpiDeliveryRate: string
      kpiFeesCollected: string
      kpiTotalCost: string
      kpiUnderTariff: string
      kpiAvgFee: string
      kpiCostPerDelivery: string
      kpiCompliance: string
      vsPrevMonth: string
      vsLastYear: string
      demoData: string
      loading: string
      sectionFeesVsCost: string
      sectionDeliveryVsCompliance: string
      sectionEcartDistribution: string
      sectionPCCSummary: string
      sectionAgencyRanking: string
      sectionCostStructure: string
      sectionCostByNature: string
      sectionAgencyQuadrant: string
      sectionAgencyScorecard: string
      sectionHDvsSD: string
      sectionDailyVolume: string
      sectionDurationDistribution: string
      sectionSinistresType: string
      sectionSinistresKPI: string
      sectionFreelance: string
      sectionParcelDetail: string
      allYear: string
      hdAndSd: string
      homeDelivery: string
      pickupPoint: string
      quadrantPerformant: string
      quadrantTariffRisk: string
      quadrantOpRisk: string
      quadrantDoubleRisk: string
      colDeliveryRate: string
      colUnderTariff: string
      colUnderTariffN: string
      colAgency: string
      colWilaya: string
      colParcels: string
      colGapTotal: string
      colGapAvg: string
      colGapPCC: string
      colGap: string
      colCostPerParcel: string
      colCostParcel: string
      colDrivers: string
      colDelivered: string
      colSuccessRate: string
      colTotalPaid: string
      colTracking: string
      colWilayaDest: string
      colType: string
      colStatus: string
      colFees: string
      colTariff: string
      colDuration: string
      deliveredSeries: string
      returnsSeries: string
      marginLegend: string
      selectMonthPrompt: string
      bubbleDesc: string
      pageOf: string
      prevPage: string
      nextPage: string
      pccWithTariff: string
      pccUnderTariff: string
      pccTotalGap: string
      pccAvgGap: string
      sinDeclared: string
      sinAmountDeclared: string
      sinRefunded: string
      sinCoverage: string
      sinAvgRefund: string
      hdDeliveryRate: string
      hdAvgFee: string
      hdAvgDuration: string
      hdReturnRate: string
      normalDay: string
      friday: string
      weekend: string
      returns: string
    }
    parcelDelivery: {
      demoData: string
      loading: string
      tabOperations: string
      tabCostProfit: string
      tabPerformance: string
      filterFrom: string
      filterTo: string
      allTypes: string
      homeDelivery: string
      pickupPoint: string
      kpiTotalParcels: string
      kpiDeliveryRate: string
      kpiReturnRate: string
      kpiFailedParcels: string
      kpiAvgDuration: string
      sectionVolumeTrend: string
      sectionStatusBreakdown: string
      sectionDeliveryTypeComp: string
      sectionZoneDist: string
      kpiFeesCollected: string
      kpiTotalCost: string
      kpiGrossMargin: string
      kpiAvgFee: string
      kpiCostPerDelivery: string
      sectionRevenueCostTrend: string
      sectionCostStructure: string
      sectionCostByNature: string
      sectionTariffGapDist: string
      sectionRegionProfit: string
      sectionZoneProfit: string
      kpiDeliveryRatePerf: string
      kpiAvgAttempts: string
      kpiFirstAttemptRate: string
      kpiAvgDurationPerf: string
      kpiClaimsCount: string
      sectionDeliveryDurationTrend: string
      sectionDurationDist: string
      sectionCenterExpeditionRanking: string
      sectionClaimsType: string
      seriesDelivered: string
      seriesReturned: string
      seriesFailed: string
      seriesInTransit: string
      sectionRegionFlow: string
      seriesRevenue: string
      seriesCost: string
      seriesDeliveryRate: string
      seriesAvgDuration: string
      hdLabel: string
      sdLabel: string
      hdDeliveryRate: string
      hdReturnRate: string
      hdAvgFee: string
      hdAvgDuration: string
      durationUnit: string
    }
    routes: {
      kpiTotalRoutes: string
      kpiAvgDistance: string
      kpiAvgCostPerKm: string
      colOrigin: string
      colDestination: string
      colDistance: string
      colAvgDuration: string
      colActualCost: string
      colOptimizedCost: string
      colSavings: string
      colEfficiency: string
      mapTitle: string
      mapDesc: string
      chartActualCost: string
      chartActualCostSub: string
      chartActualLabel: string
      chartRadar: string
      chartRadarSub: string
      chartComparison: string
      radarCostEff: string
      radarTimeEff: string
      radarVolume: string
      radarDistance: string
      radarProfitability: string
      wipTitle: string
      wipDesc: string
    }
    alerts: {
      triggeredValue: string
      threshold: string
      acknowledgedBy: string
      acknowledge: string
      optionalNote: string
      confirm: string
      alertRules: string
      cooldown: string
      ruleActive: string
      rulePaused: string
      fired: string
      allSeverity: string
      unacknowledged: string
      acknowledged: string
      noAlerts: string
      distribution: string
      metricLabels: Record<string, string>
    }
    admin: {
      title: string
      subtitle: string
      sectionUsers: string
      sectionPlatform: string
      labelTotalUsers: string
      labelActive: string
      labelNewMonth: string
      labelWithoutRole: string
      needRole: string
      inactive: string
      usersByRole: string
      labelOnline: string
      labelUnackAlerts: string
      labelUnreadNotifs: string
      labelEtlToday: string
      labelLastEtl: string
      dataFreshness: string
      fresh: string
      stale: string
      lastSuccess: string
      runs7Days: string
      successRate: string
      lastJob: string
      manageUsers: string
      manageUsersDesc: string
      manageRoles: string
      manageRolesDesc: string
      etlRuns: string
      etlRunsDesc: string
    }
    users: {
      syncHrforce: string
      exportCsv: string
      searchPlaceholder: string
      syncComplete: string
      syncFetched: string
      syncCreated: string
      syncUpdated: string
      syncSkipped: string
      syncErrors: string
      assignRole: string
      sessions: string
      activate: string
      deactivate: string
      forceLogout: string
      noSessions: string
      active: string
      inactive: string
      saveRole: string
      saving: string
      modalSessions: string
      colUser: string
      colOccupation: string
      colRole: string
      colCompany: string
      colStatus: string
      colLastLogin: string
      noUsers: string
    }
    roles: {
      newRole: string
      editRole: string
      roleKey: string
      displayName: string
      description: string
      dashboardAccess: string
      colorLabel: string
      cancel: string
      save: string
      saving: string
      deleteConfirm: string
      superadminProtected: string
      noRoles: string
      dashboardOptions: { overview: string; transport: string; parcels: string; routes: string }
    }
    etl: {
      title: string
      subtitle: string
      rows: string
      assetsMaterialized: string
      refresh: string
      noRuns: string
      statusAll: string
      statusSuccess: string
      statusFailure: string
      statusRunning: string
      statusPartial: string
      labelTotal: string
      labelSuccess: string
      labelFailed: string
      labelPartial: string
      labelAllJobs: string
    }
  }
}

// ─── French ──────────────────────────────────────────────────────────────────

const fr: Translations = {
  nav: {
    overview: 'Aperçu',
    transport: 'Transport à la demande',
    parcelCosts: 'Coûts Colis',
    parcelDelivery: 'Livraison Colis',
    routes: 'Analyse Routes',
    alerts: 'Alertes',
    settings: 'Paramètres',
    adminOverview: 'Vue Admin',
    users: 'Utilisateurs',
    roles: 'Rôles',
    etl: 'Pipelines ETL',
    signOut: 'Déconnexion',
    adminSection: 'Administration',
  },
  settings: {
    tabs: {
      profile: 'Profil',
      preferences: 'Préférences',
      sessions: 'Sessions',
      bookmarks: 'Favoris',
      announcements: 'Annonces',
    },
    profile: {
      hrforceManagedNotice: "Le profil est géré par HRForce et ne peut pas être modifié ici.",
      username: 'Identifiant',
      email: 'Email',
      firstName: 'Prénom',
      lastName: 'Nom',
      phone: 'Téléphone',
      department: 'Département',
      company: 'Entreprise',
      agency: 'Agence',
      memberSince: 'Membre depuis',
      accessibleDashboards: 'Tableaux de bord accessibles',
      noDashboards: 'Aucun tableau de bord assigné',
    },
    preferences: {
      display: 'Affichage',
      theme: 'Thème',
      language: 'Langue',
      themeDark: 'Sombre',
      themeLight: 'Clair',
      themeSystem: 'Système',
      notifications: 'Notifications',
      saveButton: 'Enregistrer les préférences',
      saving: 'Enregistrement…',
      saved: 'Enregistré !',
      notifInApp: 'Notifications in-app',
      notifInAppDesc: 'Afficher les notifications dans la plateforme',
      notifAlerts: 'Alertes KPI',
      notifAlertsDesc: 'Alertes lors du dépassement des seuils KPI',
      notifEtl: 'Statut ETL',
      notifEtlDesc: 'Notifications à la fin des pipelines de données',
      notifAnnouncements: 'Annonces',
      notifAnnouncementsDesc: "Annonces de la plateforme de l'équipe admin",
      notifEmail: 'Résumé email',
      notifEmailDesc: 'Résumé quotidien par email',
    },
    sessions: {
      noSessions: 'Aucune session trouvée.',
      current: 'Session actuelle',
    },
    bookmarks: {
      title: 'Favoris enregistrés',
      new: 'Nouveau favori',
      noBookmarks: 'Aucun favori pour le moment.',
      namePlaceholder: 'Nom du favori',
      shareTeam: "Partager avec l'équipe",
      shared: 'Partagé',
      cancel: 'Annuler',
      save: 'Sauvegarder',
    },
    announcements: {
      noAnnouncements: 'Aucune annonce active.',
      pinned: 'Épinglé',
    },
  },
  dashboard: {
    overview: 'Aperçu',
    transport: 'Transport',
    parcels: 'Coûts Colis',
    routes: 'Routes',
  },
  roles: {
    superadmin: 'Superadmin',
    noRole: 'Aucun rôle assigné',
  },
  pages: {
    common: {
      vsLastMonth: 'vs mois dernier',
      loading: 'Chargement…',
      demoData: 'Données de démonstration — backend indisponible',
      monthAll: "Toute l'année",
      months: ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'],
      monthsShort: ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'],
      infoPanel: {
        labelMeaning: 'Signification métier',
        labelFormula: 'Formule',
        labelSource: 'Tables source',
        labelDimensions: 'Dimensions / filtres',
        labelUpdateFreq: 'Fréquence de mise à jour',
        labelCalcNotes: 'Notes de calcul',
      },
    },
    overview: {
      kpiTransportRequests: 'Demandes transport',
      kpiPunctuality:       'Ponctualité transport',
      kpiParcelHandled:     'Colis traités',
      kpiDeliveryRate:      'Taux de livraison',
      kpiTotalRevenue:      "CA global",
      vsLastMonth:          'vs mois dernier',
      sectionActivityTrend: 'Activité mensuelle',
      sectionRevenueSplit:  'Répartition CA',
      seriesTransport:      'Transport',
      seriesParcels:        'Colis',
      recentAlerts:         'Alertes non acquittées',
      viewAllAlerts:        'Voir toutes les alertes →',
      colSeverity:          'Sévérité',
      colAlert:             'Alerte',
      colValueThreshold:    'Valeur / Seuil',
      colTime:              'Heure',
      colStatus:            'Statut',
    },
    transport: {
      kpiTotalRequests: 'Demandes totales',
      kpiCompletionRate: 'Taux de complétion',
      kpiTotalRevenue: 'Revenu total',
      kpiGrossMargin: 'Marge brute',
      kpiPunctuality: 'Ponctualité',
      kpiCostPerKm: 'Coût / km',
      kpiCancellationRate: 'Taux annulation',
      kpiAvgNote: 'Note client moy.',
      kpiAvgCostPerRequest: 'Coût moy. / demande',
      kpiInsuranceRatio: 'Ratio assurance',
      kpiAvgStops: 'Arrêts moy. / demande',
      kpiAvgCostPerPiece: 'Coût moy. / pièce',
      vsPrevMonth: 'vs mois précédent',
      vsLastYear: 'vs année précédente',
      demoData: 'Données de démonstration — backend indisponible',
      loading: 'Chargement…',
      sectionRevenueCost: 'Revenu vs Coût mensuel (DZD)',
      sectionRequestsByStatus: 'Volume des demandes par statut',
      sectionCostStructure: 'Structure des coûts de transport',
      sectionCurrentPunctuality: 'Ponctualité actuelle',
      sectionPunctualityTrend: 'Évolution ponctualité (%)',
      sectionCostKmTrend: 'Coût par km (DZD) — évolution mensuelle',
      sectionDelayDistribution: "Distribution des retards à l'arrivée",
      sectionServiceBreakdown: 'Répartition par type de service',
      sectionVehicleEfficiency: 'Coût/km par type de véhicule (DZD)',
      sectionODMatrix: 'Matrice Origine → Destination (demandes par région)',
      sectionCorridors: 'Top corridors (par volume)',
      sectionAgencyPerformance: 'Performance par agence',
      allServices: 'Tous les services',
      dedicatedTrip: 'Course dédiée',
      courier: 'Courrier',
      handling: 'Manutention',
      colOrigin: 'Origine',
      colDestination: 'Destination',
      colRegion: 'Région',
      colRequests: 'Demandes',
      colMarginPct: 'Marge %',
      colAvgDist: 'Dist. moy. (km)',
      colDzdKm: 'DZD/km',
      colRevenue: 'Revenu',
      colAgency: 'Agence',
      colWilaya: 'Wilaya',
      colCompletion: 'Complétion',
      colPunctuality: 'Ponctualité',
      colNote: 'Note',
      completedSeries: 'Terminées',
      inProgressSeries: 'En cours',
      cancelledSeries: 'Annulées',
      punctualitySeries: 'Ponctualité (%)',
      costKmSeries: 'Coût/km (DZD)',
      marginLegend: 'Légende marge',
      costLabels: {
        cout_base: 'Tarif de base',
        cout_distance_supp: 'Distance supp.',
        cout_assurance: 'Assurance',
        cout_carburant: 'Carburant',
        cout_manutention: 'Manutention',
        cout_autres: 'Autres',
      },
      regionOrder: ['Nord', 'Hauts Plateaux', 'Sud'],
      tabOperations: 'Opérations',
      tabCostProfit: 'Coûts & Rentabilité',
      tabPerformance: 'Performance',
      filterFrom: 'Du',
      filterTo: 'Au',
      kpiAvgDistance: 'Distance moy. (km)',
      kpiTotalCost: 'Coût total',
      kpiMarginPct: 'Marge (%)',
      kpiAvgDuration: 'Durée moy. (h)',
      kpiAvgDelay: 'Retard arrivée moy.',
      kpiNightShiftRate: 'Taux nuit',
      sectionMonthlyVolume: 'Volume mensuel — Statuts des demandes',
      sectionServicePie: 'Répartition par type de service',
      sectionDistanceCategory: 'Répartition par catégorie de distance',
      sectionRevCostTrend: 'Tendance mensuelle — Revenus vs Coûts (DZD)',
      sectionCostCategories: 'Décomposition des coûts par catégorie',
      sectionCostPerKm: 'Coût par kilomètre — par type de véhicule',
      sectionTopCorridors: 'Top 8 corridors — Marge (%)',
      sectionOnTimeTrend: 'Tendance mensuelle — Ponctualité & Durée',
      sectionDelayBuckets: 'Distribution des retards à l\'arrivée',
      sectionRatingDist: 'Distribution des notes clients',
      sectionVehiclePerf: 'Ponctualité par type de véhicule',
      seriesTerminees: 'Terminées',
      seriesEnCours: 'En cours',
      seriesAnnulees: 'Annulées',
      seriesRevenue: 'Revenus',
      seriesCost: 'Coût',
      seriesMarginPct: 'Marge (%)',
      seriesOnTimeRate: 'Ponctualité (%)',
      seriesAvgDuration: 'Durée moy. (h)',
      durationUnit: 'h',
      minuteUnit: 'min',
    },
    parcelCosts: {
      kpiParcels: 'Colis traités',
      kpiDeliveryRate: 'Taux de livraison',
      kpiFeesCollected: 'Frais collectés',
      kpiTotalCost: 'Coût total',
      kpiUnderTariff: 'Taux sous-tarif (PCC)',
      kpiAvgFee: 'Frais moy. / colis',
      kpiCostPerDelivery: 'Coût / colis livré',
      kpiCompliance: 'Conformité tarifaire',
      vsPrevMonth: 'vs mois précédent',
      vsLastYear: 'vs année précédente',
      demoData: 'Données de démonstration — backend indisponible',
      loading: 'Chargement…',
      sectionFeesVsCost: 'Frais collectés vs Coût total (DZD)',
      sectionDeliveryVsCompliance: 'Taux de livraison vs Taux sous-tarif (%)',
      sectionEcartDistribution: 'Distribution des écarts tarifaires (PCC)',
      sectionPCCSummary: 'PCC — Résumé de conformité',
      sectionAgencyRanking: 'Classement des agences — Conformité PCC (pires en premier)',
      sectionCostStructure: 'Structure des coûts',
      sectionCostByNature: 'Dépenses par nature (DZD)',
      sectionAgencyQuadrant: 'Quadrant Agences — Livraison vs Conformité tarifaire',
      sectionAgencyScorecard: 'Scorecard agences — Performance & coûts colis',
      sectionHDvsSD: 'Comparaison HD vs SD',
      sectionDailyVolume: 'Volume quotidien',
      sectionDurationDistribution: 'Distribution des délais de livraison',
      sectionSinistresType: 'Sinistres — Répartition par type',
      sectionSinistresKPI: 'Sinistres — KPIs',
      sectionFreelance: 'Livreurs freelance — Résumé opérationnel',
      sectionParcelDetail: 'Détail colis',
      allYear: "Toute l'année",
      hdAndSd: 'HD + SD',
      homeDelivery: 'Domicile (HD)',
      pickupPoint: 'Stop Desk (SD)',
      quadrantPerformant: 'Performant',
      quadrantTariffRisk: 'Risque tarifaire',
      quadrantOpRisk: 'Risque opérationnel',
      quadrantDoubleRisk: 'Double risque',
      colDeliveryRate: 'Taux de livraison (%)',
      colUnderTariff: 'Sous-tarif %',
      colUnderTariffN: 'Sous-tarif',
      colAgency: 'Agence',
      colWilaya: 'Wilaya',
      colParcels: 'Colis',
      colGapTotal: 'Écart total',
      colGapAvg: 'Écart moy.',
      colGapPCC: 'Écart PCC',
      colGap: 'Écart',
      colCostPerParcel: 'Coût/colis livré',
      colCostParcel: 'Coût/colis',
      colDrivers: 'Livreurs',
      colDelivered: 'Colis livrés',
      colSuccessRate: 'Taux succès',
      colTotalPaid: 'Total payé',
      colTracking: 'Tracking',
      colWilayaDest: 'Wilaya dest.',
      colType: 'Type',
      colStatus: 'Statut',
      colFees: 'Frais perçus',
      colTariff: 'Tarif théo.',
      colDuration: 'Durée',
      deliveredSeries: 'Livrés',
      returnsSeries: 'Retours',
      marginLegend: 'Légende marge',
      selectMonthPrompt: 'Sélectionnez un mois pour afficher le détail des colis et les histogrammes',
      bubbleDesc: 'Bulle = volume de colis · Seuils : livraison 73%, sous-tarif 24%',
      pageOf: 'page',
      prevPage: '← Précédent',
      nextPage: 'Suivant →',
      pccWithTariff: 'Colis avec tarif théorique',
      pccUnderTariff: 'Sous-tarif (pertes)',
      pccTotalGap: 'Écart total',
      pccAvgGap: 'Écart moyen / colis',
      sinDeclared: 'Sinistres déclarés',
      sinAmountDeclared: 'Montant déclaré',
      sinRefunded: 'Montant remboursé',
      sinCoverage: 'Taux de couverture',
      sinAvgRefund: 'Remboursement moyen',
      hdDeliveryRate: 'Taux livraison',
      hdAvgFee: 'Frais moy.',
      hdAvgDuration: 'Durée moy. livr.',
      hdReturnRate: 'Taux retour',
      normalDay: 'Jour normal',
      friday: 'Vendredi',
      weekend: 'Weekend',
      returns: 'Retours',
    },
    parcelDelivery: {
      demoData: 'Données de démonstration — backend indisponible',
      loading: 'Chargement…',
      tabOperations: 'Opérations',
      tabCostProfit: 'Coûts & Rentabilité',
      tabPerformance: 'Performance',
      filterFrom: 'Du',
      filterTo: 'Au',
      allTypes: 'HD + SD',
      homeDelivery: 'Domicile (HD)',
      pickupPoint: 'Stop Desk (SD)',
      kpiTotalParcels: 'Colis traités',
      kpiDeliveryRate: 'Colis livrés',
      kpiReturnRate: 'Retours',
      kpiFailedParcels: 'En transit',
      kpiAvgDuration: 'Durée moy. livraison',
      sectionVolumeTrend: 'Volume quotidien — Livrés, Retours & En transit',
      sectionStatusBreakdown: 'Répartition par statut',
      sectionDeliveryTypeComp: 'Flux régional — Origine × Destination',
      sectionZoneDist: 'Distribution par zone de livraison',
      kpiFeesCollected: 'Frais collectés',
      kpiTotalCost: 'Coût opérationnel total',
      kpiGrossMargin: 'Marge brute',
      kpiAvgFee: 'Frais moy. / colis',
      kpiCostPerDelivery: 'Coût / colis livré',
      sectionRevenueCostTrend: 'Frais collectés vs Coût total (DZD)',
      sectionCostStructure: 'Structure des coûts opérationnels',
      sectionCostByNature: 'Dépenses par nature (DZD)',
      sectionTariffGapDist: 'Distribution des écarts tarifaires (PCC)',
      sectionRegionProfit: 'Flux régional — Marge par trajet (DZD)',
      sectionZoneProfit: 'Rentabilité par zone de livraison',
      kpiDeliveryRatePerf: 'Taux de livraison',
      kpiAvgAttempts: 'Tentatives moy.',
      kpiFirstAttemptRate: 'Succès 1ère tentative',
      kpiAvgDurationPerf: 'Durée moy. livraison',
      kpiClaimsCount: 'Sinistres déclarés',
      sectionDeliveryDurationTrend: 'Performance mensuelle — Livraison & Durée',
      sectionDurationDist: 'Distribution des délais de livraison',
      sectionCenterExpeditionRanking: 'Top 8 centres — Expéditions (colis envoyés)',
      sectionClaimsType: 'Sinistres — Répartition par type',
      seriesDelivered: 'Livrés',
      seriesReturned: 'Retours',
      seriesFailed: 'Échecs',
      seriesInTransit: 'En transit',
      sectionRegionFlow: 'Flux régional — Origine × Destination',
      seriesRevenue: 'Frais collectés',
      seriesCost: 'Coût total',
      seriesDeliveryRate: 'Taux livraison (%)',
      seriesAvgDuration: 'Durée moy. (h)',
      hdLabel: 'Domicile (HD)',
      sdLabel: 'Stop Desk (SD)',
      hdDeliveryRate: 'Taux livraison',
      hdReturnRate: 'Taux retour',
      hdAvgFee: 'Frais moy.',
      hdAvgDuration: 'Durée moy.',
      durationUnit: 'h',
    },
    routes: {
      kpiTotalRoutes: 'Total Routes',
      kpiAvgDistance: 'Distance moy.',
      kpiAvgCostPerKm: 'Coût moy. / KM',
      colOrigin: 'Origine',
      colDestination: 'Destination',
      colDistance: 'Distance (km)',
      colAvgDuration: 'Durée moy.',
      colActualCost: 'Coût réel',
      colOptimizedCost: 'Coût optimisé',
      colSavings: 'Économies',
      colEfficiency: 'Efficacité',
      mapTitle: 'Carte des routes — Algérie',
      mapDesc: 'Vert = haute efficacité (>90%) | Ambré = modérée (80–90%) | Rouge = faible (<80%)',
      chartActualCost: 'Coût réel par route',
      chartActualCostSub: 'Barre principale = coût réel. Comparez les économies potentielles par route.',
      chartActualLabel: 'Coût réel (DZD)',
      chartRadar: 'Performance route — Alger → Oran',
      chartRadarSub: 'Radar de performance multi-dimensionnel pour la route à plus fort volume.',
      chartComparison: 'Comparaison des routes',
      radarCostEff: 'Efficacité coût',
      radarTimeEff: 'Efficacité temps',
      radarVolume: 'Volume',
      radarDistance: 'Distance',
      radarProfitability: 'Rentabilité',
      wipTitle: 'En cours de développement',
      wipDesc: 'Cette page utilise actuellement des données de démonstration. Les analyses de routes réelles seront disponibles prochainement.',
    },
    alerts: {
      triggeredValue: 'Valeur déclenchée',
      threshold: 'Seuil',
      acknowledgedBy: 'Confirmé par',
      acknowledge: 'Confirmer',
      optionalNote: 'Note optionnelle…',
      confirm: 'Confirmer',
      alertRules: "Règles d'alerte",
      cooldown: 'délai de récupération',
      ruleActive: 'Actif',
      rulePaused: 'Suspendu',
      fired: '× déclenché',
      allSeverity: 'Tous',
      unacknowledged: 'Non confirmés',
      acknowledged: 'Confirmés',
      noAlerts: 'Aucune alerte.',
      distribution: 'Distribution par sévérité',
      metricLabels: {
        ecart_tarif_pct: 'Écart tarif (%)',
        taux_livraison_pct: 'Taux de livraison (%)',
        transport_cost_dzd: 'Coût transport (DZD)',
        nbr_sous_tarif: 'Colis sous-tarif',
        marge_brute_transport_pct: 'Marge brute transport (%)',
        nbr_livraisons_jour: 'Livraisons journalières',
      },
    },
    admin: {
      title: 'Vue Admin',
      subtitle: 'Santé de la plateforme et résumé opérationnel',
      sectionUsers: 'Utilisateurs',
      sectionPlatform: 'Plateforme',
      labelTotalUsers: 'Total utilisateurs',
      labelActive: 'Actifs',
      labelNewMonth: 'Nouveaux ce mois',
      labelWithoutRole: 'Sans rôle',
      needRole: 'Attribution de rôle requise',
      inactive: 'inactifs',
      usersByRole: 'Utilisateurs par rôle',
      labelOnline: 'Utilisateurs en ligne',
      labelUnackAlerts: 'Alertes non confirmées',
      labelUnreadNotifs: 'Notifications non lues',
      labelEtlToday: "Pipelines ETL aujourd'hui",
      labelLastEtl: 'Dernier :',
      dataFreshness: 'Fraîcheur des données',
      fresh: 'À jour',
      stale: 'Périmé',
      lastSuccess: 'Dernière exécution réussie',
      runs7Days: 'Exécutions (7 derniers jours)',
      successRate: 'Taux de succès',
      lastJob: 'Dernier pipeline',
      manageUsers: 'Gérer les utilisateurs',
      manageUsersDesc: 'Activer, assigner des rôles, déconnecter',
      manageRoles: 'Gérer les rôles',
      manageRolesDesc: 'Créer et modifier les rôles opérationnels',
      etlRuns: 'Pipelines ETL',
      etlRunsDesc: "Voir l'historique et le statut des pipelines",
    },
    users: {
      syncHrforce: 'Sync HRForce',
      exportCsv: 'Exporter CSV',
      searchPlaceholder: 'Rechercher des utilisateurs…',
      syncComplete: 'Synchronisation HRForce terminée',
      syncFetched: 'utilisateurs récupérés',
      syncCreated: 'créés',
      syncUpdated: 'mis à jour',
      syncSkipped: 'inchangés',
      syncErrors: 'erreurs',
      assignRole: 'Assigner un rôle',
      sessions: 'Sessions',
      activate: 'Activer',
      deactivate: 'Désactiver',
      forceLogout: 'Déconnexion forcée',
      noSessions: 'Aucune session active.',
      active: 'Actif',
      inactive: 'Inactif',
      saveRole: 'Enregistrer le rôle',
      saving: 'Enregistrement…',
      modalSessions: 'Sessions actives',
      colUser: 'Utilisateur',
      colOccupation: 'Poste',
      colRole: 'Rôle',
      colCompany: 'Entreprise',
      colStatus: 'Statut',
      colLastLogin: 'Dernière connexion',
      noUsers: 'Aucun utilisateur trouvé',
    },
    roles: {
      newRole: 'Nouveau rôle',
      editRole: 'Modifier le rôle',
      roleKey: 'Clé du rôle (snake_case, unique)',
      displayName: "Nom d'affichage",
      description: 'Description',
      dashboardAccess: 'Accès aux tableaux de bord',
      colorLabel: 'Couleur',
      cancel: 'Annuler',
      save: 'Enregistrer',
      saving: 'Enregistrement…',
      deleteConfirm: 'Supprimer ce rôle ?',
      superadminProtected: 'Protégé — ne peut pas être modifié',
      noRoles: 'Aucun rôle.',
      dashboardOptions: { overview: 'Aperçu', transport: 'Transport', parcels: 'Coûts Colis', routes: 'Analyse Routes' },
    },
    etl: {
      title: 'Historique ETL',
      subtitle: "Historique des exécutions et fraîcheur des données",
      rows: 'lignes',
      assetsMaterialized: 'Assets matérialisés',
      refresh: 'Actualiser',
      noRuns: 'Aucun pipeline ETL trouvé.',
      statusAll: 'Tous les statuts',
      statusSuccess: 'Succès',
      statusFailure: 'Échec',
      statusRunning: 'En cours',
      statusPartial: 'Annulé',
      labelTotal: 'Total',
      labelSuccess: 'Succès',
      labelFailed: 'Échec',
      labelPartial: 'Annulé',
      labelAllJobs: 'Tous les jobs',
    },
  },
}

// ─── English ─────────────────────────────────────────────────────────────────

const en: Translations = {
  nav: {
    overview: 'Overview',
    transport: 'On-demand Transport',
    parcelCosts: 'Parcel Costs',
    parcelDelivery: 'Parcel Delivery',
    routes: 'Route Analysis',
    alerts: 'Alerts',
    settings: 'Settings',
    adminOverview: 'Admin Overview',
    users: 'Users',
    roles: 'Roles',
    etl: 'ETL Runs',
    signOut: 'Sign out',
    adminSection: 'Admin',
  },
  settings: {
    tabs: {
      profile: 'Profile',
      preferences: 'Preferences',
      sessions: 'Sessions',
      bookmarks: 'Bookmarks',
      announcements: 'Announcements',
    },
    profile: {
      hrforceManagedNotice: 'Profile is managed by HRForce and cannot be edited here.',
      username: 'Username',
      email: 'Email',
      firstName: 'First Name',
      lastName: 'Last Name',
      phone: 'Phone',
      department: 'Department',
      company: 'Company',
      agency: 'Agency',
      memberSince: 'Member since',
      accessibleDashboards: 'Accessible Dashboards',
      noDashboards: 'No dashboards assigned',
    },
    preferences: {
      display: 'Display',
      theme: 'Theme',
      language: 'Language',
      themeDark: 'Dark',
      themeLight: 'Light',
      themeSystem: 'System',
      notifications: 'Notification Channels',
      saveButton: 'Save Preferences',
      saving: 'Saving…',
      saved: 'Saved!',
      notifInApp: 'In-App Notifications',
      notifInAppDesc: 'Show notifications inside the platform',
      notifAlerts: 'Alert Notifications',
      notifAlertsDesc: 'In-app alerts when KPI thresholds are breached',
      notifEtl: 'ETL Status',
      notifEtlDesc: 'Notify when data pipelines complete or fail',
      notifAnnouncements: 'Announcements',
      notifAnnouncementsDesc: 'Platform announcements from the admin team',
      notifEmail: 'Email Digest',
      notifEmailDesc: 'Daily summary via email',
    },
    sessions: {
      noSessions: 'No sessions found.',
      current: 'Current',
    },
    bookmarks: {
      title: 'Saved Bookmarks',
      new: 'New Bookmark',
      noBookmarks: 'No bookmarks yet.',
      namePlaceholder: 'Bookmark name',
      shareTeam: 'Share with team',
      shared: 'Shared',
      cancel: 'Cancel',
      save: 'Save',
    },
    announcements: {
      noAnnouncements: 'No active announcements.',
      pinned: 'Pinned',
    },
  },
  dashboard: {
    overview: 'Overview',
    transport: 'Transport',
    parcels: 'Parcel Costs',
    routes: 'Routes',
  },
  roles: {
    superadmin: 'Superadmin',
    noRole: 'No role assigned',
  },
  pages: {
    common: {
      vsLastMonth: 'vs last month',
      loading: 'Loading…',
      demoData: 'Demo data — backend unavailable',
      monthAll: 'All year',
      months: ['January','February','March','April','May','June','July','August','September','October','November','December'],
      monthsShort: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
      infoPanel: {
        labelMeaning: 'Business Meaning',
        labelFormula: 'Formula',
        labelSource: 'Source Tables',
        labelDimensions: 'Dimensions / Filters',
        labelUpdateFreq: 'Update Frequency',
        labelCalcNotes: 'Calculation Notes',
      },
    },
    overview: {
      kpiTransportRequests: 'Transport Requests',
      kpiPunctuality:       'Transport Punctuality',
      kpiParcelHandled:     'Parcels Handled',
      kpiDeliveryRate:      'Delivery Rate',
      kpiTotalRevenue:      'Total Revenue',
      vsLastMonth:          'vs last month',
      sectionActivityTrend: 'Monthly Activity',
      sectionRevenueSplit:  'Revenue Split',
      seriesTransport:      'Transport',
      seriesParcels:        'Parcels',
      recentAlerts:         'Unacknowledged Alerts',
      viewAllAlerts:        'View all alerts →',
      colSeverity:          'Severity',
      colAlert:             'Alert',
      colValueThreshold:    'Value / Threshold',
      colTime:              'Time',
      colStatus:            'Status',
    },
    transport: {
      kpiTotalRequests: 'Total Requests',
      kpiCompletionRate: 'Completion Rate',
      kpiTotalRevenue: 'Total Revenue',
      kpiGrossMargin: 'Gross Margin',
      kpiPunctuality: 'Punctuality',
      kpiCostPerKm: 'Cost / km',
      kpiCancellationRate: 'Cancellation Rate',
      kpiAvgNote: 'Avg. Rating',
      kpiAvgCostPerRequest: 'Avg Cost / Request',
      kpiInsuranceRatio: 'Insurance Ratio',
      kpiAvgStops: 'Avg Stops / Request',
      kpiAvgCostPerPiece: 'Avg Cost / Piece',
      vsPrevMonth: 'vs previous month',
      vsLastYear: 'vs previous year',
      demoData: 'Demo data — backend unavailable',
      loading: 'Loading…',
      sectionRevenueCost: 'Revenue vs Monthly Cost (DZD)',
      sectionRequestsByStatus: 'Request Volume by Status',
      sectionCostStructure: 'Transport Cost Structure',
      sectionCurrentPunctuality: 'Current Punctuality',
      sectionPunctualityTrend: 'Punctuality Trend (%)',
      sectionCostKmTrend: 'Cost per km (DZD) — Monthly Trend',
      sectionDelayDistribution: 'Arrival Delay Distribution',
      sectionServiceBreakdown: 'Breakdown by Service Type',
      sectionVehicleEfficiency: 'Cost/km by Vehicle Type (DZD)',
      sectionODMatrix: 'Origin → Destination Matrix (requests by region)',
      sectionCorridors: 'Top Corridors (by volume)',
      sectionAgencyPerformance: 'Agency Performance',
      allServices: 'All services',
      dedicatedTrip: 'Dedicated trip',
      courier: 'Courier',
      handling: 'Handling',
      colOrigin: 'Origin',
      colDestination: 'Destination',
      colRegion: 'Region',
      colRequests: 'Requests',
      colMarginPct: 'Margin %',
      colAvgDist: 'Avg. Dist. (km)',
      colDzdKm: 'DZD/km',
      colRevenue: 'Revenue',
      colAgency: 'Agency',
      colWilaya: 'Wilaya',
      colCompletion: 'Completion',
      colPunctuality: 'Punctuality',
      colNote: 'Rating',
      completedSeries: 'Completed',
      inProgressSeries: 'In Progress',
      cancelledSeries: 'Cancelled',
      punctualitySeries: 'Punctuality (%)',
      costKmSeries: 'Cost/km (DZD)',
      marginLegend: 'Margin Legend',
      costLabels: {
        cout_base: 'Base Rate',
        cout_distance_supp: 'Extra Distance',
        cout_assurance: 'Insurance',
        cout_carburant: 'Fuel',
        cout_manutention: 'Handling',
        cout_autres: 'Other',
      },
      regionOrder: ['Nord', 'Hauts Plateaux', 'Sud'],
      tabOperations: 'Operations',
      tabCostProfit: 'Cost & Profitability',
      tabPerformance: 'Performance',
      filterFrom: 'From',
      filterTo: 'To',
      kpiAvgDistance: 'Avg Distance (km)',
      kpiTotalCost: 'Total Cost',
      kpiMarginPct: 'Margin (%)',
      kpiAvgDuration: 'Avg Duration (h)',
      kpiAvgDelay: 'Avg Arrival Delay',
      kpiNightShiftRate: 'Night Shift Rate',
      sectionMonthlyVolume: 'Monthly Volume — Request Status',
      sectionServicePie: 'Breakdown by Service Type',
      sectionDistanceCategory: 'Breakdown by Distance Category',
      sectionRevCostTrend: 'Monthly Trend — Revenue vs Cost (DZD)',
      sectionCostCategories: 'Cost Breakdown by Category',
      sectionCostPerKm: 'Cost per Kilometre — by Vehicle Type',
      sectionTopCorridors: 'Top 8 Corridors — Margin (%)',
      sectionOnTimeTrend: 'Monthly Trend — On-Time Rate & Duration',
      sectionDelayBuckets: 'Arrival Delay Distribution',
      sectionRatingDist: 'Client Rating Distribution',
      sectionVehiclePerf: 'On-Time Rate by Vehicle Type',
      seriesTerminees: 'Completed',
      seriesEnCours: 'In Progress',
      seriesAnnulees: 'Cancelled',
      seriesRevenue: 'Revenue',
      seriesCost: 'Cost',
      seriesMarginPct: 'Margin (%)',
      seriesOnTimeRate: 'On-Time Rate (%)',
      seriesAvgDuration: 'Avg Duration (h)',
      durationUnit: 'h',
      minuteUnit: 'min',
    },
    parcelCosts: {
      kpiParcels: 'Processed Parcels',
      kpiDeliveryRate: 'Delivery Rate',
      kpiFeesCollected: 'Fees Collected',
      kpiTotalCost: 'Total Cost',
      kpiUnderTariff: 'Under-Tariff Rate (PCC)',
      kpiAvgFee: 'Avg Fee / Parcel',
      kpiCostPerDelivery: 'Cost / Delivered',
      kpiCompliance: 'Tariff Compliance',
      vsPrevMonth: 'vs previous month',
      vsLastYear: 'vs previous year',
      demoData: 'Demo data — backend unavailable',
      loading: 'Loading…',
      sectionFeesVsCost: 'Fees Collected vs Total Cost (DZD)',
      sectionDeliveryVsCompliance: 'Delivery Rate vs Under-Tariff Rate (%)',
      sectionEcartDistribution: 'Tariff Gap Distribution (PCC)',
      sectionPCCSummary: 'PCC — Compliance Summary',
      sectionAgencyRanking: 'Agency Ranking — PCC Compliance (worst first)',
      sectionCostStructure: 'Cost Structure',
      sectionCostByNature: 'Expenses by Nature (DZD)',
      sectionAgencyQuadrant: 'Agency Quadrant — Delivery vs Tariff Compliance',
      sectionAgencyScorecard: 'Agency Scorecard — Performance & Parcel Costs',
      sectionHDvsSD: 'HD vs SD Comparison',
      sectionDailyVolume: 'Daily Volume',
      sectionDurationDistribution: 'Delivery Duration Distribution',
      sectionSinistresType: 'Claims — Breakdown by Type',
      sectionSinistresKPI: 'Claims — KPIs',
      sectionFreelance: 'Freelance Drivers — Operational Summary',
      sectionParcelDetail: 'Parcel Detail',
      allYear: 'All year',
      hdAndSd: 'HD + SD',
      homeDelivery: 'Home Delivery (HD)',
      pickupPoint: 'Stop Desk (SD)',
      quadrantPerformant: 'Performant',
      quadrantTariffRisk: 'Tariff Risk',
      quadrantOpRisk: 'Operational Risk',
      quadrantDoubleRisk: 'Double Risk',
      colDeliveryRate: 'Delivery Rate (%)',
      colUnderTariff: 'Under-Tariff %',
      colUnderTariffN: 'Under-Tariff',
      colAgency: 'Agency',
      colWilaya: 'Wilaya',
      colParcels: 'Parcels',
      colGapTotal: 'Total Gap',
      colGapAvg: 'Avg Gap',
      colGapPCC: 'PCC Gap',
      colGap: 'Gap',
      colCostPerParcel: 'Cost/Delivered',
      colCostParcel: 'Cost/Parcel',
      colDrivers: 'Drivers',
      colDelivered: 'Delivered',
      colSuccessRate: 'Success Rate',
      colTotalPaid: 'Total Paid',
      colTracking: 'Tracking',
      colWilayaDest: 'Dest. Wilaya',
      colType: 'Type',
      colStatus: 'Status',
      colFees: 'Fees Collected',
      colTariff: 'Theor. Tariff',
      colDuration: 'Duration',
      deliveredSeries: 'Delivered',
      returnsSeries: 'Returns',
      marginLegend: 'Margin Legend',
      selectMonthPrompt: 'Select a month to display parcel details and histograms',
      bubbleDesc: 'Bubble = parcel volume · Thresholds: delivery 73%, under-tariff 24%',
      pageOf: 'page',
      prevPage: '← Previous',
      nextPage: 'Next →',
      pccWithTariff: 'Parcels with theoretical tariff',
      pccUnderTariff: 'Under-tariff (losses)',
      pccTotalGap: 'Total gap',
      pccAvgGap: 'Avg gap / parcel',
      sinDeclared: 'Declared claims',
      sinAmountDeclared: 'Amount declared',
      sinRefunded: 'Amount refunded',
      sinCoverage: 'Coverage rate',
      sinAvgRefund: 'Avg refund',
      hdDeliveryRate: 'Delivery rate',
      hdAvgFee: 'Avg fee',
      hdAvgDuration: 'Avg delivery time',
      hdReturnRate: 'Return rate',
      normalDay: 'Normal day',
      friday: 'Friday',
      weekend: 'Weekend',
      returns: 'Returns',
    },
    parcelDelivery: {
      demoData: 'Demo data — backend unavailable',
      loading: 'Loading…',
      tabOperations: 'Operations',
      tabCostProfit: 'Cost & Profitability',
      tabPerformance: 'Performance',
      filterFrom: 'From',
      filterTo: 'To',
      allTypes: 'HD + SD',
      homeDelivery: 'Home Delivery (HD)',
      pickupPoint: 'Stop Desk (SD)',
      kpiTotalParcels: 'Parcels Handled',
      kpiDeliveryRate: 'Delivered Parcels',
      kpiReturnRate: 'Returns',
      kpiFailedParcels: 'In Transit',
      kpiAvgDuration: 'Avg Delivery Duration',
      sectionVolumeTrend: 'Daily Volume — Delivered, Returns & In Transit',
      sectionStatusBreakdown: 'Parcel Status Breakdown',
      sectionDeliveryTypeComp: 'Regional Flow — Origin × Destination',
      sectionZoneDist: 'Distribution by Delivery Zone',
      kpiFeesCollected: 'Fees Collected',
      kpiTotalCost: 'Total Operational Cost',
      kpiGrossMargin: 'Gross Margin',
      kpiAvgFee: 'Avg Fee / Parcel',
      kpiCostPerDelivery: 'Cost / Delivered Parcel',
      sectionRevenueCostTrend: 'Fees Collected vs Total Cost (DZD)',
      sectionCostStructure: 'Operational Cost Structure',
      sectionCostByNature: 'Expenses by Category (DZD)',
      sectionTariffGapDist: 'Tariff Gap Distribution (PCC)',
      sectionRegionProfit: 'Regional Flow — Margin by Route (DZD)',
      sectionZoneProfit: 'Profitability by Delivery Zone',
      kpiDeliveryRatePerf: 'Delivery Rate',
      kpiAvgAttempts: 'Avg Attempts',
      kpiFirstAttemptRate: '1st Attempt Success',
      kpiAvgDurationPerf: 'Avg Delivery Duration',
      kpiClaimsCount: 'Claims Declared',
      sectionDeliveryDurationTrend: 'Monthly Performance — Delivery & Duration',
      sectionDurationDist: 'Delivery Duration Distribution',
      sectionCenterExpeditionRanking: 'Top 8 Centers — Expeditions (parcels sent)',
      sectionClaimsType: 'Claims — Breakdown by Type',
      seriesDelivered: 'Delivered',
      seriesReturned: 'Returns',
      seriesFailed: 'Failed',
      seriesInTransit: 'In Transit',
      sectionRegionFlow: 'Regional Flow — Origin × Destination',
      seriesRevenue: 'Fees Collected',
      seriesCost: 'Total Cost',
      seriesDeliveryRate: 'Delivery Rate (%)',
      seriesAvgDuration: 'Avg Duration (h)',
      hdLabel: 'Home Delivery (HD)',
      sdLabel: 'Stop Desk (SD)',
      hdDeliveryRate: 'Delivery rate',
      hdReturnRate: 'Return rate',
      hdAvgFee: 'Avg fee',
      hdAvgDuration: 'Avg duration',
      durationUnit: 'h',
    },
    routes: {
      kpiTotalRoutes: 'Total Routes',
      kpiAvgDistance: 'Avg Distance',
      kpiAvgCostPerKm: 'Avg Cost / KM',
      colOrigin: 'Origin',
      colDestination: 'Destination',
      colDistance: 'Distance (km)',
      colAvgDuration: 'Avg Duration',
      colActualCost: 'Actual Cost',
      colOptimizedCost: 'Optimized Cost',
      colSavings: 'Savings',
      colEfficiency: 'Efficiency',
      mapTitle: 'Route Map — Algeria',
      mapDesc: 'Green = high efficiency (>90%) | Amber = moderate (80–90%) | Red = low (<80%)',
      chartActualCost: 'Actual Cost by Route',
      chartActualCostSub: 'Primary bar = actual cost. Compare savings potential per route.',
      chartActualLabel: 'Actual Cost (DZD)',
      chartRadar: 'Route Performance — Algiers → Oran',
      chartRadarSub: 'Multi-dimensional performance radar for the top-volume route.',
      chartComparison: 'Route Comparison',
      radarCostEff: 'Cost Efficiency',
      radarTimeEff: 'Time Efficiency',
      radarVolume: 'Volume',
      radarDistance: 'Distance',
      radarProfitability: 'Profitability',
      wipTitle: 'Under Development',
      wipDesc: 'This page currently uses demo data. Real route analytics will be available soon.',
    },
    alerts: {
      triggeredValue: 'Triggered value',
      threshold: 'Threshold',
      acknowledgedBy: 'Acknowledged by',
      acknowledge: 'Acknowledge',
      optionalNote: 'Optional note…',
      confirm: 'Confirm',
      alertRules: 'Alert Rules',
      cooldown: 'cooldown',
      ruleActive: 'Active',
      rulePaused: 'Paused',
      fired: '× fired',
      allSeverity: 'All',
      unacknowledged: 'Unacknowledged',
      acknowledged: 'Acknowledged',
      noAlerts: 'No alerts match.',
      distribution: 'Severity Distribution',
      metricLabels: {
        ecart_tarif_pct: 'Tariff Deviation (%)',
        taux_livraison_pct: 'Delivery Success Rate (%)',
        transport_cost_dzd: 'Transport Cost (DZD)',
        nbr_sous_tarif: 'Under-Tariff Parcels',
        marge_brute_transport_pct: 'Transport Gross Margin (%)',
        nbr_livraisons_jour: 'Daily Deliveries',
      },
    },
    admin: {
      title: 'Admin Overview',
      subtitle: 'Platform health and operational summary',
      sectionUsers: 'Users',
      sectionPlatform: 'Platform',
      labelTotalUsers: 'Total Users',
      labelActive: 'Active',
      labelNewMonth: 'New This Month',
      labelWithoutRole: 'Without Role',
      needRole: 'Need role assignment',
      inactive: 'inactive',
      usersByRole: 'Users by Role',
      labelOnline: 'Users Online Now',
      labelUnackAlerts: 'Unacknowledged Alerts',
      labelUnreadNotifs: 'Unread Notifications',
      labelEtlToday: 'ETL Runs Today',
      labelLastEtl: 'Last:',
      dataFreshness: 'Data Freshness',
      fresh: 'Fresh',
      stale: 'Stale',
      lastSuccess: 'Last successful run',
      runs7Days: 'Runs (last 7 days)',
      successRate: 'Success rate',
      lastJob: 'Last job',
      manageUsers: 'Manage Users',
      manageUsersDesc: 'Activate, assign roles, force logout',
      manageRoles: 'Manage Roles',
      manageRolesDesc: 'Create and edit operational roles',
      etlRuns: 'ETL Runs',
      etlRunsDesc: 'View pipeline history and status',
    },
    users: {
      syncHrforce: 'Sync HRForce',
      exportCsv: 'Export CSV',
      searchPlaceholder: 'Search users…',
      syncComplete: 'HRForce sync complete',
      syncFetched: 'users fetched',
      syncCreated: 'created',
      syncUpdated: 'updated',
      syncSkipped: 'unchanged',
      syncErrors: 'errors',
      assignRole: 'Assign Role',
      sessions: 'Sessions',
      activate: 'Activate',
      deactivate: 'Deactivate',
      forceLogout: 'Force Logout',
      noSessions: 'No active sessions.',
      active: 'Active',
      inactive: 'Inactive',
      saveRole: 'Save Role',
      saving: 'Saving…',
      modalSessions: 'Active Sessions',
      colUser: 'User',
      colOccupation: 'Occupation',
      colRole: 'Role',
      colCompany: 'Company',
      colStatus: 'Status',
      colLastLogin: 'Last Login',
      noUsers: 'No users found',
    },
    roles: {
      newRole: 'New Role',
      editRole: 'Edit Role',
      roleKey: 'Role Key (snake_case, unique)',
      displayName: 'Display Name',
      description: 'Description',
      dashboardAccess: 'Dashboard Access',
      colorLabel: 'Color',
      cancel: 'Cancel',
      save: 'Save',
      saving: 'Saving…',
      deleteConfirm: 'Delete this role?',
      superadminProtected: 'Protected — cannot be modified',
      noRoles: 'No roles yet.',
      dashboardOptions: { overview: 'Overview', transport: 'Transport', parcels: 'Parcel Costs', routes: 'Route Analysis' },
    },
    etl: {
      title: 'ETL Run History',
      subtitle: 'Pipeline execution history and data freshness',
      rows: 'rows',
      assetsMaterialized: 'Assets materialized',
      refresh: 'Refresh',
      noRuns: 'No ETL runs found.',
      statusAll: 'All Statuses',
      statusSuccess: 'Success',
      statusFailure: 'Failed',
      statusRunning: 'Running',
      statusPartial: 'Cancelled',
      labelTotal: 'Total',
      labelSuccess: 'Success',
      labelFailed: 'Failed',
      labelPartial: 'Cancelled',
      labelAllJobs: 'All Jobs',
    },
  },
}

// ─── Arabic ──────────────────────────────────────────────────────────────────

const ar: Translations = {
  nav: {
    overview: 'نظرة عامة',
    transport: 'النقل عند الطلب',
    parcelCosts: 'تكاليف الطرود',
    parcelDelivery: 'توصيل الطرود',
    routes: 'تحليل المسارات',
    alerts: 'التنبيهات',
    settings: 'الإعدادات',
    adminOverview: 'لوحة الإدارة',
    users: 'المستخدمون',
    roles: 'الأدوار',
    etl: 'مهام ETL',
    signOut: 'تسجيل الخروج',
    adminSection: 'الإدارة',
  },
  settings: {
    tabs: {
      profile: 'الملف الشخصي',
      preferences: 'التفضيلات',
      sessions: 'الجلسات',
      bookmarks: 'المفضلة',
      announcements: 'الإعلانات',
    },
    profile: {
      hrforceManagedNotice: 'يُدار الملف الشخصي عبر HRForce ولا يمكن تعديله هنا.',
      username: 'اسم المستخدم',
      email: 'البريد الإلكتروني',
      firstName: 'الاسم الأول',
      lastName: 'اسم العائلة',
      phone: 'الهاتف',
      department: 'القسم',
      company: 'الشركة',
      agency: 'الوكالة',
      memberSince: 'عضو منذ',
      accessibleDashboards: 'لوحات المعلومات المتاحة',
      noDashboards: 'لا توجد لوحات معلومات مُعيَّنة',
    },
    preferences: {
      display: 'العرض',
      theme: 'المظهر',
      language: 'اللغة',
      themeDark: 'داكن',
      themeLight: 'فاتح',
      themeSystem: 'النظام',
      notifications: 'الإشعارات',
      saveButton: 'حفظ التفضيلات',
      saving: 'جارٍ الحفظ…',
      saved: 'تم الحفظ!',
      notifInApp: 'الإشعارات داخل التطبيق',
      notifInAppDesc: 'عرض الإشعارات داخل المنصة',
      notifAlerts: 'تنبيهات KPI',
      notifAlertsDesc: 'تنبيهات عند تجاوز عتبات KPI',
      notifEtl: 'حالة ETL',
      notifEtlDesc: 'إشعار عند اكتمال مهام البيانات أو فشلها',
      notifAnnouncements: 'الإعلانات',
      notifAnnouncementsDesc: 'إعلانات المنصة من فريق الإدارة',
      notifEmail: 'ملخص البريد الإلكتروني',
      notifEmailDesc: 'ملخص يومي عبر البريد الإلكتروني',
    },
    sessions: {
      noSessions: 'لا توجد جلسات.',
      current: 'الجلسة الحالية',
    },
    bookmarks: {
      title: 'المفضلة المحفوظة',
      new: 'إضافة مفضلة',
      noBookmarks: 'لا توجد مفضلات بعد.',
      namePlaceholder: 'اسم المفضلة',
      shareTeam: 'مشاركة مع الفريق',
      shared: 'مشترك',
      cancel: 'إلغاء',
      save: 'حفظ',
    },
    announcements: {
      noAnnouncements: 'لا توجد إعلانات نشطة.',
      pinned: 'مثبّت',
    },
  },
  dashboard: {
    overview: 'نظرة عامة',
    transport: 'الشحن',
    parcels: 'تكاليف الطرود',
    routes: 'المسارات',
  },
  roles: {
    superadmin: 'مدير النظام',
    noRole: 'لا يوجد دور مُعيَّن',
  },
  pages: {
    common: {
      vsLastMonth: 'مقابل الشهر الماضي',
      loading: 'جارٍ التحميل…',
      demoData: 'بيانات تجريبية — الخادم غير متوفر',
      monthAll: 'كل السنة',
      months: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
      monthsShort: ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
      infoPanel: {
        labelMeaning: 'الفائدة التجارية',
        labelFormula: 'الصيغة',
        labelSource: 'جداول المصدر',
        labelDimensions: 'الأبعاد / المرشِّحات',
        labelUpdateFreq: 'تكرار التحديث',
        labelCalcNotes: 'ملاحظات الحساب',
      },
    },
    overview: {
      kpiTransportRequests: 'طلبات النقل',
      kpiPunctuality:       'انضباط النقل',
      kpiParcelHandled:     'الطرود المعالجة',
      kpiDeliveryRate:      'معدل التسليم',
      kpiTotalRevenue:      'إجمالي الإيرادات',
      vsLastMonth:          'مقابل الشهر الماضي',
      sectionActivityTrend: 'النشاط الشهري',
      sectionRevenueSplit:  'توزيع الإيرادات',
      seriesTransport:      'النقل',
      seriesParcels:        'الطرود',
      recentAlerts:         'تنبيهات غير مُقرّة',
      viewAllAlerts:        '← عرض جميع التنبيهات',
      colSeverity:          'الخطورة',
      colAlert:             'التنبيه',
      colValueThreshold:    'القيمة / الحد',
      colTime:              'الوقت',
      colStatus:            'الحالة',
    },
    transport: {
      kpiTotalRequests: 'إجمالي الطلبات',
      kpiCompletionRate: 'معدل الإنجاز',
      kpiTotalRevenue: 'إجمالي الإيرادات',
      kpiGrossMargin: 'الهامش الإجمالي',
      kpiPunctuality: 'الانتظام',
      kpiCostPerKm: 'التكلفة / كم',
      kpiCancellationRate: 'معدل الإلغاء',
      kpiAvgNote: 'متوسط التقييم',
      kpiAvgCostPerRequest: 'متوسط التكلفة / طلب',
      kpiInsuranceRatio: 'نسبة التأمين',
      kpiAvgStops: 'متوسط التوقفات / طلب',
      kpiAvgCostPerPiece: 'متوسط التكلفة / قطعة',
      vsPrevMonth: 'مقابل الشهر الماضي',
      vsLastYear: 'مقابل العام الماضي',
      demoData: 'بيانات تجريبية — الخادم غير متوفر',
      loading: 'جارٍ التحميل…',
      sectionRevenueCost: 'الإيرادات مقابل التكلفة الشهرية (دج)',
      sectionRequestsByStatus: 'حجم الطلبات حسب الحالة',
      sectionCostStructure: 'هيكل تكاليف الشحن',
      sectionCurrentPunctuality: 'الانتظام الحالي',
      sectionPunctualityTrend: 'تطور الانتظام (%)',
      sectionCostKmTrend: 'التكلفة لكل كم (دج) — التطور الشهري',
      sectionDelayDistribution: 'توزيع التأخيرات عند الوصول',
      sectionServiceBreakdown: 'التوزيع حسب نوع الخدمة',
      sectionVehicleEfficiency: 'التكلفة/كم حسب نوع المركبة (دج)',
      sectionODMatrix: 'مصفوفة الأصل ← الوجهة (الطلبات حسب المنطقة)',
      sectionCorridors: 'أعلى الممرات (حسب الحجم)',
      sectionAgencyPerformance: 'أداء الوكالات',
      allServices: 'جميع الخدمات',
      dedicatedTrip: 'رحلة مخصصة',
      courier: 'بريد سريع',
      handling: 'شحن',
      colOrigin: 'الانطلاق',
      colDestination: 'الوجهة',
      colRegion: 'المنطقة',
      colRequests: 'الطلبات',
      colMarginPct: 'الهامش %',
      colAvgDist: 'متوسط المسافة (كم)',
      colDzdKm: 'دج/كم',
      colRevenue: 'الإيرادات',
      colAgency: 'الوكالة',
      colWilaya: 'الولاية',
      colCompletion: 'الإنجاز',
      colPunctuality: 'الانتظام',
      colNote: 'التقييم',
      completedSeries: 'مكتملة',
      inProgressSeries: 'قيد التنفيذ',
      cancelledSeries: 'ملغاة',
      punctualitySeries: 'الانتظام (%)',
      costKmSeries: 'التكلفة/كم (دج)',
      marginLegend: 'مفتاح الهامش',
      costLabels: {
        cout_base: 'التعريفة الأساسية',
        cout_distance_supp: 'مسافة إضافية',
        cout_assurance: 'التأمين',
        cout_carburant: 'الوقود',
        cout_manutention: 'الشحن',
        cout_autres: 'أخرى',
      },
      regionOrder: ['Nord', 'Hauts Plateaux', 'Sud'],
      tabOperations: 'العمليات',
      tabCostProfit: 'التكاليف والربحية',
      tabPerformance: 'الأداء',
      filterFrom: 'من',
      filterTo: 'إلى',
      kpiAvgDistance: 'متوسط المسافة (كم)',
      kpiTotalCost: 'التكلفة الإجمالية',
      kpiMarginPct: 'الهامش (%)',
      kpiAvgDuration: 'متوسط المدة (س)',
      kpiAvgDelay: 'متوسط التأخر عند الوصول',
      kpiNightShiftRate: 'معدل الوردية الليلية',
      sectionMonthlyVolume: 'الحجم الشهري — حالات الطلبات',
      sectionServicePie: 'التوزيع حسب نوع الخدمة',
      sectionDistanceCategory: 'التوزيع حسب فئة المسافة',
      sectionRevCostTrend: 'الاتجاه الشهري — الإيرادات مقابل التكاليف (دج)',
      sectionCostCategories: 'تفصيل التكاليف حسب الفئة',
      sectionCostPerKm: 'التكلفة لكل كيلومتر — حسب نوع المركبة',
      sectionTopCorridors: 'أفضل 8 ممرات — الهامش (%)',
      sectionOnTimeTrend: 'الاتجاه الشهري — الانتظام والمدة',
      sectionDelayBuckets: 'توزيع التأخيرات عند الوصول',
      sectionRatingDist: 'توزيع تقييمات العملاء',
      sectionVehiclePerf: 'معدل الانتظام حسب نوع المركبة',
      seriesTerminees: 'مكتملة',
      seriesEnCours: 'قيد التنفيذ',
      seriesAnnulees: 'ملغاة',
      seriesRevenue: 'الإيرادات',
      seriesCost: 'التكلفة',
      seriesMarginPct: 'الهامش (%)',
      seriesOnTimeRate: 'معدل الانتظام (%)',
      seriesAvgDuration: 'متوسط المدة (س)',
      durationUnit: 'س',
      minuteUnit: 'د',
    },
    parcelCosts: {
      kpiParcels: 'الطرود المعالجة',
      kpiDeliveryRate: 'معدل التسليم',
      kpiFeesCollected: 'الرسوم المحصَّلة',
      kpiTotalCost: 'التكلفة الإجمالية',
      kpiUnderTariff: 'معدل ما دون التعريفة (PCC)',
      kpiAvgFee: 'متوسط الرسوم / طرد',
      kpiCostPerDelivery: 'التكلفة / طرد مُسلَّم',
      kpiCompliance: 'الامتثال التعريفي',
      vsPrevMonth: 'مقابل الشهر الماضي',
      vsLastYear: 'مقابل العام الماضي',
      demoData: 'بيانات تجريبية — الخادم غير متوفر',
      loading: 'جارٍ التحميل…',
      sectionFeesVsCost: 'الرسوم المحصَّلة مقابل التكلفة الإجمالية (دج)',
      sectionDeliveryVsCompliance: 'معدل التسليم مقابل معدل ما دون التعريفة (%)',
      sectionEcartDistribution: 'توزيع الفجوات التعريفية (PCC)',
      sectionPCCSummary: 'PCC — ملخص الامتثال',
      sectionAgencyRanking: 'ترتيب الوكالات — امتثال PCC (الأسوأ أولاً)',
      sectionCostStructure: 'هيكل التكاليف',
      sectionCostByNature: 'النفقات حسب الطبيعة (دج)',
      sectionAgencyQuadrant: 'ربعية الوكالات — التسليم مقابل الامتثال التعريفي',
      sectionAgencyScorecard: 'بطاقة أداء الوكالات — الأداء وتكاليف الطرود',
      sectionHDvsSD: 'مقارنة HD مقابل SD',
      sectionDailyVolume: 'الحجم اليومي',
      sectionDurationDistribution: 'توزيع مدد التسليم',
      sectionSinistresType: 'الحوادث — التوزيع حسب النوع',
      sectionSinistresKPI: 'الحوادث — المؤشرات',
      sectionFreelance: 'السائقون المستقلون — ملخص تشغيلي',
      sectionParcelDetail: 'تفاصيل الطرود',
      allYear: 'كل السنة',
      hdAndSd: 'HD + SD',
      homeDelivery: 'توصيل منزلي (HD)',
      pickupPoint: 'Stop Desk (SD)',
      quadrantPerformant: 'مؤدٍّ',
      quadrantTariffRisk: 'خطر تعريفي',
      quadrantOpRisk: 'خطر تشغيلي',
      quadrantDoubleRisk: 'خطر مزدوج',
      colDeliveryRate: 'معدل التسليم (%)',
      colUnderTariff: 'ما دون التعريفة %',
      colUnderTariffN: 'ما دون التعريفة',
      colAgency: 'الوكالة',
      colWilaya: 'الولاية',
      colParcels: 'الطرود',
      colGapTotal: 'الفجوة الإجمالية',
      colGapAvg: 'متوسط الفجوة',
      colGapPCC: 'فجوة PCC',
      colGap: 'الفجوة',
      colCostPerParcel: 'تكلفة/طرد مُسلَّم',
      colCostParcel: 'تكلفة/طرد',
      colDrivers: 'السائقون',
      colDelivered: 'الطرود المُسلَّمة',
      colSuccessRate: 'معدل النجاح',
      colTotalPaid: 'إجمالي المدفوع',
      colTracking: 'التتبع',
      colWilayaDest: 'ولاية الوجهة',
      colType: 'النوع',
      colStatus: 'الحالة',
      colFees: 'الرسوم المحصَّلة',
      colTariff: 'التعريفة النظرية',
      colDuration: 'المدة',
      deliveredSeries: 'مُسلَّمة',
      returnsSeries: 'مُرتجَعة',
      marginLegend: 'مفتاح الهامش',
      selectMonthPrompt: 'حدِّد شهراً لعرض تفاصيل الطرود والمخططات',
      bubbleDesc: 'الفقاعة = حجم الطرود · العتبات: التسليم 73%، ما دون التعريفة 24%',
      pageOf: 'صفحة',
      prevPage: 'السابق →',
      nextPage: '← التالي',
      pccWithTariff: 'طرود بتعريفة نظرية',
      pccUnderTariff: 'ما دون التعريفة (خسائر)',
      pccTotalGap: 'الفجوة الإجمالية',
      pccAvgGap: 'متوسط الفجوة / طرد',
      sinDeclared: 'حوادث مُبلَّغ عنها',
      sinAmountDeclared: 'المبلغ المُعلَن',
      sinRefunded: 'المبلغ المُسترد',
      sinCoverage: 'معدل التغطية',
      sinAvgRefund: 'متوسط التعويض',
      hdDeliveryRate: 'معدل التسليم',
      hdAvgFee: 'متوسط الرسوم',
      hdAvgDuration: 'متوسط وقت التسليم',
      hdReturnRate: 'معدل الإرجاع',
      normalDay: 'يوم عادي',
      friday: 'الجمعة',
      weekend: 'نهاية الأسبوع',
      returns: 'المُرتجَعات',
    },
    parcelDelivery: {
      demoData: 'بيانات تجريبية — الخادم غير متاح',
      loading: 'جارٍ التحميل…',
      tabOperations: 'العمليات',
      tabCostProfit: 'التكاليف والربحية',
      tabPerformance: 'الأداء',
      filterFrom: 'من',
      filterTo: 'إلى',
      allTypes: 'HD + SD',
      homeDelivery: 'توصيل منزلي (HD)',
      pickupPoint: 'Stop Desk (SD)',
      kpiTotalParcels: 'الطرود المعالجة',
      kpiDeliveryRate: 'الطرود المُسلَّمة',
      kpiReturnRate: 'المُرتجَعات',
      kpiFailedParcels: 'في العبور',
      kpiAvgDuration: 'متوسط مدة التسليم',
      sectionVolumeTrend: 'الحجم اليومي — المُسلَّمة والمُرتجَعة وفي العبور',
      sectionStatusBreakdown: 'توزيع حالات الطرود',
      sectionDeliveryTypeComp: 'التدفق الإقليمي — المصدر × الوجهة',
      sectionZoneDist: 'التوزيع حسب منطقة التسليم',
      kpiFeesCollected: 'الرسوم المحصَّلة',
      kpiTotalCost: 'إجمالي التكلفة التشغيلية',
      kpiGrossMargin: 'الهامش الإجمالي',
      kpiAvgFee: 'متوسط الرسوم / طرد',
      kpiCostPerDelivery: 'التكلفة / طرد مُسلَّم',
      sectionRevenueCostTrend: 'الرسوم المحصَّلة مقابل التكلفة الإجمالية (دج)',
      sectionCostStructure: 'هيكل التكاليف التشغيلية',
      sectionCostByNature: 'النفقات حسب الطبيعة (دج)',
      sectionTariffGapDist: 'توزيع الفجوات التعريفية (PCC)',
      sectionRegionProfit: 'التدفق الإقليمي — الهامش حسب المسار (دج)',
      sectionZoneProfit: 'الربحية حسب منطقة التسليم',
      kpiDeliveryRatePerf: 'معدل التسليم',
      kpiAvgAttempts: 'متوسط المحاولات',
      kpiFirstAttemptRate: 'نجاح المحاولة الأولى',
      kpiAvgDurationPerf: 'متوسط مدة التسليم',
      kpiClaimsCount: 'الحوادث المُبلَّغ عنها',
      sectionDeliveryDurationTrend: 'الأداء الشهري — التسليم والمدة',
      sectionDurationDist: 'توزيع مدد التسليم',
      sectionCenterExpeditionRanking: 'أفضل 8 مراكز — الإرساليات (الطرود المُرسَلة)',
      sectionClaimsType: 'الحوادث — التوزيع حسب النوع',
      seriesDelivered: 'مُسلَّمة',
      seriesReturned: 'مُرتجَعة',
      seriesFailed: 'فاشلة',
      seriesInTransit: 'في العبور',
      sectionRegionFlow: 'التدفق الإقليمي — المصدر × الوجهة',
      seriesRevenue: 'الرسوم المحصَّلة',
      seriesCost: 'التكلفة الإجمالية',
      seriesDeliveryRate: 'معدل التسليم (%)',
      seriesAvgDuration: 'متوسط المدة (س)',
      hdLabel: 'توصيل منزلي (HD)',
      sdLabel: 'Stop Desk (SD)',
      hdDeliveryRate: 'معدل التسليم',
      hdReturnRate: 'معدل الإرجاع',
      hdAvgFee: 'متوسط الرسوم',
      hdAvgDuration: 'متوسط المدة',
      durationUnit: 'س',
    },
    routes: {
      kpiTotalRoutes: 'إجمالي المسارات',
      kpiAvgDistance: 'متوسط المسافة',
      kpiAvgCostPerKm: 'متوسط التكلفة / كم',
      colOrigin: 'الانطلاق',
      colDestination: 'الوجهة',
      colDistance: 'المسافة (كم)',
      colAvgDuration: 'المدة المتوسطة',
      colActualCost: 'التكلفة الفعلية',
      colOptimizedCost: 'التكلفة المُحسَّنة',
      colSavings: 'الوفورات',
      colEfficiency: 'الكفاءة',
      mapTitle: 'خريطة المسارات — الجزائر',
      mapDesc: 'أخضر = كفاءة عالية (>90%) | عنبري = متوسط (80–90%) | أحمر = منخفض (<80%)',
      chartActualCost: 'التكلفة الفعلية حسب المسار',
      chartActualCostSub: 'الشريط الرئيسي = التكلفة الفعلية. قارن إمكانات التوفير لكل مسار.',
      chartActualLabel: 'التكلفة الفعلية (دج)',
      chartRadar: 'أداء المسار — الجزائر ← وهران',
      chartRadarSub: 'رادار الأداء متعدد الأبعاد للمسار ذي الحجم الأعلى.',
      chartComparison: 'مقارنة المسارات',
      radarCostEff: 'كفاءة التكلفة',
      radarTimeEff: 'كفاءة الوقت',
      radarVolume: 'الحجم',
      radarDistance: 'المسافة',
      radarProfitability: 'الربحية',
      wipTitle: 'قيد التطوير',
      wipDesc: 'تستخدم هذه الصفحة حالياً بيانات تجريبية. ستتوفر تحليلات المسارات الحقيقية قريباً.',
    },
    alerts: {
      triggeredValue: 'القيمة المُشغِّلة',
      threshold: 'الحد',
      acknowledgedBy: 'تأكيد من',
      acknowledge: 'تأكيد',
      optionalNote: 'ملاحظة اختيارية…',
      confirm: 'تأكيد',
      alertRules: 'قواعد التنبيه',
      cooldown: 'فترة التهدئة',
      ruleActive: 'نشط',
      rulePaused: 'متوقف',
      fired: '× مُشغَّل',
      allSeverity: 'الكل',
      unacknowledged: 'غير مؤكدة',
      acknowledged: 'مؤكدة',
      noAlerts: 'لا توجد تنبيهات مطابقة.',
      distribution: 'توزيع الخطورة',
      metricLabels: {
        ecart_tarif_pct: 'انحراف التعريفة (%)',
        taux_livraison_pct: 'معدل نجاح التسليم (%)',
        transport_cost_dzd: 'تكلفة الشحن (دج)',
        nbr_sous_tarif: 'الطرود دون التعريفة',
        marge_brute_transport_pct: 'هامش الربح الإجمالي للشحن (%)',
        nbr_livraisons_jour: 'التسليمات اليومية',
      },
    },
    admin: {
      title: 'لوحة الإدارة',
      subtitle: 'صحة المنصة والملخص التشغيلي',
      sectionUsers: 'المستخدمون',
      sectionPlatform: 'المنصة',
      labelTotalUsers: 'إجمالي المستخدمين',
      labelActive: 'نشطون',
      labelNewMonth: 'جدد هذا الشهر',
      labelWithoutRole: 'بدون دور',
      needRole: 'يحتاج تعيين دور',
      inactive: 'غير نشطين',
      usersByRole: 'المستخدمون حسب الدور',
      labelOnline: 'المستخدمون الآن',
      labelUnackAlerts: 'تنبيهات غير مؤكدة',
      labelUnreadNotifs: 'إشعارات غير مقروءة',
      labelEtlToday: 'تشغيلات ETL اليوم',
      labelLastEtl: 'الأخير:',
      dataFreshness: 'حداثة البيانات',
      fresh: 'محدَّث',
      stale: 'قديم',
      lastSuccess: 'آخر تشغيل ناجح',
      runs7Days: 'التشغيلات (آخر 7 أيام)',
      successRate: 'معدل النجاح',
      lastJob: 'آخر مهمة',
      manageUsers: 'إدارة المستخدمين',
      manageUsersDesc: 'تفعيل، تعيين أدوار، إجبار تسجيل الخروج',
      manageRoles: 'إدارة الأدوار',
      manageRolesDesc: 'إنشاء وتعديل الأدوار التشغيلية',
      etlRuns: 'تشغيلات ETL',
      etlRunsDesc: 'عرض تاريخ وحالة الأنابيب',
    },
    users: {
      syncHrforce: 'مزامنة HRForce',
      exportCsv: 'تصدير CSV',
      searchPlaceholder: 'البحث عن مستخدمين…',
      syncComplete: 'اكتملت مزامنة HRForce',
      syncFetched: 'مستخدمين مُحضَرين',
      syncCreated: 'مُنشَؤون',
      syncUpdated: 'مُحدَّثون',
      syncSkipped: 'بدون تغيير',
      syncErrors: 'أخطاء',
      assignRole: 'تعيين دور',
      sessions: 'الجلسات',
      activate: 'تفعيل',
      deactivate: 'إلغاء التفعيل',
      forceLogout: 'إجبار تسجيل الخروج',
      noSessions: 'لا توجد جلسات نشطة.',
      active: 'نشط',
      inactive: 'غير نشط',
      saveRole: 'حفظ الدور',
      saving: 'جارٍ الحفظ…',
      modalSessions: 'الجلسات النشطة',
      colUser: 'المستخدم',
      colOccupation: 'المنصب',
      colRole: 'الدور',
      colCompany: 'الشركة',
      colStatus: 'الحالة',
      colLastLogin: 'آخر تسجيل دخول',
      noUsers: 'لا يوجد مستخدمون',
    },
    roles: {
      newRole: 'دور جديد',
      editRole: 'تعديل الدور',
      roleKey: 'مفتاح الدور (snake_case، فريد)',
      displayName: 'الاسم المعروض',
      description: 'الوصف',
      dashboardAccess: 'الوصول للوحات المعلومات',
      colorLabel: 'اللون',
      cancel: 'إلغاء',
      save: 'حفظ',
      saving: 'جارٍ الحفظ…',
      deleteConfirm: 'حذف هذا الدور؟',
      superadminProtected: 'محمي — لا يمكن تعديله',
      noRoles: 'لا توجد أدوار بعد.',
      dashboardOptions: { overview: 'نظرة عامة', transport: 'الشحن', parcels: 'تكاليف الطرود', routes: 'تحليل المسارات' },
    },
    etl: {
      title: 'سجل تشغيلات ETL',
      subtitle: 'تاريخ تنفيذ الأنابيب وحداثة البيانات',
      rows: 'سجلات',
      assetsMaterialized: 'الأصول المُجسَّدة',
      refresh: 'تحديث',
      noRuns: 'لم تُوجد تشغيلات ETL.',
      statusAll: 'جميع الحالات',
      statusSuccess: 'نجاح',
      statusFailure: 'فشل',
      statusRunning: 'جارٍ',
      statusPartial: 'ملغى',
      labelTotal: 'الإجمالي',
      labelSuccess: 'نجاح',
      labelFailed: 'فشل',
      labelPartial: 'ملغى',
      labelAllJobs: 'جميع المهام',
    },
  },
}

// ─── Registry & hook ─────────────────────────────────────────────────────────

export const translations: Record<Locale, Translations> = { fr, en, ar }

/**
 * Returns the full typed translation dictionary for the current user's locale.
 * Usage:  const { t } = useTranslation()  →  t.nav.overview
 *
 * Also exposes `locale` and `isRTL` for direction-sensitive rendering.
 */
export function useTranslation() {
  const language = useAuthStore((s) => (s.user?.preferences?.language ?? 'fr') as Locale)
  const t: Translations = translations[language] ?? translations.fr
  return { t, locale: language, isRTL: language === 'ar' }
}
