import { useEffect, useState } from 'react'
import { Plus, X, Trash2, ChevronDown, ChevronUp, ArrowRight, Play } from 'lucide-react'
import type { TransferRequest, Warehouse, Ingredient } from '../types'
import { Field, inputCls, DeleteConfirm } from '../components/ui'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:    { label: 'معلق',    color: 'bg-yellow-100 text-yellow-700' },
  approved:   { label: 'معتمد',   color: 'bg-blue-100 text-blue-700' },
  rejected:   { label: 'مرفوض',   color: 'bg-red-100 text-red-600' },
  transferred:{ label: 'مُنفَّذ', color: 'bg-green-100 text-green-700' },
}

interface ItemRow { ingredientId: number; quantity: number; notes: string }

export default function TransferRequestsPage() {
  const [requests,    setRequests]    = useState<TransferRequest[]>([])
  const [warehouses,  setWarehouses]  = useState<Warehouse[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [showForm,    setShowForm]    = useState(false)
  const [expanded,    setExpanded]    = useState<number | null>(null)
  const [deleteId,    setDeleteId]    = useState<number | null>(null)
  const [executing,   setExecuting]   = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [saving,      setSaving]      = useState(false)

  const [form, setForm] = useState({
    fromWarehouseId: '',
    toWarehouseId:   '',
    note:            '',
    items:           [] as ItemRow[],
  })

  const load = () => window.api.transferRequests.getAll().then(setRequests)

  useEffect(() => {
    Promise.all([
      window.api.transferRequests.getAll(),
      window.api.warehouses.getAll(),
      window.api.ingredients.getAll(),
    ]).then(([r, w, i]) => { setRequests(r); setWarehouses(w); setIngredients(i) })
  }, [])

  const openForm = () => {
    const wh = warehouses
    setForm({
      fromWarehouseId: String(wh[0]?.id ?? ''),
      toWarehouseId:   String(wh[1]?.id ?? wh[0]?.id ?? ''),
      note:            '',
      items:           ingredients.length > 0
        ? [{ ingredientId: ingredients[0].id, quantity: 0, notes: '' }]
        : [],
    })
    setShowForm(true)
  }

  const addRow = () => setForm(f => ({
    ...f,
    items: [...f.items, { ingredientId: ingredients[0]?.id || 0, quantity: 0, notes: '' }],
  }))

  const removeRow = (idx: number) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))

  const updateRow = (idx: number, field: keyof ItemRow, val: string | number) =>
    setForm(f => ({ ...f, items: f.items.map((r, i) => i === idx ? { ...r, [field]: val } : r) }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (+form.fromWarehouseId === +form.toWarehouseId) { alert('المخزن المصدر والوجهة لا يمكن أن يكونا نفس المخزن'); return }
    const validItems = form.items.filter(r => r.quantity > 0)
    if (validItems.length === 0) return
    setSaving(true)
    try {
      await window.api.transferRequests.create({
        fromWarehouseId: +form.fromWarehouseId,
        toWarehouseId:   +form.toWarehouseId,
        note:            form.note || undefined,
        items:           validItems,
      })
      setShowForm(false)
      load()
    } finally { setSaving(false) }
  }

  const handleStatusChange = async (id: number, status: string) => {
    await window.api.transferRequests.updateStatus({ id, status })
    load()
  }

  const handleExecute = async (id: number) => {
    setExecuting(id)
    try {
      await window.api.transfers.execute(id)
      load()
    } catch (err: any) { alert(err.message || 'حدث خطأ') }
    finally { setExecuting(null) }
  }

  const handleDelete = async () => {
    if (deleteId == null) return
    try {
      await window.api.transferRequests.delete(deleteId)
      load()
    } catch (err: any) { alert(err.message || 'حدث خطأ') }
    setDeleteId(null)
  }

  const visible = filterStatus ? requests.filter(r => r.status === filterStatus) : requests

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">طلبات التحويل</h1>
          <p className="text-slate-400 text-sm mt-0.5">{requests.length} طلب مسجل</p>
        </div>
        <button onClick={openForm} disabled={warehouses.length < 2}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-50">
          <Plus size={16} /> طلب تحويل جديد
        </button>
      </div>

      {warehouses.length < 2 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 text-sm text-amber-700 mb-5">
          تحتاج إلى مخزنين على الأقل لإنشاء طلب تحويل. أضف مخازن من صفحة الفروع والمخازن.
        </div>
      )}

      {/* Filter tabs */}
      <div className="bg-white rounded-xl shadow-sm mb-5">
        <div className="flex items-center border-b border-slate-100 px-4">
          {[{ key: '', label: 'الكل' }, ...Object.entries(STATUS_CONFIG).map(([k, v]) => ({ key: k, label: v.label }))].map(tab => (
            <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors mr-1 ${
                filterStatus === tab.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="divide-y divide-slate-50">
          {visible.length === 0 && (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">لا توجد طلبات</div>
          )}
          {visible.map(req => {
            const cfg    = STATUS_CONFIG[req.status] ?? { label: req.status, color: 'bg-slate-100 text-slate-600' }
            const isOpen = expanded === req.id
            return (
              <div key={req.id}>
                <div
                  onClick={() => setExpanded(isOpen ? null : req.id)}
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 select-none">
                  <span className="font-mono text-sm font-semibold text-blue-600">{req.referenceNumber}</span>
                  <div className="flex items-center gap-2 text-sm text-slate-600 flex-1">
                    <span>{req.fromWarehouse?.name}</span>
                    <ArrowRight size={14} className="text-slate-300" />
                    <span>{req.toWarehouse?.name}</span>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                  <span className="text-slate-400 text-sm">{req.items.length} صنف</span>
                  <span className="text-slate-400 text-xs">{new Date(req.createdAt).toLocaleDateString('ar-EG')}</span>
                  {isOpen ? <ChevronUp size={15} className="text-slate-300" /> : <ChevronDown size={15} className="text-slate-300" />}
                  {req.status !== 'transferred' && (
                    <button onClick={e => { e.stopPropagation(); setDeleteId(req.id) }}
                      className="p-1.5 text-slate-200 hover:text-red-500 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="border-t border-slate-100 px-5 py-4 bg-slate-50/40">
                    <table className="w-full text-sm mb-4">
                      <thead><tr className="text-slate-400 text-xs border-b border-slate-100">
                        <th className="text-right pb-2 font-semibold">المادة</th>
                        <th className="text-right pb-2 font-semibold">الكمية</th>
                        <th className="text-right pb-2 font-semibold">ملاحظة</th>
                      </tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {req.items.map(item => (
                          <tr key={item.id}>
                            <td className="py-2 text-slate-700">{item.ingredient?.name}</td>
                            <td className="py-2 font-mono">{item.quantity} {item.ingredient?.unit}</td>
                            <td className="py-2 text-slate-400">{item.notes ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {req.note && <p className="text-slate-500 text-sm mb-3">ملاحظة: {req.note}</p>}

                    {/* Actions */}
                    {req.status !== 'transferred' && req.status !== 'rejected' && (
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                        {req.status === 'approved' && (
                          <button
                            onClick={() => handleExecute(req.id)}
                            disabled={executing === req.id}
                            className="flex items-center gap-1.5 bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium">
                            <Play size={12} /> {executing === req.id ? 'جاري التنفيذ...' : 'تنفيذ التحويل'}
                          </button>
                        )}
                        {req.status === 'pending' && (
                          <button onClick={() => handleStatusChange(req.id, 'approved')}
                            className="text-xs px-3 py-1.5 rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium">
                            اعتماد
                          </button>
                        )}
                        <button onClick={() => handleStatusChange(req.id, 'rejected')}
                          className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 font-medium">
                          رفض
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">طلب تحويل جديد</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <Field label="من مخزن *">
                  <select value={form.fromWarehouseId}
                    onChange={e => setForm(f => ({ ...f, fromWarehouseId: e.target.value }))}
                    className={inputCls}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} — {w.branch?.name}</option>)}
                  </select>
                </Field>
                <Field label="إلى مخزن *">
                  <select value={form.toWarehouseId}
                    onChange={e => setForm(f => ({ ...f, toWarehouseId: e.target.value }))}
                    className={inputCls}>
                    {warehouses.map(w => <option key={w.id} value={w.id}>{w.name} — {w.branch?.name}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="ملاحظة">
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className={inputCls} placeholder="سبب الطلب..." />
              </Field>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-700">المواد المطلوب تحويلها</p>
                  <button type="button" onClick={addRow}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <Plus size={13} /> إضافة مادة
                  </button>
                </div>
                {form.items.map((row, idx) => (
                  <div key={idx} className="flex gap-2 mb-2 items-center">
                    <select value={row.ingredientId}
                      onChange={e => updateRow(idx, 'ingredientId', +e.target.value)}
                      className={`${inputCls} flex-1`}>
                      {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                    <input type="number" step="0.001" min="0" placeholder="الكمية" required
                      value={row.quantity || ''}
                      onChange={e => updateRow(idx, 'quantity', +e.target.value)}
                      className={`${inputCls} w-24`} />
                    <input placeholder="ملاحظة" value={row.notes}
                      onChange={e => updateRow(idx, 'notes', e.target.value)}
                      className={`${inputCls} w-28`} />
                    <button type="button" onClick={() => removeRow(idx)}
                      className="text-slate-300 hover:text-red-500 p-1"><X size={15} /></button>
                  </div>
                ))}
                {form.items.length === 0 && (
                  <p className="text-slate-400 text-sm text-center py-3">أضف مادة واحدة على الأقل</p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit"
                  disabled={saving || form.items.filter(r => r.quantity > 0).length === 0}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'جاري الحفظ...' : 'إنشاء الطلب'}
                </button>
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg text-sm font-medium">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteId != null && (
        <DeleteConfirm
          message="هل تريد حذف طلب التحويل هذا؟"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
