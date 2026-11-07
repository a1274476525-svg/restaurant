import { useEffect, useState } from 'react'
import {
  Package, Utensils, AlertTriangle, TrendingUp, ShoppingBag,
  MonitorSmartphone, CalendarDays, Users, ArrowUpRight,
  ShoppingCart, CreditCard, Banknote,
} from 'lucide-react'
import type { DashboardData } from '../types'

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.api.reports.dashboard().then(setData).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        جاري التحميل...
      </div>
    )
  }

  const fmt = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">لوحة التحكم</h1>

      {/* ── KPI Cards Row 1 ── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<MonitorSmartphone className="text-blue-500" size={22} />}
          label="إيراد POS اليوم"
          value={`${fmt(data?.posRevToday ?? 0)} ج`}
          sub={`${data?.posOrdersToday ?? 0} طلب`}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<TrendingUp className="text-green-500" size={22} />}
          label="إجمالي المبيعات اليوم"
          value={`${fmt(data?.totalSalesToday ?? 0)} ج`}
          sub={`${data?.salesTodayCount ?? 0} عملية`}
          bg="bg-green-50"
        />
        <StatCard
          icon={<CalendarDays className="text-purple-500" size={22} />}
          label="حجوزات اليوم"
          value={data?.reservationsToday ?? 0}
          sub={`${data?.pendingReservations ?? 0} معلق/مؤكد`}
          bg="bg-purple-50"
        />
        <StatCard
          icon={<Users className="text-amber-500" size={22} />}
          label="العملاء النشطون"
          value={data?.customerCount ?? 0}
          bg="bg-amber-50"
        />
      </div>

      {/* ── KPI Cards Row 2 ── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<Package className="text-slate-500" size={22} />}
          label="المواد الخام"
          value={data?.ingredientCount ?? 0}
          bg="bg-slate-50"
        />
        <StatCard
          icon={<Utensils className="text-orange-500" size={22} />}
          label="الوجبات النشطة"
          value={data?.productCount ?? 0}
          bg="bg-orange-50"
        />
        <StatCard
          icon={<AlertTriangle className="text-amber-500" size={22} />}
          label="مخزون منخفض"
          value={data?.lowStockCount ?? 0}
          bg="bg-amber-50"
          alert={(data?.lowStockCount ?? 0) > 0}
        />
        <div className="bg-slate-50 rounded-xl p-5 flex items-center justify-center">
          <p className="text-slate-400 text-xs text-center">نظام إدارة المطعم</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Recent POS Orders */}
        <div className="bg-white rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <MonitorSmartphone size={16} className="text-blue-500" />
            آخر طلبات POS
          </h2>
          {(data?.recentPosOrders?.length ?? 0) === 0 ? (
            <p className="text-slate-400 text-sm py-4 text-center">لا توجد طلبات بعد</p>
          ) : (
            <div className="space-y-2">
              {data?.recentPosOrders.slice(0, 6).map(order => (
                <div key={order.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                      {order.paymentMethod === 'cash'
                        ? <Banknote size={13} className="text-blue-600" />
                        : <CreditCard size={13} className="text-blue-600" />}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{order.orderNumber}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        {' · '}{order.items.length} صنف
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-blue-600 font-mono">{order.total.toFixed(2)} ج</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock + Recent Sales */}
        <div className="space-y-5">
          {/* Low Stock Alerts */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-500" />
              مخزون منخفض
            </h2>
            {(data?.lowStockItems?.length ?? 0) === 0 ? (
              <p className="text-slate-400 text-sm py-2 text-center">لا توجد تنبيهات ✓</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {data?.lowStockItems.slice(0, 6).map(item => (
                  <div key={item.id} className="flex justify-between items-center p-2 bg-amber-50 rounded-lg">
                    <span className="text-xs font-medium text-slate-700">{item.name}</span>
                    <span className="text-xs text-amber-600 font-mono">
                      {item.currentStock} {item.unit}
                    </span>
                  </div>
                ))}
                {(data?.lowStockItems.length ?? 0) > 6 && (
                  <p className="text-xs text-slate-400 text-center pt-1">
                    و{(data?.lowStockItems.length ?? 0) - 6} مادة أخرى
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Recent Manual Sales */}
          <div className="bg-white rounded-xl p-5 shadow-sm">
            <h2 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <ShoppingBag size={16} className="text-slate-500" />
              آخر المبيعات اليدوية
            </h2>
            {(data?.recentSales?.filter(s => s.source !== 'pos').length ?? 0) === 0 ? (
              <p className="text-slate-400 text-sm py-2 text-center">لا توجد مبيعات يدوية</p>
            ) : (
              <div className="space-y-1">
                {data?.recentSales.filter(s => s.source !== 'pos').slice(0, 4).map(sale => (
                  <div key={sale.id} className="flex justify-between items-center p-2 hover:bg-slate-50 rounded-lg">
                    <span className="text-xs text-slate-700">{sale.product?.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">× {sale.quantity}</span>
                      <span className="text-xs font-semibold text-slate-700 font-mono">{sale.total.toFixed(2)} ج</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today's Summary Bar */}
      {(data?.posOrdersToday ?? 0) > 0 && (
        <div className="bg-gradient-to-l from-blue-600 to-blue-700 rounded-xl p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart size={20} className="text-blue-200" />
            <div>
              <p className="font-bold">ملخص اليوم</p>
              <p className="text-blue-200 text-xs mt-0.5">
                {data?.posOrdersToday} طلب POS · {data?.reservationsToday} حجز · {data?.lowStockCount} تنبيه مخزون
              </p>
            </div>
          </div>
          <div className="text-left">
            <p className="text-blue-200 text-xs">إجمالي الإيراد</p>
            <p className="text-2xl font-bold font-mono">{fmt(data?.posRevToday ?? 0)} ج</p>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({
  icon, label, value, bg, alert, sub,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  bg: string
  alert?: boolean
  sub?: string
}) {
  return (
    <div className={`${bg} rounded-xl p-5 ${alert ? 'ring-2 ring-amber-400' : ''}`}>
      <div className="flex items-center justify-between mb-3">
        {icon}
        {alert && <span className="w-2 h-2 bg-amber-400 rounded-full animate-pulse" />}
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
    </div>
  )
}
