import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Plus, ChevronRight, Lock, FileText, Search,
  CheckCircle, AlertCircle, ArrowUpDown, Trash2, X,
} from 'lucide-react'
import type { InventoryCount, InventoryCountItem, Ingredient } from '../types'
import { DeleteConfirm } from '../components/ui'

type FilterTab = 'all' | 'draft' | 'closed'

// ─── Add Units Modal ────────────────────────────────────────
function AddUnitsModal({
  countId,
  allIngredients,
  alreadyAdded,
  onAdded,
  onClose,
}: {
  countId:        number
  allIngredients: Ingredient[]
  alreadyAdded:   Set<number>
  onAdded:        (updated: InventoryCount) => void
  onClose:        () => void
}) {
  const [search,   setSearch]   = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [saving,   setSaving]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const available = allIngredients.filter(i =>
    !alreadyAdded.has(i.id) &&
    (!search || i.name.includes(search) || (i.sku ?? '').toLowerCase().includes(search.toLowerCase()) ||
     (i.secondaryName ?? '').includes(search))
  )

  const toggle = (id: number) =>
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const handleAdd = async () => {
    if (selected.size === 0) return
    setSaving(true)
    try {
      const updated = await window.api.inventory.addItems({
        countId,
        ingredientIds: Array.from(selected),
      })
      onAdded(updated!)
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">إضافة وحدات</h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابدأ الكتابة للبحث..."
              className="w-full pr-9 pl-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {selected.size > 0 && (
            <p className="text-xs text-blue-600 mt-2 font-medium">تم اختيار {selected.size} مادة</p>
          )}
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {available.length === 0 && (
            <div className="px-5 py-10 text-center text-slate-400 text-sm">
              {allIngredients.filter(i => !alreadyAdded.has(i.id)).length === 0
                ? 'تم إضافة جميع المواد'
                : 'لا توجد نتائج'}
            </div>
          )}
          {available.map(ing => {
            const isSelected = selected.has(ing.id)
            return (
              <div
                key={ing.id}
                onClick={() => toggle(ing.id)}
                className={`flex items-center gap-3 px-5 py-3 cursor-pointer border-b border-slate-50 transition-colors ${
                  isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                }`}>
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 transition-colors ${
                  isSelected ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                }`}>
                  {isSelected && (
                    <svg viewBox="0 0 10 8" className="w-full h-full text-white p-0.5">
                      <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{ing.name}</p>
                  {ing.secondaryName && (
                    <p className="text-xs text-slate-400 truncate">{ing.secondaryName}</p>
                  )}
                </div>
                <div className="text-left flex-shrink-0">
                  {ing.sku && <p className="text-xs font-mono text-slate-400">{ing.sku}</p>}
                  <p className="text-xs text-slate-500">{ing.currentStock} {ing.unit}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={handleAdd}
            disabled={saving || selected.size === 0}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-semibold">
            {saving ? 'جاري الإضافة...' : `إضافة${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
          <button onClick={onClose}
            className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg text-sm font-medium">
            إغلاق
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── List View ─────────────────────────────────────────────
function CountList({
  counts, filter, onFilter, onCreate, onOpen, onDelete, creating,
}: {
  counts:   InventoryCount[]
  filter:   FilterTab
  onFilter: (f: FilterTab) => void
  onCreate: () => void
  onOpen:   (c: InventoryCount) => void
  onDelete: (id: number) => void
  creating: boolean
}) {
  const visible = counts.filter(c =>
    filter === 'all' ? true : c.status === filter
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">جرد المخزون</h1>
          <p className="text-slate-400 text-sm mt-0.5">{counts.length} جرد مسجل</p>
        </div>
        <button onClick={onCreate} disabled={creating}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-semibold shadow-sm disabled:opacity-60">
          <Plus size={16} /> {creating ? 'جاري الإنشاء...' : 'جرد مخزون جديد'}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm">
        {/* Tabs */}
        <div className="flex items-center border-b border-slate-100 px-4">
          {([
            { key: 'all',    label: 'الكل',   count: counts.length },
            { key: 'draft',  label: 'مسودة',  count: counts.filter(c => c.status === 'draft').length },
            { key: 'closed', label: 'مغلق',   count: counts.filter(c => c.status === 'closed').length },
          ] as { key: FilterTab; label: string; count: number }[]).map(tab => (
            <button key={tab.key} onClick={() => onFilter(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors mr-1 ${
                filter === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}>
              {tab.label}
              <span className={`mr-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                filter === tab.key ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['الرقم المرجعي', 'الحالة', 'عدد الأصناف', 'تاريخ العمل', 'تم الإنشاء', ''].map(h => (
                <th key={h} className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {visible.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-14 text-center">
                <FileText size={36} className="mx-auto mb-2 text-slate-200" />
                <p className="text-slate-400 text-sm">لا توجد جرود في هذه الحالة</p>
              </td></tr>
            )}
            {visible.map(count => (
              <tr key={count.id} onClick={() => onOpen(count)}
                className="hover:bg-blue-50/40 cursor-pointer transition-colors group">
                <td className="px-5 py-3.5">
                  <span className="font-mono text-sm font-semibold text-blue-600">{count.referenceNumber}</span>
                </td>
                <td className="px-5 py-3.5">
                  {count.status === 'draft'
                    ? <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> مسودة
                      </span>
                    : <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                        <CheckCircle size={11} /> مغلق
                      </span>
                  }
                </td>
                <td className="px-5 py-3.5 text-slate-600 text-sm">{count.items.length} صنف</td>
                <td className="px-5 py-3.5 text-slate-500 text-sm">
                  {count.workDate
                    ? new Date(count.workDate).toLocaleDateString('ar-EG')
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-5 py-3.5 text-slate-400 text-sm">
                  {new Date(count.createdAt).toLocaleDateString('ar-EG')}
                </td>
                <td className="px-5 py-3.5 text-left">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {count.status === 'draft' && (
                      <button onClick={e => { e.stopPropagation(); onDelete(count.id) }}
                        className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                    <ChevronRight size={16} className="text-slate-300" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Detail View ───────────────────────────────────────────
function CountDetail({
  count: initialCount,
  allIngredients,
  onBack,
  onRefresh,
}: {
  count:          InventoryCount
  allIngredients: Ingredient[]
  onBack:         () => void
  onRefresh:      (updated: InventoryCount) => void
}) {
  const [count, setCount]             = useState(initialCount)
  const [search, setSearch]           = useState('')
  const [closing, setClosing]         = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [pendingEdit, setPendingEdit]   = useState<Record<number, string>>({})
  const [removingId, setRemovingId]     = useState<number | null>(null)

  const isDraft = count.status === 'draft'

  const alreadyAdded = new Set(count.items.map(i => i.ingredientId))

  const items = count.items.filter(item =>
    !search || item.ingredient.name.includes(search) ||
    (item.ingredient.sku ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const changedCount = count.items.filter(i => i.actualQuantity !== i.systemQuantity).length
  const addedItems   = count.items.filter(i => i.actualQuantity > i.systemQuantity).length
  const lostItems    = count.items.filter(i => i.actualQuantity < i.systemQuantity).length
  const totalDiff    = count.items.reduce((s, i) => s + (i.actualQuantity - i.systemQuantity), 0)

  const handleActualChange = (item: InventoryCountItem, rawVal: string) =>
    setPendingEdit(p => ({ ...p, [item.id]: rawVal }))

  const handleActualBlur = useCallback(async (item: InventoryCountItem, rawVal: string) => {
    const val = parseFloat(rawVal)
    if (isNaN(val) || val < 0) {
      setPendingEdit(p => { const n = { ...p }; delete n[item.id]; return n })
      return
    }
    if (val === item.actualQuantity) {
      setPendingEdit(p => { const n = { ...p }; delete n[item.id]; return n })
      return
    }
    await window.api.inventory.updateItem({ id: item.id, actualQuantity: val })
    setCount(c => ({ ...c, items: c.items.map(i => i.id === item.id ? { ...i, actualQuantity: val } : i) }))
    setPendingEdit(p => { const n = { ...p }; delete n[item.id]; return n })
  }, [])

  const handleRemoveItem = async (itemId: number) => {
    setRemovingId(itemId)
    try {
      await window.api.inventory.removeItem(itemId)
      setCount(c => ({ ...c, items: c.items.filter(i => i.id !== itemId) }))
    } finally { setRemovingId(null) }
  }

  const handleAdded = (updated: InventoryCount) => {
    setCount(updated)
    onRefresh(updated)
  }

  const handleClose = async () => {
    setClosing(true)
    try {
      const updated = await window.api.inventory.close(count.id)
      setCount(updated)
      onRefresh(updated)
    } finally { setClosing(false); setConfirmClose(false) }
  }

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <button onClick={onBack}
        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm mb-4 transition-colors">
        <ChevronRight size={15} className="rotate-180" /> رجوع
      </button>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">جرد المخزون</h1>
          <p className="font-mono text-blue-600 text-sm mt-0.5">{count.referenceNumber}</p>
        </div>
        <div className="flex items-center gap-3">
          {isDraft && (
            <button onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-50 text-sm font-medium shadow-sm">
              <Plus size={15} /> إضافة وحدات
            </button>
          )}
          {count.status === 'closed'
            ? <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-100 text-green-700 text-sm font-medium">
                <CheckCircle size={14} /> مغلق
              </span>
            : <button onClick={() => setConfirmClose(true)} disabled={closing || count.items.length === 0}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-semibold disabled:opacity-50">
                <Lock size={15} /> إغلاق الجرد
              </button>
          }
        </div>
      </div>

      {/* Draft notice */}
      {isDraft && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-5 flex items-center gap-3 text-sm text-amber-700">
          <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
          <span>الجرد محفوظ كمسودة — أضف المواد وعدّل الكميات ثم أغلق الجرد لتطبيق الفروقات على المخزون.</span>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'عدد الأصناف',      value: count.items.length, color: 'text-slate-700', bg: 'bg-white' },
          { label: 'أصناف متغيرة',     value: changedCount,       color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'زيادة في المخزون', value: addedItems,         color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'نقص في المخزون',   value: lostItems,          color: 'text-red-500',   bg: 'bg-red-50' },
        ].map(card => (
          <div key={card.label} className={`${card.bg} rounded-xl shadow-sm p-4 border border-slate-100`}>
            <p className="text-xs text-slate-400 mb-1">{card.label}</p>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {count.items.length === 0 && isDraft && (
        <div className="bg-white rounded-xl shadow-sm px-6 py-16 text-center">
          <Plus size={36} className="mx-auto mb-3 text-slate-200" />
          <p className="text-slate-500 font-medium mb-1">لم تتم إضافة أي مواد بعد</p>
          <p className="text-slate-400 text-sm mb-5">اضغط "إضافة وحدات" لاختيار مواد المخزون التي تريد جردها</p>
          <button onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-semibold">
            <Plus size={16} /> إضافة وحدات
          </button>
        </div>
      )}

      {/* Table */}
      {count.items.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
            <Search size={15} className="text-slate-400 flex-shrink-0" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث عن مادة..." className="flex-1 text-sm outline-none placeholder:text-slate-300" />
            {search && <button onClick={() => setSearch('')} className="text-slate-300 hover:text-slate-500 text-xs">× مسح</button>}
            <span className="text-slate-300 text-xs">{items.length} مادة</span>
          </div>

          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500">المادة</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500">الوحدة</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500">كمية النظام</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500">
                  {isDraft ? 'الكمية الفعلية ✏️' : 'الكمية الفعلية'}
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500">
                  <span className="flex items-center gap-1"><ArrowUpDown size={11} /> الفرق</span>
                </th>
                {isDraft && <th className="w-10" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">لا توجد نتائج</td></tr>
              )}
              {items.map(item => {
                const diff      = item.actualQuantity - item.systemQuantity
                const editVal   = pendingEdit[item.id]
                const inputVal  = editVal !== undefined ? editVal : String(item.actualQuantity)
                const diffColor = diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-slate-300'

                return (
                  <tr key={item.id} className={`transition-colors ${diff !== 0 ? 'bg-amber-50/40' : 'hover:bg-slate-50/60'}`}>
                    <td className="px-5 py-3 font-medium text-slate-800 text-sm">
                      {item.ingredient.name}
                      {item.ingredient.sku && (
                        <span className="mr-2 text-xs font-mono text-slate-400">{item.ingredient.sku}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-sm">{item.ingredient.unit}</td>
                    <td className="px-5 py-3 font-mono text-sm text-slate-500">{item.systemQuantity}</td>
                    <td className="px-5 py-3">
                      {isDraft ? (
                        <input type="number" step="0.001" min="0" value={inputVal}
                          onChange={e => handleActualChange(item, e.target.value)}
                          onBlur={e => handleActualBlur(item, e.target.value)}
                          className="w-28 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                      ) : (
                        <span className="font-mono text-sm text-slate-700">{item.actualQuantity}</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`font-mono text-sm font-semibold ${diffColor}`}>
                        {diff === 0 ? '—' : `${diff > 0 ? '+' : ''}${diff.toFixed(3)}`}
                      </span>
                    </td>
                    {isDraft && (
                      <td className="px-2 py-3">
                        <button onClick={() => handleRemoveItem(item.id)}
                          disabled={removingId === item.id}
                          className="p-1.5 text-slate-200 hover:text-red-500 rounded transition-colors disabled:opacity-40">
                          <X size={14} />
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-sm">
            <span>
              {changedCount > 0
                ? <span className="flex items-center gap-1.5 text-amber-600">
                    <AlertCircle size={13} /> {changedCount} صنف به فرق
                  </span>
                : <span className="text-slate-400">لا توجد فروقات</span>
              }
            </span>
            <span className={`font-mono font-semibold ${totalDiff > 0 ? 'text-green-600' : totalDiff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
              الفرق الإجمالي: {totalDiff > 0 ? '+' : ''}{totalDiff.toFixed(3)}
            </span>
          </div>
        </div>
      )}

      {/* Add Units Modal */}
      {showAddModal && (
        <AddUnitsModal
          countId={count.id}
          allIngredients={allIngredients}
          alreadyAdded={alreadyAdded}
          onAdded={handleAdded}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {/* Close Confirm */}
      {confirmClose && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <Lock size={22} className="text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 text-center mb-2">إغلاق الجرد</h3>
            <p className="text-slate-500 text-sm text-center mb-1">سيتم تطبيق الفروقات على المخزون وقفل الجرد نهائياً.</p>
            {changedCount > 0
              ? <p className="text-amber-600 text-sm text-center mb-4">{changedCount} صنف سيتم تعديل رصيده</p>
              : <p className="text-slate-400 text-sm text-center mb-4">لا توجد فروقات — المخزون مطابق</p>
            }
            <div className="flex gap-3">
              <button onClick={handleClose} disabled={closing}
                className="flex-1 bg-green-600 text-white py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-semibold">
                {closing ? 'جاري الإغلاق...' : 'تأكيد الإغلاق'}
              </button>
              <button onClick={() => setConfirmClose(false)}
                className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg text-sm font-medium">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────
export default function InventoryCountPage() {
  const [counts,     setCounts]     = useState<InventoryCount[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [filter,     setFilter]     = useState<FilterTab>('all')
  const [selected,   setSelected]   = useState<InventoryCount | null>(null)
  const [creating,   setCreating]   = useState(false)
  const [deleteId,   setDeleteId]   = useState<number | null>(null)

  const load = () =>
    Promise.all([
      window.api.inventory.getAll(),
      window.api.ingredients.getAll(),
    ]).then(([c, i]) => { setCounts(c); setIngredients(i) })

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const count = await window.api.inventory.create()
      setCounts(prev => [count, ...prev])
      setSelected(count)
    } finally { setCreating(false) }
  }

  const handleDelete = async () => {
    if (deleteId == null) return
    await window.api.inventory.delete(deleteId)
    setDeleteId(null)
    load()
  }

  const handleRefresh = (updated: InventoryCount) => {
    setCounts(prev => prev.map(c => c.id === updated.id ? updated : c))
    if (selected?.id === updated.id) setSelected(updated)
  }

  if (selected) {
    return (
      <CountDetail
        count={selected}
        allIngredients={ingredients}
        onBack={() => { setSelected(null); load() }}
        onRefresh={handleRefresh}
      />
    )
  }

  return (
    <>
      <CountList
        counts={counts}
        filter={filter}
        onFilter={setFilter}
        onCreate={handleCreate}
        onOpen={setSelected}
        onDelete={setDeleteId}
        creating={creating}
      />
      {deleteId != null && (
        <DeleteConfirm
          message="سيتم حذف الجرد نهائياً. هل أنت متأكد؟"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </>
  )
}
