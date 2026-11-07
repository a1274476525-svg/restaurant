import { useState, useEffect } from 'react'
import { Trash2, Plus } from 'lucide-react'
import type { Ingredient, StockMovement } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'

function WasteForm({ ingredients, onSaved }: { ingredients: Ingredient[]; onSaved: () => void }) {
  const { user } = useAuth()
  const [ingredientId, setIngredientId] = useState('')
  const [qty, setQty]   = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const selected = ingredients.find(i => i.id === Number(ingredientId))

  async function save() {
    if (!ingredientId) return setError('اختر المادة')
    const q = parseFloat(qty)
    if (!q || q <= 0) return setError('الكمية يجب أن تكون أكبر من صفر')
    if (selected && q > selected.currentStock) return setError(`المخزون الحالي ${selected.currentStock} ${selected.unit} فقط`)
    setSaving(true)
    await window.api.stock_waste.create({ ingredientId: Number(ingredientId), quantity: q, note: note || undefined })
    if (user) {
      window.api.activity.log({
        userId: user.id,
        action: 'تسجيل هدر',
        entity: 'waste',
        details: `${selected?.name} — ${q} ${selected?.unit}${note ? ' — ' + note : ''}`,
      }).catch(() => {})
    }
    setSaving(false)
    setIngredientId('')
    setQty('')
    setNote('')
    setError('')
    onSaved()
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
      <h2 className="font-semibold text-slate-700 mb-5 text-lg flex items-center gap-2">
        <Plus size={18} /> تسجيل هدر
      </h2>

      {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">المادة الخام</label>
          <select value={ingredientId} onChange={e => { setIngredientId(e.target.value); setError('') }}
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">اختر مادة...</option>
            {ingredients.map(i => (
              <option key={i.id} value={i.id}>
                {i.name} — متبقي: {i.currentStock} {i.unit}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">
            الكمية المهدرة {selected ? `(${selected.unit})` : ''}
          </label>
          <input value={qty} onChange={e => { setQty(e.target.value); setError('') }}
            type="number" min="0.001" step="any" placeholder="0"
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">السبب (اختياري)</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="سبب الهدر..."
            className="w-full border border-slate-300 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className="mt-4 flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors font-medium">
        <Trash2 size={16} /> {saving ? 'جاري التسجيل...' : 'تسجيل الهدر'}
      </button>
    </div>
  )
}

export default function WasteTracking() {
  const { settings } = useSettings()
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [movements,   setMovements]   = useState<StockMovement[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const [ings, mvs] = await Promise.all([
      window.api.ingredients.getAll(),
      window.api.stock_waste.getAll(),
    ])
    setIngredients(ings)
    setMovements(mvs)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const totalWaste = movements.reduce((s, m) => s + Math.abs(m.quantity), 0)
  const totalCost  = movements.reduce((s, m) => s + Math.abs(m.quantity) * (m.ingredient?.costPerUnit ?? 0), 0)

  if (loading) return <div className="text-center text-slate-400 py-16">جاري التحميل...</div>

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
        <Trash2 size={22} className="text-red-500" /> سجل الهدر
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-red-50 rounded-xl p-4">
          <div className="text-xs text-red-400 mb-1">إجمالي سجلات الهدر</div>
          <div className="text-2xl font-bold text-red-700">{movements.length}</div>
        </div>
        <div className="bg-orange-50 rounded-xl p-4">
          <div className="text-xs text-orange-400 mb-1">أنواع المواد المتأثرة</div>
          <div className="text-2xl font-bold text-orange-700">
            {new Set(movements.map(m => m.ingredientId)).size}
          </div>
        </div>
        <div className="bg-amber-50 rounded-xl p-4">
          <div className="text-xs text-amber-400 mb-1">تكلفة الهدر الإجمالية</div>
          <div className="text-2xl font-bold text-amber-700">{totalCost.toFixed(2)} {settings.currency}</div>
        </div>
      </div>

      <WasteForm ingredients={ingredients} onSaved={load} />

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-700">سجل الهدر</h2>
          <span className="text-sm text-slate-500">{movements.length} سجل</span>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
            <tr>
              <th className="px-5 py-3 text-right font-semibold">المادة</th>
              <th className="px-5 py-3 text-right font-semibold">الكمية</th>
              <th className="px-5 py-3 text-right font-semibold">التكلفة</th>
              <th className="px-5 py-3 text-right font-semibold">السبب</th>
              <th className="px-5 py-3 text-right font-semibold">التاريخ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {movements.map(m => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="font-medium text-slate-800 text-sm">{m.ingredient?.name}</div>
                  {m.ingredient?.category && (
                    <div className="text-xs text-slate-400">{m.ingredient.category}</div>
                  )}
                </td>
                <td className="px-5 py-3 text-sm font-semibold text-red-600">
                  -{Math.abs(m.quantity).toFixed(3)} {m.ingredient?.unit}
                </td>
                <td className="px-5 py-3 text-sm text-slate-600">
                  {(Math.abs(m.quantity) * (m.ingredient?.costPerUnit ?? 0)).toFixed(2)} {settings.currency}
                </td>
                <td className="px-5 py-3 text-sm text-slate-500">{m.note ?? '—'}</td>
                <td className="px-5 py-3 text-xs text-slate-400">
                  {new Date(m.createdAt).toLocaleString('ar-EG')}
                </td>
              </tr>
            ))}
            {movements.length === 0 && (
              <tr><td colSpan={5} className="text-center text-slate-400 py-12">لا توجد سجلات هدر</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
