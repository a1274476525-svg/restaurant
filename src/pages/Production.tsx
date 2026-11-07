import { useEffect, useState } from 'react'
import { Plus, X, Trash2, Factory, ChevronDown, ChevronUp } from 'lucide-react'
import type { Production, Ingredient } from '../types'
import { Field, inputCls, DeleteConfirm } from '../components/ui'

interface ItemRow { ingredientId: number; quantity: number }

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function ProductionPage() {
  const [records, setRecords]     = useState<Production[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [showForm, setShowForm]   = useState(false)
  const [expanded, setExpanded]   = useState<number | null>(null)
  const [deleteId, setDeleteId]   = useState<number | null>(null)
  const [saving, setSaving]       = useState(false)

  const [form, setForm] = useState({
    date: todayLocal(),
    note: '',
    inputs:  [] as ItemRow[],
    outputs: [] as ItemRow[],
  })

  const load = () =>
    window.api.production.getAll().then(setRecords)

  useEffect(() => {
    Promise.all([
      window.api.production.getAll(),
      window.api.ingredients.getAll(),
    ]).then(([p, i]) => { setRecords(p); setIngredients(i) })
  }, [])

  const addRow = (type: 'inputs' | 'outputs') =>
    setForm(f => ({
      ...f,
      [type]: [...f[type], { ingredientId: ingredients[0]?.id || 0, quantity: 0 }],
    }))

  const removeRow = (type: 'inputs' | 'outputs', idx: number) =>
    setForm(f => ({ ...f, [type]: f[type].filter((_, i) => i !== idx) }))

  const updateRow = (type: 'inputs' | 'outputs', idx: number, field: keyof ItemRow, val: number) =>
    setForm(f => ({
      ...f,
      [type]: f[type].map((r, i) => i === idx ? { ...r, [field]: val } : r),
    }))

  const openForm = () => {
    setForm({
      date: todayLocal(),
      note: '',
      inputs:  ingredients.length > 0 ? [{ ingredientId: ingredients[0].id, quantity: 0 }] : [],
      outputs: [],
    })
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.inputs.length === 0 && form.outputs.length === 0) return
    setSaving(true)
    try {
      await window.api.production.create({
        date:    form.date,
        note:    form.note || undefined,
        inputs:  form.inputs.filter(r => r.quantity > 0),
        outputs: form.outputs.filter(r => r.quantity > 0),
      })
      setShowForm(false)
      load()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (deleteId == null) return
    await window.api.production.delete(deleteId)
    setDeleteId(null)
    load()
  }

  const ingName = (id: number) => ingredients.find(i => i.id === id)?.name ?? '—'
  const ingUnit = (id: number) => ingredients.find(i => i.id === id)?.unit ?? ''

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الإنتاج</h1>
          <p className="text-slate-400 text-sm mt-0.5">{records.length} دفعة إنتاج</p>
        </div>
        <button onClick={openForm} disabled={ingredients.length === 0}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
          <Plus size={16} /> دفعة إنتاج جديدة
        </button>
      </div>

      {/* Records */}
      <div className="space-y-3">
        {records.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm px-6 py-12 text-center text-slate-400">
            <Factory size={40} className="mx-auto mb-3 opacity-30" />
            لا توجد دفعات إنتاج مسجلة
          </div>
        )}

        {records.map(rec => {
          const inputs  = rec.items.filter(i => i.type === 'input')
          const outputs = rec.items.filter(i => i.type === 'output')
          const isOpen  = expanded === rec.id
          return (
            <div key={rec.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 select-none"
                onClick={() => setExpanded(isOpen ? null : rec.id)}
              >
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  #{rec.id}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">
                    {new Date(rec.date).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                  {rec.note && <p className="text-slate-400 text-xs mt-0.5">{rec.note}</p>}
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-500">
                  <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-xs font-medium">
                    {inputs.length} مدخل
                  </span>
                  <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                    {outputs.length} مخرج
                  </span>
                  {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); setDeleteId(rec.id) }}
                  className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-slate-100 px-5 py-4 grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2">المدخلات (خصم)</p>
                    {inputs.length === 0
                      ? <p className="text-slate-400 text-sm">لا يوجد</p>
                      : inputs.map(item => (
                        <div key={item.id} className="flex justify-between text-sm py-1 border-b border-slate-50">
                          <span className="text-slate-700">{item.ingredient?.name}</span>
                          <span className="font-mono text-red-500">−{item.quantity} {item.ingredient?.unit}</span>
                        </div>
                      ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-green-600 uppercase tracking-wider mb-2">المخرجات (إضافة)</p>
                    {outputs.length === 0
                      ? <p className="text-slate-400 text-sm">لا يوجد</p>
                      : outputs.map(item => (
                        <div key={item.id} className="flex justify-between text-sm py-1 border-b border-slate-50">
                          <span className="text-slate-700">{item.ingredient?.name}</span>
                          <span className="font-mono text-green-600">+{item.quantity} {item.ingredient?.unit}</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">دفعة إنتاج جديدة</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <Field label="التاريخ *">
                  <input type="date" required value={form.date}
                    onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    className={inputCls} />
                </Field>
                <Field label="ملاحظة">
                  <input value={form.note}
                    onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    className={inputCls} placeholder="وصف الدفعة..." />
                </Field>
              </div>

              {/* Inputs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-red-600">المدخلات (مواد تُستهلك)</p>
                  <button type="button" onClick={() => addRow('inputs')}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <Plus size={13} /> إضافة
                  </button>
                </div>
                {form.inputs.length === 0
                  ? <p className="text-slate-400 text-sm">لا توجد مدخلات</p>
                  : form.inputs.map((row, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <select value={row.ingredientId}
                        onChange={e => updateRow('inputs', idx, 'ingredientId', +e.target.value)}
                        className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        {ingredients.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.currentStock} {i.unit})</option>
                        ))}
                      </select>
                      <input type="number" step="0.001" min="0" placeholder="الكمية"
                        value={row.quantity || ''}
                        onChange={e => updateRow('inputs', idx, 'quantity', +e.target.value)}
                        className="w-28 shrink-0 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono" />
                      <span className="text-slate-400 text-sm self-center w-12 shrink-0">{ingUnit(row.ingredientId)}</span>
                      <button type="button" onClick={() => removeRow('inputs', idx)}
                        className="text-slate-300 hover:text-red-500 p-1"><X size={15} /></button>
                    </div>
                  ))}
              </div>

              {/* Outputs */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-green-600">المخرجات (مواد تُضاف)</p>
                  <button type="button" onClick={() => addRow('outputs')}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <Plus size={13} /> إضافة
                  </button>
                </div>
                {form.outputs.length === 0
                  ? <p className="text-slate-400 text-sm">لا توجد مخرجات</p>
                  : form.outputs.map((row, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <select value={row.ingredientId}
                        onChange={e => updateRow('outputs', idx, 'ingredientId', +e.target.value)}
                        className="flex-1 min-w-0 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        {ingredients.map(i => (
                          <option key={i.id} value={i.id}>{i.name}</option>
                        ))}
                      </select>
                      <input type="number" step="0.001" min="0" placeholder="الكمية"
                        value={row.quantity || ''}
                        onChange={e => updateRow('outputs', idx, 'quantity', +e.target.value)}
                        className="w-28 shrink-0 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white font-mono" />
                      <span className="text-slate-400 text-sm self-center w-12 shrink-0">{ingUnit(row.ingredientId)}</span>
                      <button type="button" onClick={() => removeRow('outputs', idx)}
                        className="text-slate-300 hover:text-red-500 p-1"><X size={15} /></button>
                    </div>
                  ))}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving || (form.inputs.length === 0 && form.outputs.length === 0)}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'جاري الحفظ...' : 'تسجيل الإنتاج'}
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
          message="سيتم عكس تأثير الإنتاج على المخزون. هل أنت متأكد؟"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
