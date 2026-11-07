import { useEffect, useState } from 'react'
import { Plus, X, Trash2, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react'
import type { Transfer, Warehouse, Ingredient } from '../types'
import { Field, inputCls, DeleteConfirm } from '../components/ui'

interface ItemRow { ingredientId: number; quantity: number }

export default function TransfersPage() {
  const [transfers,   setTransfers]   = useState<Transfer[]>([])
  const [warehouses,  setWarehouses]  = useState<Warehouse[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [showForm,    setShowForm]    = useState(false)
  const [expanded,    setExpanded]    = useState<number | null>(null)
  const [deleteId,    setDeleteId]    = useState<number | null>(null)
  const [saving,      setSaving]      = useState(false)

  const [form, setForm] = useState({
    fromWarehouseId: '',
    toWarehouseId:   '',
    note:            '',
    items:           [] as ItemRow[],
  })

  const load = () => window.api.transfers.getAll().then(setTransfers)

  useEffect(() => {
    Promise.all([
      window.api.transfers.getAll(),
      window.api.warehouses.getAll(),
      window.api.ingredients.getAll(),
    ]).then(([t, w, i]) => { setTransfers(t); setWarehouses(w); setIngredients(i) })
  }, [])

  const openForm = () => {
    setForm({
      fromWarehouseId: String(warehouses[0]?.id ?? ''),
      toWarehouseId:   String(warehouses[1]?.id ?? warehouses[0]?.id ?? ''),
      note:            '',
      items:           ingredients.length > 0 ? [{ ingredientId: ingredients[0].id, quantity: 0 }] : [],
    })
    setShowForm(true)
  }

  const addRow = () => setForm(f => ({
    ...f, items: [...f.items, { ingredientId: ingredients[0]?.id || 0, quantity: 0 }],
  }))
  const removeRow = (idx: number) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
  const updateRow = (idx: number, field: keyof ItemRow, val: number) =>
    setForm(f => ({ ...f, items: f.items.map((r, i) => i === idx ? { ...r, [field]: val } : r) }))

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (+form.fromWarehouseId === +form.toWarehouseId) { alert('المخزن المصدر والوجهة لا يمكن أن يكونا نفس المخزن'); return }
    const validItems = form.items.filter(r => r.quantity > 0)
    if (validItems.length === 0) return
    setSaving(true)
    try {
      await window.api.transfers.createDirect({
        fromWarehouseId: +form.fromWarehouseId,
        toWarehouseId:   +form.toWarehouseId,
        note:            form.note || undefined,
        items:           validItems,
      })
      setShowForm(false)
      load()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (deleteId == null) return
    await window.api.transfers.delete(deleteId)
    setDeleteId(null)
    load()
  }

  const ingUnit = (id: number) => ingredients.find(i => i.id === id)?.unit ?? ''

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">التحويلات</h1>
          <p className="text-slate-400 text-sm mt-0.5">{transfers.length} تحويل مسجل</p>
        </div>
        <button onClick={openForm} disabled={warehouses.length < 2}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-semibold disabled:opacity-50">
          <Plus size={16} /> تحويل مباشر
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['الرقم المرجعي', 'من', '', 'إلى', 'عدد الأصناف', 'التاريخ', ''].map((h, i) => (
                <th key={i} className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {transfers.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-400 text-sm">لا توجد تحويلات</td></tr>
            )}
            {transfers.map(tr => {
              const isOpen = expanded === tr.id
              return (
                <>
                  <tr key={tr.id}
                    onClick={() => setExpanded(isOpen ? null : tr.id)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors group">
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm font-semibold text-indigo-600">{tr.referenceNumber}</span>
                      {tr.request && (
                        <span className="mr-2 text-xs text-slate-400">({tr.request.referenceNumber})</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{tr.fromWarehouse?.name}</td>
                    <td className="px-2 py-3"><ArrowRight size={14} className="text-slate-300" /></td>
                    <td className="px-4 py-3 text-sm text-slate-700">{tr.toWarehouse?.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{tr.items.length} صنف</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {new Date(tr.transferDate).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); setDeleteId(tr.id) }}
                          className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                        {isOpen ? <ChevronUp size={15} className="text-slate-300" /> : <ChevronDown size={15} className="text-slate-300" />}
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={`${tr.id}-detail`}>
                      <td colSpan={7} className="bg-slate-50/60 px-8 py-3 border-b border-slate-100">
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            {tr.note && <p className="text-slate-500 text-sm mb-2">ملاحظة: {tr.note}</p>}
                            <table className="w-full text-sm">
                              <thead><tr className="text-slate-400 text-xs border-b border-slate-100">
                                <th className="text-right pb-1 font-semibold">المادة</th>
                                <th className="text-right pb-1 font-semibold">الكمية</th>
                              </tr></thead>
                              <tbody>
                                {tr.items.map(item => (
                                  <tr key={item.id}>
                                    <td className="py-1.5 text-slate-700">{item.ingredient?.name}</td>
                                    <td className="py-1.5 font-mono text-indigo-600">
                                      {item.quantity} {item.ingredient?.unit}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="text-sm text-slate-500 space-y-1">
                            <p>من: <span className="font-medium text-slate-700">{tr.fromWarehouse?.name}</span> — {tr.fromWarehouse?.branch?.name}</p>
                            <p>إلى: <span className="font-medium text-slate-700">{tr.toWarehouse?.name}</span> — {tr.toWarehouse?.branch?.name}</p>
                            <p>التاريخ: {new Date(tr.transferDate).toLocaleDateString('ar-EG')}</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Direct transfer form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">تحويل مباشر</h2>
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
                  className={inputCls} placeholder="سبب التحويل..." />
              </Field>
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-700">المواد</p>
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
                    <span className="text-slate-400 text-sm w-10 shrink-0">{ingUnit(row.ingredientId)}</span>
                    <button type="button" onClick={() => removeRow(idx)}
                      className="text-slate-300 hover:text-red-500 p-1"><X size={15} /></button>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit"
                  disabled={saving || form.items.filter(r => r.quantity > 0).length === 0}
                  className="flex-1 bg-indigo-600 text-white py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'جاري التنفيذ...' : 'تنفيذ التحويل'}
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
          message="سيتم عكس تأثير التحويل على أرصدة المخازن. هل أنت متأكد؟"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
