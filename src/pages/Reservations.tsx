import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { CalendarDays, Plus, Pencil, Trash2, Users, Clock, X, Check, ChevronRight, ChevronLeft, Download } from 'lucide-react'
import type { Reservation, Customer, Table } from '../types'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:   { label: 'معلق',    color: 'bg-amber-100 text-amber-700'  },
  confirmed: { label: 'مؤكد',   color: 'bg-blue-100 text-blue-700'    },
  seated:    { label: 'جالس',   color: 'bg-purple-100 text-purple-700' },
  completed: { label: 'مكتمل',  color: 'bg-green-100 text-green-700'  },
  cancelled: { label: 'ملغي',   color: 'bg-red-100 text-red-700'      },
}

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function localDatetimeStr(d?: string) {
  if (!d) return ''
  const dt = new Date(d)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
}

export default function Reservations() {
  const [list,      setList]      = useState<Reservation[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [tables,    setTables]    = useState<Table[]>([])
  const [dateFilter, setDateFilter] = useState(todayStr())
  const [statusFilter, setStatusFilter] = useState('')
  const [modal,   setModal]   = useState(false)
  const [editId,  setEditId]  = useState<number | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [form, setForm] = useState({
    customerId: '', tableId: '', guestName: '', guestPhone: '',
    reservationDate: '', partySize: 2, status: 'pending', notes: '',
  })

  async function load() {
    const params: any = {}
    if (dateFilter) {
      params.from = dateFilter
      params.to   = dateFilter
    }
    if (statusFilter) params.status = statusFilter
    const [resv, custs, tbls] = await Promise.all([
      window.api.reservations.getAll(params),
      window.api.customers.getAll(),
      window.api.tables.getAll(),
    ])
    setList(resv)
    setCustomers(custs)
    setTables(tbls)
  }

  useEffect(() => { load() }, [dateFilter, statusFilter])

  function prevDay() {
    const d = new Date(dateFilter); d.setDate(d.getDate() - 1)
    setDateFilter(d.toISOString().slice(0, 10))
  }
  function nextDay() {
    const d = new Date(dateFilter); d.setDate(d.getDate() + 1)
    setDateFilter(d.toISOString().slice(0, 10))
  }

  function openNew() {
    setForm({
      customerId: '', tableId: '', guestName: '', guestPhone: '',
      reservationDate: `${dateFilter}T19:00`,
      partySize: 2, status: 'pending', notes: '',
    })
    setEditId(null)
    setModal(true)
  }

  function openEdit(r: Reservation) {
    setForm({
      customerId:      String(r.customerId ?? ''),
      tableId:         String(r.tableId   ?? ''),
      guestName:       r.guestName,
      guestPhone:      r.guestPhone ?? '',
      reservationDate: localDatetimeStr(r.reservationDate),
      partySize:       r.partySize,
      status:          r.status,
      notes:           r.notes ?? '',
    })
    setEditId(r.id)
    setModal(true)
  }

  async function save() {
    if (!form.guestName.trim() || !form.reservationDate) return
    setSaving(true)
    const payload = {
      customerId:      form.customerId ? parseInt(form.customerId) : null,
      tableId:         form.tableId    ? parseInt(form.tableId)    : null,
      guestName:       form.guestName,
      guestPhone:      form.guestPhone || null,
      reservationDate: form.reservationDate,
      partySize:       form.partySize,
      status:          form.status,
      notes:           form.notes || null,
    }
    if (editId) await window.api.reservations.update({ ...payload, id: editId })
    else        await window.api.reservations.create(payload)
    setSaving(false)
    setModal(false)
    load()
  }

  async function changeStatus(r: Reservation, status: string) {
    await window.api.reservations.updateStatus({ id: r.id, status })
    load()
  }

  async function del(r: Reservation) {
    if (!confirm(`حذف حجز "${r.guestName}"؟`)) return
    await window.api.reservations.delete(r.id)
    load()
  }

  const stats = Object.keys(STATUS_LABELS).map(s => ({
    status: s, ...STATUS_LABELS[s], count: list.filter(r => r.status === s).length,
  })).filter(s => s.count > 0)

  function exportExcel() {
    const headers = ['اسم الضيف', 'الهاتف', 'التاريخ والوقت', 'عدد الأشخاص', 'الطاولة', 'العميل', 'الحالة', 'ملاحظات']
    const rows = list.map(r => [
      r.guestName,
      r.guestPhone ?? '',
      new Date(r.reservationDate).toLocaleString('ar-EG'),
      r.partySize,
      r.table ? `طاولة ${r.table.number}` : '',
      r.customer?.name ?? '',
      STATUS_LABELS[r.status]?.label ?? r.status,
      r.notes ?? '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [22, 15, 20, 12, 12, 18, 12, 25].map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'الحجوزات')
    XLSX.writeFile(wb, `reservations-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الحجوزات</h1>
          <p className="text-slate-500 text-sm mt-0.5">{list.length} حجز</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} disabled={list.length === 0}
            className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-4 py-2.5 rounded-xl hover:bg-green-100 transition-colors text-sm font-medium disabled:opacity-40">
            <Download size={16} /> Excel
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium">
            <Plus size={16} /> حجز جديد
          </button>
        </div>
      </div>

      {/* Date nav + status filter */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <button onClick={prevDay} className="p-2.5 hover:bg-slate-50 transition-colors">
            <ChevronRight size={16} className="text-slate-500" />
          </button>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            className="px-2 py-2 text-sm outline-none border-x border-slate-200 text-slate-700" />
          <button onClick={nextDay} className="p-2.5 hover:bg-slate-50 transition-colors">
            <ChevronLeft size={16} className="text-slate-500" />
          </button>
        </div>
        <button onClick={() => setDateFilter(todayStr())}
          className="px-4 py-2.5 text-sm border border-slate-200 bg-white rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
          اليوم
        </button>
        <button onClick={() => setDateFilter('')}
          className={`px-4 py-2.5 text-sm border rounded-xl transition-colors ${!dateFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          كل التواريخ
        </button>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-600 outline-none">
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Status summary */}
      {stats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.map(s => (
            <span key={s.status} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${s.color}`}>
              {s.label} ({s.count})
            </span>
          ))}
        </div>
      )}

      {/* List */}
      <div className="space-y-3">
        {list.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-16 text-center text-slate-400">
            <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا يوجد حجوزات</p>
          </div>
        ) : list.map(r => {
          const dt = new Date(r.reservationDate)
          const timeStr = dt.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
          const dateStr = dt.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric', month: 'short' })
          const st = STATUS_LABELS[r.status] ?? STATUS_LABELS.pending
          return (
            <div key={r.id} className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4">
              {/* Time block */}
              <div className="flex-shrink-0 w-20 text-center bg-slate-50 rounded-xl p-3">
                <p className="text-lg font-bold text-slate-800">{timeStr}</p>
                <p className="text-xs text-slate-500">{dateStr}</p>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-slate-800">{r.guestName}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${st.color}`}>{st.label}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><Users size={11} />{r.partySize} أشخاص</span>
                  {r.table && <span className="flex items-center gap-1"><span>طاولة {r.table.number}</span></span>}
                  {r.guestPhone && <span className="flex items-center gap-1"><Clock size={11} />{r.guestPhone}</span>}
                  {r.customer && <span className="text-blue-600">({r.customer.name})</span>}
                  {r.notes && <span className="text-slate-400 italic truncate max-w-xs">{r.notes}</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {/* Quick status transitions */}
                {r.status === 'pending'   && <button onClick={() => changeStatus(r, 'confirmed')} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">تأكيد</button>}
                {r.status === 'confirmed' && <button onClick={() => changeStatus(r, 'seated')}    className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">جلوس</button>}
                {r.status === 'seated'    && <button onClick={() => changeStatus(r, 'completed')} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">اكتمل</button>}
                {(r.status === 'pending' || r.status === 'confirmed') && (
                  <button onClick={() => changeStatus(r, 'cancelled')} className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors">إلغاء</button>
                )}
                <button onClick={() => openEdit(r)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                <button onClick={() => del(r)}     className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">{editId ? 'تعديل حجز' : 'حجز جديد'}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">اسم الضيف *</label>
                  <input value={form.guestName} onChange={e => setForm(f => ({ ...f, guestName: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="الاسم" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">هاتف الضيف</label>
                  <input value={form.guestPhone} onChange={e => setForm(f => ({ ...f, guestPhone: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="05xxxxxxxx" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">التاريخ والوقت *</label>
                  <input type="datetime-local" value={form.reservationDate} onChange={e => setForm(f => ({ ...f, reservationDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">عدد الأشخاص</label>
                  <input type="number" min="1" max="50" value={form.partySize} onChange={e => setForm(f => ({ ...f, partySize: +e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">الطاولة</label>
                  <select value={form.tableId} onChange={e => setForm(f => ({ ...f, tableId: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">غير محددة</option>
                    {tables.map(t => <option key={t.id} value={t.id}>طاولة {t.number} ({t.capacity} أشخاص)</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">العميل (اختياري)</label>
                  <select value={form.customerId} onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">بدون عميل مسجل</option>
                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">الحالة</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">ملاحظات</label>
                  <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="ملاحظات..." />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={save} disabled={saving || !form.guestName.trim() || !form.reservationDate}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium flex items-center justify-center gap-2">
                <Check size={15} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button onClick={() => setModal(false)}
                className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
