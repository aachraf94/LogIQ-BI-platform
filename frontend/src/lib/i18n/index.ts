import { useAuthStore } from '@/stores/authStore'

export type Locale = 'fr' | 'en' | 'ar'

// ─── Shape ───────────────────────────────────────────────────────────────────

export interface Translations {
  nav: {
    overview: string
    transport: string
    parcelCosts: string
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
}

// ─── French ──────────────────────────────────────────────────────────────────

const fr: Translations = {
  nav: {
    overview: 'Aperçu',
    transport: 'Transport',
    parcelCosts: 'Coûts Colis',
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
}

// ─── English ─────────────────────────────────────────────────────────────────

const en: Translations = {
  nav: {
    overview: 'Overview',
    transport: 'Transport',
    parcelCosts: 'Parcel Costs',
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
}

// ─── Arabic ──────────────────────────────────────────────────────────────────

const ar: Translations = {
  nav: {
    overview: 'نظرة عامة',
    transport: 'الشحن',
    parcelCosts: 'تكاليف الطرود',
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
