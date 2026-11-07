import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Utensils, BookOpen,
  Truck, FileText, ShoppingCart, BarChart3, ArrowUpDown,
  ChevronDown, Factory, ClipboardList, ClipboardCheck,
  ArrowLeftRight, GitBranch, Send, Trash2, Settings,
  Users, Activity, LogOut, ShieldCheck, AlertTriangle, X,
  TableProperties, Tag, MonitorSmartphone, Lock, Receipt,
  Landmark, BookMarked, TrendingUp, CalendarDays, UserCheck,
} from 'lucide-react'
import type { Ingredient } from './types'

import { AuthProvider, useAuth }         from './contexts/AuthContext'
import { SettingsProvider, useSettings } from './contexts/SettingsContext'
import { PinPadUI } from './pages/Login'

import Dashboard        from './pages/Dashboard'
import Ingredients      from './pages/Ingredients'
import Products         from './pages/Products'
import Recipes          from './pages/Recipes'
import Suppliers        from './pages/Suppliers'
import PurchaseInvoices from './pages/PurchaseInvoices'
import PurchaseRequests from './pages/PurchaseRequests'
import Sales            from './pages/Sales'
import StockMovements   from './pages/StockMovements'
import Production       from './pages/Production'
import InventoryCount   from './pages/InventoryCount'
import Branches         from './pages/Branches'
import TransferRequests from './pages/TransferRequests'
import Transfers        from './pages/Transfers'
import Reports          from './pages/Reports'
import Login            from './pages/Login'
import UsersPage        from './pages/Users'
import SettingsPage     from './pages/Settings'
import ActivityLogPage  from './pages/ActivityLog'
import WasteTracking    from './pages/WasteTracking'
import RolesPage        from './pages/Roles'
import TablesPage       from './pages/Tables'
import PromotionsPage   from './pages/Promotions'
import POSPage              from './pages/POS'
import DeliveryPartnersPage from './pages/DeliveryPartners'
import ExpensesPage         from './pages/Expenses'
import ChartOfAccountsPage  from './pages/ChartOfAccounts'
import BanksPage            from './pages/Banks'
import JournalsPage         from './pages/Journals'
import CustomersPage        from './pages/Customers'
import ReservationsPage     from './pages/Reservations'

function LockScreen() {
  const { user, unlock, logout } = useAuth()
  const { settings } = useSettings()

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <Lock size={36} className="text-slate-500 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-white">{settings.restaurantName}</h1>
        <p className="text-slate-400 mt-1 text-sm">الشاشة مقفلة — أدخل رقمك للمتابعة</p>
      </div>
      <PinPadUI
        userName={user?.name ?? ''}
        userRole={user?.role}
        onBack={logout}
        backLabel="تسجيل خروج كامل"
        onSubmitPin={unlock}
      />
    </div>
  )
}

interface NavItem { to: string; label: string; icon: React.ElementType; exact?: boolean }

function NavGroup({ label, icon: Icon, items, defaultOpen = true }: {
  label: string; icon: React.ElementType
  items: NavItem[]; defaultOpen?: boolean
}) {
  const { canAccess } = useAuth()
  const location = useLocation()
  const visible = items.filter(i => canAccess(i.to))
  const hasActive = visible.some(i => i.exact ? location.pathname === i.to : location.pathname.startsWith(i.to))
  const [open, setOpen] = useState(defaultOpen || hasActive)
  if (visible.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors rounded-lg mx-1 ${
          hasActive ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'
        }`}
      >
        <span className="flex items-center gap-2"><Icon size={13} />{label}</span>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && (
        <div className="mt-0.5 mb-1">
          {visible.map(item => (
            <NavLink key={item.to} to={item.to} end={item.exact}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-2 px-4 py-2 text-sm rounded-lg transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <item.icon size={15} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function StandaloneLink({ to, label, icon: Icon, exact }: NavItem) {
  const { canAccess } = useAuth()
  if (!canAccess(to)) return null
  return (
    <NavLink to={to} end={exact}
      className={({ isActive }) =>
        `flex items-center gap-3 mx-2 px-4 py-2 text-sm rounded-lg transition-colors ${
          isActive ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
        }`
      }
    >
      <Icon size={15} />
      <span>{label}</span>
    </NavLink>
  )
}

function Sidebar() {
  const { user, logout, lock } = useAuth()
  const { settings }           = useSettings()

  return (
    <aside className="no-print w-60 bg-slate-900 text-white flex flex-col flex-shrink-0">
      <div className="p-5 border-b border-slate-700">
        <h1 className="text-lg font-bold text-white">{settings.restaurantName}</h1>
        <p className="text-slate-400 text-xs mt-1">المخزون والتقارير</p>
      </div>

      <nav className="flex-1 py-3 overflow-y-auto space-y-1">
        <StandaloneLink to="/" label="لوحة التحكم" icon={LayoutDashboard} exact />

        <div className="border-t border-slate-800 pt-1" />

        <NavGroup label="المبيعات" icon={ShoppingCart} items={[
          { to: '/pos',          label: 'نقطة البيع',  icon: MonitorSmartphone },
          { to: '/sales',        label: 'المبيعات',    icon: ShoppingCart },
          { to: '/customers',    label: 'العملاء',     icon: UserCheck },
          { to: '/reservations', label: 'الحجوزات',   icon: CalendarDays },
          { to: '/tables',       label: 'الطاولات',    icon: TableProperties },
          { to: '/promotions',   label: 'العروض',      icon: Tag },
          { to: '/delivery',     label: 'التوصيل',     icon: Truck },
        ]} />

        <div className="border-t border-slate-800 pt-1" />

        <NavGroup label="المخزون" icon={Package} items={[
          { to: '/ingredients', label: 'مواد المخزون',  icon: Package },
          { to: '/products',    label: 'الوجبات',       icon: Utensils },
          { to: '/recipes',     label: 'الوصفات',       icon: BookOpen },
          { to: '/production',  label: 'الإنتاج',       icon: Factory },
          { to: '/stock',       label: 'حركات المخزون', icon: ArrowUpDown },
          { to: '/waste',       label: 'الهدر',         icon: Trash2 },
          { to: '/inventory',   label: 'جرد المخزون',   icon: ClipboardCheck },
        ]} />

        <div className="border-t border-slate-800 pt-1" />

        <NavGroup label="المشتريات" icon={FileText} defaultOpen={false} items={[
          { to: '/suppliers',         label: 'الموردون',        icon: Truck },
          { to: '/purchase-requests', label: 'طلبات الشراء',    icon: ClipboardList },
          { to: '/invoices',          label: 'فواتير الشراء',   icon: FileText },
          { to: '/branches',          label: 'الفروع والمخازن', icon: GitBranch },
          { to: '/transfer-requests', label: 'طلبات التحويل',   icon: Send },
          { to: '/transfers',         label: 'التحويلات',        icon: ArrowLeftRight },
        ]} />

        <div className="border-t border-slate-800 pt-1" />

        <NavGroup label="الحسابات" icon={Landmark} defaultOpen={false} items={[
          { to: '/expenses',          label: 'فواتير المصاريف', icon: Receipt },
          { to: '/banks',             label: 'البنوك والعهد',   icon: Landmark },
          { to: '/chart-of-accounts', label: 'دليل الحسابات',  icon: BookMarked },
          { to: '/journals',          label: 'القيود اليومية',  icon: BookOpen },
        ]} />

        <div className="border-t border-slate-800 pt-1" />

        <StandaloneLink to="/reports" label="التقارير المالية" icon={TrendingUp} />

        <div className="border-t border-slate-800 pt-1" />

        <NavGroup label="الإدارة" icon={Settings} defaultOpen={false} items={[
          { to: '/settings', label: 'الإعدادات',   icon: Settings },
          { to: '/roles',    label: 'الوظائف',     icon: ShieldCheck },
          { to: '/users',    label: 'المستخدمون',  icon: Users },
          { to: '/activity', label: 'سجل النشاط',  icon: Activity },
        ]} />
      </nav>

      <div className="p-4 border-t border-slate-700">
        {user && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                {user.name[0]}
              </div>
              <div>
                <div className="text-white text-xs font-medium">{user.name}</div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={lock} title="قفل الشاشة"
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                <Lock size={15} />
              </button>
              <button onClick={logout} title="تسجيل الخروج"
                className="p-1.5 text-slate-500 hover:text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                <LogOut size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  )
}

function LowStockBanner() {
  const [items, setItems] = useState<Ingredient[]>([])
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    window.api.ingredients.getAll().then(all => {
      setItems(all.filter(i => !i.isArchived && i.minStockAlert > 0 && i.currentStock <= i.minStockAlert))
    })
  }, [])

  if (dismissed || items.length === 0) return null

  return (
    <div className="no-print bg-amber-50 border-b border-amber-200 px-5 py-2 flex items-center gap-3 flex-shrink-0">
      <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
      <p className="text-amber-700 text-xs flex-1 leading-5">
        <span className="font-semibold">{items.length} مادة وصلت للحد الأدنى: </span>
        {items.slice(0, 5).map(i => `${i.name} (${i.currentStock} ${i.unit})`).join(' • ')}
        {items.length > 5 && ` و${items.length - 5} أخرى`}
      </p>
      <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 flex-shrink-0">
        <X size={13} />
      </button>
    </div>
  )
}

function ProtectedRoute({ path, element }: { path: string; element: React.ReactElement }) {
  const { canAccess } = useAuth()
  return canAccess(path) ? element : <Navigate to="/" replace />
}

function AppContent() {
  const { user, isLocked } = useAuth()
  if (!user) return <Login />
  if (isLocked) return <LockScreen />

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <LowStockBanner />
        <main className="flex-1 overflow-y-auto print-page">
        <Routes>
          <Route path="/"                   element={<Dashboard />} />
          <Route path="/ingredients"        element={<ProtectedRoute path="/ingredients"        element={<Ingredients />} />} />
          <Route path="/products"           element={<ProtectedRoute path="/products"           element={<Products />} />} />
          <Route path="/recipes"            element={<ProtectedRoute path="/recipes"            element={<Recipes />} />} />
          <Route path="/suppliers"          element={<ProtectedRoute path="/suppliers"          element={<Suppliers />} />} />
          <Route path="/invoices"           element={<ProtectedRoute path="/invoices"           element={<PurchaseInvoices />} />} />
          <Route path="/purchase-requests"  element={<ProtectedRoute path="/purchase-requests"  element={<PurchaseRequests />} />} />
          <Route path="/sales"              element={<ProtectedRoute path="/sales"              element={<Sales />} />} />
          <Route path="/stock"              element={<ProtectedRoute path="/stock"              element={<StockMovements />} />} />
          <Route path="/production"         element={<ProtectedRoute path="/production"         element={<Production />} />} />
          <Route path="/inventory"          element={<ProtectedRoute path="/inventory"          element={<InventoryCount />} />} />
          <Route path="/branches"           element={<ProtectedRoute path="/branches"           element={<Branches />} />} />
          <Route path="/transfer-requests"  element={<ProtectedRoute path="/transfer-requests"  element={<TransferRequests />} />} />
          <Route path="/transfers"          element={<ProtectedRoute path="/transfers"          element={<Transfers />} />} />
          <Route path="/reports"            element={<ProtectedRoute path="/reports"            element={<Reports />} />} />
          <Route path="/waste"              element={<ProtectedRoute path="/waste"              element={<WasteTracking />} />} />
          <Route path="/settings"           element={<ProtectedRoute path="/settings"           element={<SettingsPage />} />} />
          <Route path="/roles"              element={<ProtectedRoute path="/roles"              element={<RolesPage />} />} />
          <Route path="/users"              element={<ProtectedRoute path="/users"              element={<UsersPage />} />} />
          <Route path="/activity"           element={<ProtectedRoute path="/activity"           element={<ActivityLogPage />} />} />
          <Route path="/tables"             element={<ProtectedRoute path="/tables"             element={<TablesPage />} />} />
          <Route path="/promotions"         element={<ProtectedRoute path="/promotions"         element={<PromotionsPage />} />} />
          <Route path="/pos"                element={<ProtectedRoute path="/pos"                element={<POSPage />} />} />
          <Route path="/delivery"           element={<ProtectedRoute path="/delivery"           element={<DeliveryPartnersPage />} />} />
          <Route path="/expenses"           element={<ProtectedRoute path="/expenses"           element={<ExpensesPage />} />} />
          <Route path="/chart-of-accounts" element={<ProtectedRoute path="/chart-of-accounts" element={<ChartOfAccountsPage />} />} />
          <Route path="/banks"              element={<ProtectedRoute path="/banks"              element={<BanksPage />} />} />
          <Route path="/journals"           element={<ProtectedRoute path="/journals"           element={<JournalsPage />} />} />
          <Route path="/customers"          element={<ProtectedRoute path="/customers"          element={<CustomersPage />} />} />
          <Route path="/reservations"       element={<ProtectedRoute path="/reservations"       element={<ReservationsPage />} />} />
        </Routes>
        </main>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <SettingsProvider>
      <AuthProvider>
        <HashRouter>
          <AppContent />
        </HashRouter>
      </AuthProvider>
    </SettingsProvider>
  )
}
