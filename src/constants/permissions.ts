export interface PageDef {
  key: string
  label: string
  group: string
}

export const ALL_PAGES: PageDef[] = [
  { key: '/',                  label: 'لوحة التحكم',    group: 'عام' },
  { key: '/sales',             label: 'المبيعات',         group: 'المبيعات' },
  { key: '/pos',               label: 'نقطة البيع',       group: 'المبيعات' },
  { key: '/customers',         label: 'العملاء',          group: 'المبيعات' },
  { key: '/reservations',      label: 'الحجوزات',         group: 'المبيعات' },
  { key: '/delivery',          label: 'شركات التوصيل',   group: 'المبيعات' },
  { key: '/ingredients',       label: 'مواد المخزون',    group: 'المخزون' },
  { key: '/products',          label: 'الوجبات',          group: 'المخزون' },
  { key: '/recipes',           label: 'الوصفات',          group: 'المخزون' },
  { key: '/production',        label: 'الإنتاج',          group: 'المخزون' },
  { key: '/stock',             label: 'حركات المخزون',   group: 'المخزون' },
  { key: '/waste',             label: 'الهدر',            group: 'المخزون' },
  { key: '/inventory',         label: 'جرد المخزون',     group: 'المخزون' },
  { key: '/branches',          label: 'الفروع والمخازن', group: 'المشتريات' },
  { key: '/transfer-requests', label: 'طلبات التحويل',   group: 'المشتريات' },
  { key: '/transfers',         label: 'التحويلات',        group: 'المشتريات' },
  { key: '/suppliers',         label: 'الموردون',         group: 'المشتريات' },
  { key: '/purchase-requests', label: 'طلبات الشراء',    group: 'المشتريات' },
  { key: '/invoices',          label: 'فواتير الشراء',   group: 'المشتريات' },
  { key: '/tables',             label: 'الطاولات',         group: 'المبيعات' },
  { key: '/promotions',         label: 'العروض',            group: 'المبيعات' },
  { key: '/reports',           label: 'التقارير',         group: 'الإدارة' },
  { key: '/expenses',            label: 'فواتير المصاريف',  group: 'الحسابات' },
  { key: '/banks',               label: 'البنوك والعهد',    group: 'الحسابات' },
  { key: '/chart-of-accounts',   label: 'دليل الحسابات',   group: 'الحسابات' },
  { key: '/journals',            label: 'القيود اليومية',   group: 'الحسابات' },
  { key: '/settings',          label: 'الإعدادات',        group: 'الإدارة' },
  { key: '/users',             label: 'المستخدمون',       group: 'الإدارة' },
  { key: '/roles',             label: 'الوظائف',          group: 'الإدارة' },
  { key: '/activity',          label: 'سجل النشاط',      group: 'الإدارة' },
]

export const PAGE_GROUPS = ['عام', 'المبيعات', 'المخزون', 'المشتريات', 'الحسابات', 'الإدارة']
