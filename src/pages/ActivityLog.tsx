import { useState, useEffect } from 'react'
import { Activity, ShieldCheck } from 'lucide-react'
import type { ActivityLog as LogEntry } from '../types'
import { useAuth } from '../contexts/AuthContext'

const ENTITY_LABELS: Record<string, string> = {
  ingredient: 'مادة خام',
  product:    'وجبة',
  supplier:   'مورد',
  invoice:    'فاتورة',
  sale:       'مبيعات',
  user:       'مستخدم',
  setting:    'إعداد',
  transfer:   'تحويل',
  inventory:  'جرد',
  waste:      'هدر',
  production: 'إنتاج',
}

export default function ActivityLogPage() {
  const { user } = useAuth()
  const [logs, setLogs]     = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filterUser, setFilterUser] = useState('')

  useEffect(() => {
    window.api.activity.getAll()
      .then(setLogs)
      .finally(() => setLoading(false))
  }, [])

  if (!user?.roleData?.fullAccess) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full gap-4">
        <ShieldCheck size={48} className="text-slate-300" />
        <p className="text-slate-500 text-lg">هذه الصفحة للمديرين فقط</p>
      </div>
    )
  }

  const filtered = filterUser
    ? logs.filter(l => l.user?.name === filterUser)
    : logs

  const uniqueUsers = [...new Set(logs.map(l => l.user?.name).filter(Boolean))] as string[]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
          <Activity size={22} /> سجل النشاط
        </h1>
        <div className="flex items-center gap-3">
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">كل المستخدمين</option>
            {uniqueUsers.map(u => <option key={u}>{u}</option>)}
          </select>
          <span className="text-sm text-slate-500">{filtered.length} سجل</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-16">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-slate-400 py-16 bg-white rounded-2xl">
          <Activity size={40} className="mx-auto mb-3 text-slate-300" />
          <p>لا يوجد سجل نشاط</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-right font-semibold">المستخدم</th>
                <th className="px-5 py-3 text-right font-semibold">الإجراء</th>
                <th className="px-5 py-3 text-right font-semibold">التفاصيل</th>
                <th className="px-5 py-3 text-right font-semibold">الوقت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(log => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {log.user?.name?.[0] ?? '?'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-800">{log.user?.name ?? 'مجهول'}</div>
                        <div className="text-xs text-slate-400">{log.user?.role ?? ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-800">{log.action}</span>
                      {log.entity && (
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                          {ENTITY_LABELS[log.entity] ?? log.entity}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-slate-500 max-w-xs truncate">
                    {log.details ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-400 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('ar-EG')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
