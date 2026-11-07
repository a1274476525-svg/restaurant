import { useEffect, useState } from 'react'
import { Plus, Trash2, ChefHat, Calculator, Save } from 'lucide-react'
import type { Product, Ingredient } from '../types'

export default function Recipes() {
  const [products, setProducts] = useState<Product[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [selected, setSelected] = useState<Product | null>(null)
  const [rows, setRows] = useState<{ ingredientId: number; quantity: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      window.api.products.getAll(),
      window.api.ingredients.getAll(),
    ]).then(([p, i]) => { setProducts(p); setIngredients(i) })
  }, [])

  const selectProduct = (product: Product) => {
    setSelected(product)
    setSaved(false)
    setRows(
      (product.recipes || []).map(r => ({ ingredientId: r.ingredientId, quantity: r.quantity }))
    )
  }

  const addRow = () => {
    const usedIds = rows.map(r => r.ingredientId)
    const available = ingredients.find(i => !usedIds.includes(i.id))
    if (!available) return
    setRows(prev => [...prev, { ingredientId: available.id, quantity: 0 }])
    setSaved(false)
  }

  const updateRow = (index: number, field: 'ingredientId' | 'quantity', value: number) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
    setSaved(false)
  }

  const removeRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index))
    setSaved(false)
  }

  const getIng = (id: number) => ingredients.find(i => i.id === id)

  const totalCost = rows.reduce((sum, r) => {
    const ing = getIng(r.ingredientId)
    return sum + (ing ? ing.costPerUnit * r.quantity : 0)
  }, 0)

  const profit = selected ? selected.price - totalCost : 0
  const margin = selected?.price ? (profit / selected.price) * 100 : 0

  const handleSave = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await window.api.recipes.setForProduct({
        productId: selected.id,
        items: rows.filter(r => r.quantity > 0),
      })
      const updated = await window.api.products.getAll()
      setProducts(updated)
      const updatedProduct = updated.find(p => p.id === selected.id)
      if (updatedProduct) {
        setSelected(updatedProduct)
        setRows((updatedProduct.recipes || []).map(r => ({ ingredientId: r.ingredientId, quantity: r.quantity })))
      }
      setSaved(true)
    } finally { setSaving(false) }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">الوصفات</h1>

      <div className="flex gap-5" style={{ height: 'calc(100vh - 9rem)' }}>
        {/* Products List */}
        <div className="w-56 bg-white rounded-xl shadow-sm overflow-y-auto flex-shrink-0">
          <div className="px-4 py-3 border-b border-slate-100 sticky top-0 bg-white">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">اختر وجبة</p>
          </div>
          {products.length === 0 ? (
            <p className="p-4 text-slate-400 text-sm text-center mt-4">لا توجد وجبات</p>
          ) : (
            products.map(product => (
              <button
                key={product.id}
                onClick={() => selectProduct(product)}
                className={`w-full text-right px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors ${
                  selected?.id === product.id ? 'bg-blue-50 border-r-2 border-r-blue-500' : ''
                }`}
              >
                <p className="text-sm font-medium text-slate-800 truncate">{product.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {product.recipes?.length || 0} مكون
                </p>
              </button>
            ))
          )}
        </div>

        {/* Recipe Editor */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selected ? (
            <div className="flex-1 bg-white rounded-xl shadow-sm flex items-center justify-center">
              <div className="text-center">
                <ChefHat size={52} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 text-sm">اختر وجبة من القائمة لتعديل وصفتها</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm overflow-hidden">
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-800 text-lg">{selected.name}</h2>
                  <p className="text-slate-400 text-sm">سعر البيع: {selected.price.toFixed(2)} ج</p>
                </div>
                <div className="flex items-center gap-2">
                  {saved && (
                    <span className="text-green-600 text-sm font-medium">تم الحفظ ✓</span>
                  )}
                  <button
                    onClick={addRow}
                    disabled={ingredients.length === 0 || rows.length === ingredients.length}
                    className="flex items-center gap-1.5 text-sm bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40"
                  >
                    <Plus size={14} /> إضافة مكون
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 text-sm bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Save size={14} />
                    {saving ? 'جاري الحفظ...' : 'حفظ الوصفة'}
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="flex-1 overflow-y-auto">
                {rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 gap-2">
                    <p className="text-slate-400 text-sm">لا توجد مكونات لهذه الوجبة</p>
                    <button onClick={addRow}
                      className="flex items-center gap-1 text-blue-600 text-sm hover:underline">
                      <Plus size={14} /> إضافة أول مكون
                    </button>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-100 sticky top-0">
                      <tr>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">المكون</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 w-32">الكمية</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 w-20">الوحدة</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 w-28">سعر/وحدة</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 w-28">التكلفة</th>
                        <th className="w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {rows.map((row, index) => {
                        const ing = getIng(row.ingredientId)
                        const rowCost = ing ? ing.costPerUnit * row.quantity : 0
                        return (
                          <tr key={index} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5">
                              <select
                                value={row.ingredientId}
                                onChange={e => updateRow(index, 'ingredientId', +e.target.value)}
                                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full bg-white"
                              >
                                {ingredients.map(i => (
                                  <option key={i.id} value={i.id}>{i.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2.5">
                              <input
                                type="number" step="0.001" min="0"
                                value={row.quantity}
                                onChange={e => updateRow(index, 'quantity', +e.target.value)}
                                className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full font-mono bg-white"
                              />
                            </td>
                            <td className="px-4 py-2.5 text-slate-500 text-sm">{ing?.unit || '—'}</td>
                            <td className="px-4 py-2.5 text-slate-500 text-sm font-mono">
                              {ing ? `${ing.costPerUnit.toFixed(2)} ج` : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-slate-800 text-sm font-mono font-semibold">
                              {rowCost.toFixed(3)} ج
                            </td>
                            <td className="px-4 py-2.5">
                              <button onClick={() => removeRow(index)}
                                className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors">
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Cost Summary Footer */}
              <div className="border-t border-slate-100 px-5 py-4 bg-slate-50">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator size={15} className="text-slate-500" />
                  <span className="text-sm font-semibold text-slate-600">ملخص التكلفة</span>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  <CostBox label="عدد المكونات" value={`${rows.length} مكون`} color="text-slate-700" />
                  <CostBox label="تكلفة الوجبة" value={`${totalCost.toFixed(2)} ج`} color="text-slate-800" />
                  <CostBox
                    label="الربح"
                    value={`${profit.toFixed(2)} ج`}
                    color={profit >= 0 ? 'text-green-600' : 'text-red-500'}
                  />
                  <CostBox
                    label="هامش الربح"
                    value={`${margin.toFixed(1)}%`}
                    color={margin >= 30 ? 'text-green-600' : margin >= 15 ? 'text-amber-500' : 'text-red-500'}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CostBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-lg p-3 text-center shadow-sm">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-base font-bold ${color}`}>{value}</p>
    </div>
  )
}
