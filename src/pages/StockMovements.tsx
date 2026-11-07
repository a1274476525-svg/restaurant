import { useEffect, useState } from 'react'
import { Plus, X, Filter } from 'lucide-react'
import type { StockMovement, Ingredient } from '../types'
import { Field, inputCls } from '../components/ui'

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  purchase: { label: 'شراء',   color: 'bg-green-100 text-green-700' },
  sale:     { label: 'بيع',    color: 'bg-red-100 text-red-600' },
  waste:    { label: 'هالك',   color: 'bg-orange-100 text-orange-700' },
  adjust:   { label: 'تعديل',  color: 'bg-blue-100 text-blue-700' },
}

export default function StockMovements() {
  const [movements, setMovements]         = useState<StockMovement[]>([])
  const [ingredients, setIngredients]     = useState<Ingredient[]>([])
  const [filterIngredient, setFilterIng] = useState('')
  const [filterType, setFilterType]       = useState('')
  const [showForm, setShowForm]           = useState(false)
  const [form, setForm] = useState({ ingredientId: 0, type: 'waste', quantity: 0, note: '' })
  const [saving, setSaving] = useState(false)

  const load = () => window.api.stock.getMovements().then(setMovements)

  useEffect(() => {
    Promise.all([
      window.api.stock.getMovements(),
      window.api.ingredients.getAll(),
    ]).then(([m, i]) => {
      setMovements(m)
      setIngredients(i)
      if (i.length > 0) setForm(f => ({ ...f, ingredientId: i[0].id }))
    })
  }, [])

  const filtered = movements.filter(m => {
    if (filterIngredient && m.ingredientId !== +filterIngredient) return false
    if (filterType       && m.type !== filterType)               return false
    return true
  })

  const openForm = () => {
    setForm({ ingredientId: ingredients[0]?.id || 0, type: 'waste', quantity: 0, note: '' })
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.quantity === 0) return
    setSaving(true)
    try {
      const qty = form.type === 'waste' ? -Math.abs(form.quantity) : form.quantity
      await window.api.stock.adjust({
        ingredientId: form.ingredientId,
        quantity: qty,
        note: form.note || undefined,
      })
      setShowForm(false)
      load()
    } finally { setSaving(false) }
  }

  const ing = (id: number) => ingredients.find(i => i.id === id)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">حركات المخزون</h1>
          <p className="text-slate-400 text-sm mt-0.5">{movements.length} حركة مسجلة</p>
        </div>
        <button onClick={openForm} disabled={ingredients.length === 0}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
          <Plus size={16} /> تسجيل تعديل / هالك
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-5 flex flex-wrap items-center gap-3">
        <Filter size={15} className="text-slate-400" />
        <select value={filterIngredient} onChange={e => setFilterIng(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">كل المواد</option>
          {ingredients.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">كل الأنواع</option>
          <option value="purchase">شراء</option>
          <option value="sale">بيع</option>
          <option value="waste">هالك</option>
          <option value="adjust">تعديل</option>
        </select>
        {(filterIngredient || filterType) && (
          <button onClick={() => { setFilterIng(''); setFilterType('') }}
            className="text-slate-400 hover:text-slate-700 text-sm">× مسح</button>
        )}
        <span className="text-slate-400 text-sm mr-auto">{filtered.length} نتيجة</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['التاريخ', 'المادة', 'النوع', 'الكمية', 'ملاحظة'].map(h => (
                <th key={h} className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(mov => {
              const cfg = TYPE_CONFIG[mov.type] ?? { label: mov.type, color: 'bg-slate-100 text-slate-600' }
              return (
                <tr key={mov.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {new Date(mov.createdAt).toLocaleDateString('ar-EG')}
                    <span className="text-slate-400 text-xs mr-1">
                      {new Date(mov.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{mov.ingredient?.name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-sm font-semibold">
                    <span className={mov.quantity >= 0 ? 'text-green-600' : 'text-red-500'}>
                      {mov.quantity > 0 ? '+' : ''}{mov.quantity} {mov.ingredient?.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-sm">
                    {mov.note ?? <span className="text-slate-300">—</span>}
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-sm">
                  لا توجد حركات مخزون
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Adjustment Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">تسجيل تعديل مخزون</h2>
              <button onClick={() => setShowForm(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"><X size={18} /></button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              <Field label="المادة الخام *">
                <select value={form.ingredientId}
                  onChange={e => setForm(f => ({ ...f, ingredientId: +e.target.value }))}
                  className={inputCls}>
                  {ingredients.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.name} — متبقي: {i.currentStock} {i.unit}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="نوع التعديل *">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'waste',  label: 'هالك / تلف',   desc: 'يخصم من المخزون', active: 'border-orange-400 bg-orange-50' },
                    { value: 'adjust', label: 'تعديل يدوي',   desc: '+إضافة / −خصم',   active: 'border-blue-400 bg-blue-50' },
                  ].map(opt => (
                    <button key={opt.value} type="button"
                      onClick={() => setForm(f => ({ ...f, type: opt.value }))}
                      className={`p-3 rounded-xl border-2 text-right transition-colors ${
                        form.type === opt.value ? opt.active : 'border-slate-200 hover:border-slate-300'}`}>
                      <p className="font-semibold text-sm text-slate-800">{opt.label}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label={form.type === 'waste' ? 'الكمية التالفة *' : 'الكمية (موجب = إضافة، سالب = خصم) *'}>
                <input type="number" step="0.001" required
                  value={form.quantity || ''}
                  onChange={e => setForm(f => ({ ...f, quantity: +e.target.value }))}
                  className={inputCls}
                  placeholder={form.type === 'waste' ? 'أدخل الكمية التالفة' : 'مثال: 5 أو −3'} />
              </Field>

              <Field label="ملاحظة">
                <input value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  className={inputCls} placeholder="سبب التعديل..." />
              </Field>

              {form.quantity !== 0 && (() => {
                const selectedIng = ing(form.ingredientId)
                const finalQty = form.type === 'waste' ? -Math.abs(form.quantity) : form.quantity
                const isDeduction = finalQty < 0
                return (
                  <div className={`rounded-xl p-3 text-sm ${isDeduction ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                    {isDeduction
                      ? `سيتم خصم ${Math.abs(finalQty)} ${selectedIng?.unit || ''} من المخزون`
                      : `سيتم إضافة ${finalQty} ${selectedIng?.unit || ''} للمخزون`}
                  </div>
                )
              })()}

              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving || form.quantity === 0}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'جاري الحفظ...' : 'تسجيل التعديل'}
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
    </div>
  )
}
