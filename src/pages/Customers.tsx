import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Users, Plus, Pencil, Trash2, Star, Phone, Mail, Search, ToggleLeft, ToggleRight, X, Check, Download } from 'lucide-react'
import type { Customer } from '../types'

const EMPTY: Omit<Customer, 'id' | 'createdAt'> = {
  name: '', phone: '', email: '', birthDate: '', loyaltyPoints: 0, notes: '', isActive: true,
}

export default function Customers() {
  const [list,    setList]    = useState<Customer[]>([])
  const [search,  setSearch]  = useState('')
  const [showAll, setShowAll] = useState(false)
  const [modal,   setModal]   = useState(false)
  const [form,    setForm]    = useState<typeof EMPTY>({ ...EMPTY })
  const [editId,  setEditId]  = useState<number | null>(null)
  const [saving,  setSaving]  = useState(false)
  const [pointsModal, setPointsModal] = useState<Customer | null>(null)
  const [addPts,  setAddPts]  = useState('')

  async function load() {
    setList(await window.api.customers.getAll(showAll))
  }

  useEffect(() => { load() }, [showAll])

  function openNew() {
    setForm({ ...EMPTY })
    setEditId(null)
    setModal(true)
  }

  function openEdit(c: Customer) {
    setForm({
      name: c.name, phone: c.phone ?? '', email: c.email ?? '',
      birthDate: c.birthDate ?? '', loyaltyPoints: c.loyaltyPoints,
      notes: c.notes ?? '', isActive: c.isActive,
    })
    setEditId(c.id)
    setModal(true)
  }

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    if (editId) await window.api.customers.update({ ...form, id: editId })
    else        await window.api.customers.create(form)
    setSaving(false)
    setModal(false)
    load()
  }

  async function del(c: Customer) {
    if (!confirm(`حذف "${c.name}"؟`)) return
    await window.api.customers.delete(c.id)
    load()
  }

  async function addPoints() {
    const pts = parseInt(addPts)
    if (!pointsModal || isNaN(pts) || pts === 0) return
    await window.api.customers.addPoints({ id: pointsModal.id, points: pts })
    setPointsModal(null)
    setAddPts('')
    load()
  }

  const filtered = list.filter(c =>
    c.name.includes(search) || (c.phone ?? '').includes(search) || (c.email ?? '').includes(search)
  )

  const totalPoints = list.reduce((s, c) => s + c.loyaltyPoints, 0)

  function exportExcel() {
    const headers = ['الاسم', 'الهاتف', 'البريد', 'تاريخ الميلاد', 'نقاط الولاء', 'الحالة', 'تاريخ الإنشاء']
    const rows = filtered.map(c => [
      c.name, c.phone ?? '', c.email ?? '', c.birthDate ?? '',
      c.loyaltyPoints, c.isActive ? 'نشط' : 'غير نشط',
      new Date(c.createdAt).toLocaleDateString('ar-EG'),
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [22, 15, 25, 15, 12, 10, 15].map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'العملاء')
    XLSX.writeFile(wb, `customers-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">العملاء</h1>
          <p className="text-slate-500 text-sm mt-0.5">{list.length} عميل • {totalPoints.toLocaleString()} نقطة ولاء إجمالية</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} disabled={filtered.length === 0}
            className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-4 py-2.5 rounded-xl hover:bg-green-100 transition-colors text-sm font-medium disabled:opacity-40">
            <Download size={16} /> Excel
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium">
            <Plus size={16} /> عميل جديد
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الهاتف..."
            className="w-full border border-slate-200 rounded-xl pr-9 pl-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button onClick={() => setShowAll(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
          {showAll ? <ToggleRight size={16} className="text-blue-600" /> : <ToggleLeft size={16} />}
          {showAll ? 'الكل' : 'النشطون فقط'}
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-16 text-center text-slate-400">
            <Users size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا يوجد عملاء</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-right px-5 py-3 font-medium text-slate-600">الاسم</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">الهاتف</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">البريد</th>
                <th className="text-right px-4 py-3 font-medium text-slate-600">تاريخ الميلاد</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">نقاط الولاء</th>
                <th className="text-center px-4 py-3 font-medium text-slate-600">الحالة</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.phone ? <span className="flex items-center gap-1"><Phone size={12} />{c.phone}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {c.email ? <span className="flex items-center gap-1"><Mail size={12} />{c.email}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{c.birthDate || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => { setPointsModal(c); setAddPts('') }}
                      className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-xs font-medium hover:bg-amber-100 transition-colors">
                      <Star size={11} fill="currentColor" /> {c.loyaltyPoints.toLocaleString()}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${c.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                      {c.isActive ? 'نشط' : 'غير نشط'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(c)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => del(c)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Customer Form Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">{editId ? 'تعديل عميل' : 'عميل جديد'}</h2>
              <button onClick={() => setModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">الاسم *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="اسم العميل" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">الهاتف</label>
                  <input value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="05xxxxxxxx" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">البريد الإلكتروني</label>
                  <input value={form.email ?? ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="example@email.com" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">تاريخ الميلاد</label>
                  <input type="date" value={form.birthDate ?? ''} onChange={e => setForm(f => ({ ...f, birthDate: e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1.5">نقاط الولاء</label>
                  <input type="number" min="0" value={form.loyaltyPoints} onChange={e => setForm(f => ({ ...f, loyaltyPoints: +e.target.value }))}
                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-1.5">ملاحظات</label>
                <textarea value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder="ملاحظات اختيارية..." />
              </div>
              {editId && (
                <div onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
                  className="flex items-center gap-2 cursor-pointer select-none">
                  {form.isActive
                    ? <ToggleRight size={22} className="text-blue-600" />
                    : <ToggleLeft  size={22} className="text-slate-400" />}
                  <span className="text-sm text-slate-700">نشط</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-100">
              <button onClick={save} disabled={saving || !form.name.trim()}
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

      {/* Points Modal */}
      {pointsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">نقاط الولاء — {pointsModal.name}</h2>
              <button onClick={() => setPointsModal(null)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-center gap-2 bg-amber-50 rounded-xl p-6 mb-4">
                <Star size={28} fill="#f59e0b" className="text-amber-500" />
                <span className="text-4xl font-bold text-amber-700">{pointsModal.loyaltyPoints.toLocaleString()}</span>
                <span className="text-amber-500 text-sm">نقطة</span>
              </div>
              <label className="text-sm font-medium text-slate-700 block mb-1.5">إضافة / خصم نقاط</label>
              <input type="number" value={addPts} onChange={e => setAddPts(e.target.value)}
                placeholder="أدخل رقماً (سالب للخصم)"
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 mb-4" />
              <div className="flex gap-3">
                <button onClick={addPoints}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl hover:bg-blue-700 transition-colors text-sm font-medium">
                  تحديث
                </button>
                <button onClick={() => setPointsModal(null)}
                  className="px-6 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
