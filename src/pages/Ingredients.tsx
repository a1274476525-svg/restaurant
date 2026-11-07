import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import { Plus, Edit2, Archive, RotateCcw, Search, AlertTriangle, Download, X, Filter, TrendingUp } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import type { Ingredient, PriceHistory } from '../types'
import { Modal, Field, SaveCancelButtons, inputCls } from '../components/ui'

const UNITS = ['كجم','جرام','لتر','مل','قطعة','علبة','كيس','رغيف','صينية','طبق','وحدة']

const emptyForm = {
  name: '', secondaryName: '', sku: '', barcode: '', category: '',
  unit: 'كجم', storageUnit: '', conversionFactor: 1,
  costPerUnit: 0, currentStock: 0,
  minStockAlert: 0, reorderLevel: 0, maxStockAlert: 0,
}

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Ingredients() {
  const [items, setItems]             = useState<Ingredient[]>([])
  const [archived, setArchived]       = useState<Ingredient[]>([])
  const [categories, setCategories]   = useState<string[]>([])
  const [tab, setTab]                 = useState<'active' | 'archived'>('active')
  const [search, setSearch]           = useState('')
  const [catFilter, setCatFilter]     = useState('')
  const [showModal, setShowModal]     = useState(false)
  const [editItem, setEditItem]       = useState<Ingredient | null>(null)
  const [form, setForm]               = useState(emptyForm)
  const [saving, setSaving]           = useState(false)
  const [historyFor, setHistoryFor]   = useState<Ingredient | null>(null)
  const [history, setHistory]         = useState<PriceHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const loadAll = async () => {
    const [active, arch, cats] = await Promise.all([
      window.api.ingredients.getAll(false),
      window.api.ingredients.getAll(true).then(all => all.filter(i => i.isArchived)),
      window.api.ingredients.getCategories(),
    ])
    setItems(active)
    setArchived(arch)
    setCategories(cats)
  }

  useEffect(() => { loadAll() }, [])

  const openAdd = () => {
    setEditItem(null)
    setForm(emptyForm)
    setShowModal(true)
  }

  const openEdit = (item: Ingredient) => {
    setEditItem(item)
    setForm({
      name: item.name, secondaryName: item.secondaryName ?? '', sku: item.sku ?? '',
      barcode: item.barcode ?? '', category: item.category ?? '',
      unit: item.unit, storageUnit: item.storageUnit ?? '', conversionFactor: item.conversionFactor,
      costPerUnit: item.costPerUnit, currentStock: item.currentStock,
      minStockAlert: item.minStockAlert, reorderLevel: item.reorderLevel, maxStockAlert: item.maxStockAlert,
    })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = {
        ...form,
        sku:           form.sku || undefined,
        barcode:       form.barcode || null,
        secondaryName: form.secondaryName || null,
        category:      form.category || null,
        storageUnit:   form.storageUnit || null,
      }
      if (editItem) await window.api.ingredients.update({ id: editItem.id, ...payload })
      else          await window.api.ingredients.create(payload)
      setShowModal(false)
      await loadAll()
    } finally { setSaving(false) }
  }

  const handleArchive = async (id: number) => {
    await window.api.ingredients.archive(id)
    await loadAll()
  }

  const handleRestore = async (id: number) => {
    await window.api.ingredients.restore(id)
    await loadAll()
  }

  const openHistory = async (item: Ingredient) => {
    setHistoryFor(item)
    setLoadingHistory(true)
    const data = await window.api.ingredients.getPriceHistory(item.id)
    setHistory(data)
    setLoadingHistory(false)
  }

  // ── Excel export ───────────────────────────────────────────────
  const exportExcel = () => {
    const headers = ['SKU','الاسم','الفئة','وحدة المكون','وحدة التخزين','معامل التحويل',
      'سعر الوحدة','الرصيد','الحد الأدنى','نقطة الطلب','الحد الأقصى']
    const rows = items.map(i => [
      i.sku, i.name, i.category, i.unit, i.storageUnit, i.conversionFactor,
      i.costPerUnit, i.currentStock, i.minStockAlert, i.reorderLevel, i.maxStockAlert,
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [8,20,12,10,10,10,10,10,10,10,10].map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'المواد')
    XLSX.writeFile(wb, `ingredients_${todayStr()}.xlsx`)
  }

  // ── display list ───────────────────────────────────────────────
  const displayList = (tab === 'active' ? items : archived).filter(i => {
    if (search && !i.name.includes(search) && !(i.sku ?? '').includes(search)) return false
    if (catFilter && i.category !== catFilter) return false
    return true
  })

  const stockStatus = (i: Ingredient) => {
    if (i.currentStock <= i.minStockAlert)  return { label: 'منخفض جداً', cls: 'bg-red-100 text-red-600' }
    if (i.reorderLevel > 0 && i.currentStock <= i.reorderLevel) return { label: 'أعد الطلب', cls: 'bg-amber-100 text-amber-600' }
    return { label: 'جيد', cls: 'bg-green-100 text-green-600' }
  }

  const hasStorageUnit = (i: Ingredient) => i.storageUnit && i.storageUnit !== i.unit

  return (
    <div className="p-6">
      {/* header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">مواد المخزون</h1>
          <p className="text-slate-400 text-sm mt-0.5">{items.length} مادة نشطة</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel}
            className="flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium">
            <Download size={15} /> تصدير Excel
          </button>
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus size={16} /> إضافة مادة
          </button>
        </div>
      </div>

      {/* filters row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* tabs */}
        <div className="flex bg-slate-100 rounded-lg p-1">
          {([['active','النشطة'],['archived','المؤرشفة']] as const).map(([key,label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}>
              {label}
              {key === 'archived' && archived.length > 0 && (
                <span className="mr-1.5 bg-slate-300 text-slate-600 text-xs px-1.5 rounded-full">{archived.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* search */}
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو SKU..."
            className="w-full pr-9 pl-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* category filter */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-slate-400" />
            <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
              className="border border-slate-200 rounded-lg px-2 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">كل الفئات</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        {(search || catFilter) && (
          <button onClick={() => { setSearch(''); setCatFilter('') }}
            className="text-slate-400 hover:text-slate-600 text-sm">× مسح</button>
        )}
      </div>

      {/* table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['SKU','الاسم','الفئة','وحدة التخزين/المكون','الرصيد','المستويات','سعر الوحدة','الحالة',''].map(h => (
                <th key={h} className="text-right px-3 py-3 text-xs font-semibold text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {displayList.map(item => {
              const status = stockStatus(item)
              return (
                <tr key={item.id} className={`hover:bg-slate-50 ${item.isArchived ? 'opacity-60' : ''}`}>
                  <td className="px-3 py-3 font-mono text-xs text-slate-400">{item.sku ?? '—'}</td>
                  <td className="px-3 py-3 font-medium text-slate-800">{item.name}</td>
                  <td className="px-3 py-3 text-sm text-slate-500">
                    {item.category
                      ? <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{item.category}</span>
                      : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-3 py-3 text-sm text-slate-600">
                    {hasStorageUnit(item)
                      ? <span>{item.storageUnit} → {item.unit} <span className="text-slate-400 text-xs">(×{item.conversionFactor})</span></span>
                      : item.unit}
                  </td>
                  <td className="px-3 py-3 font-mono text-sm font-semibold text-slate-700">
                    {item.currentStock} <span className="text-slate-400 font-normal text-xs">{item.unit}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-500">
                    <div>↓ {item.minStockAlert}</div>
                    {item.reorderLevel > 0 && <div className="text-amber-500">↺ {item.reorderLevel}</div>}
                    {item.maxStockAlert > 0 && <div>↑ {item.maxStockAlert}</div>}
                  </td>
                  <td className="px-3 py-3 font-mono text-sm text-slate-600">{item.costPerUnit.toFixed(2)} ج/{item.unit}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openHistory(item)}
                        title="تاريخ الأسعار"
                        className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors">
                        <TrendingUp size={13} />
                      </button>
                      {!item.isArchived ? (
                        <>
                          <button onClick={() => openEdit(item)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                            <Edit2 size={13} />
                          </button>
                          <button onClick={() => handleArchive(item.id)}
                            title="أرشفة"
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors">
                            <Archive size={13} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => handleRestore(item.id)}
                          title="استعادة"
                          className="p-1.5 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors">
                          <RotateCcw size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {displayList.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">
                  {tab === 'archived' ? 'لا توجد مواد مؤرشفة' : search || catFilter ? 'لا توجد نتائج' : 'ابدأ بإضافة أول مادة'}
                </td>
              </tr>
            )}
          </tbody>
          {tab === 'active' && items.length > 0 && (
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={6} className="px-3 py-2.5 text-xs font-semibold text-slate-500">إجمالي قيمة المخزون</td>
                <td colSpan={3} className="px-3 py-2.5 font-mono font-bold text-slate-800">
                  {items.reduce((s, i) => s + i.currentStock * i.costPerUnit, 0).toFixed(2)} ج
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* price history modal */}
      {historyFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={e => e.target === e.currentTarget && setHistoryFor(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                  <TrendingUp size={18} className="text-purple-500" />
                  تاريخ أسعار: {historyFor.name}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">السعر الحالي: {historyFor.costPerUnit.toFixed(2)} ج/{historyFor.unit}</p>
              </div>
              <button onClick={() => setHistoryFor(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingHistory ? (
                <div className="text-center text-slate-400 py-12">جاري التحميل...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-12">
                  <TrendingUp size={40} className="mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-400 text-sm">لا يوجد سجل أسعار حتى الآن</p>
                  <p className="text-slate-300 text-xs mt-1">يُسجَّل السعر تلقائياً عند تأكيد فواتير الشراء</p>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={history.map(h => ({
                        date: new Date(h.date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }),
                        price: h.price,
                      }))}>
                        <XAxis dataKey="date" tick={{ fontSize: 11, fontFamily: 'Cairo' }} />
                        <YAxis tick={{ fontSize: 11 }} width={55}
                          tickFormatter={v => `${v.toFixed(2)}`} />
                        <Tooltip
                          formatter={(v: number) => [`${v.toFixed(2)} ج`, 'السعر']}
                          contentStyle={{ fontFamily: 'Cairo', fontSize: 12, direction: 'rtl' }} />
                        <ReferenceLine y={historyFor.costPerUnit} stroke="#6366f1" strokeDasharray="4 2"
                          label={{ value: 'الحالي', position: 'right', fontSize: 10, fill: '#6366f1', fontFamily: 'Cairo' }} />
                        <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={2}
                          dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="border border-slate-100 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-xs text-slate-500">
                        <tr>
                          <th className="text-right px-4 py-2.5 font-semibold">التاريخ</th>
                          <th className="text-right px-4 py-2.5 font-semibold">السعر</th>
                          <th className="text-right px-4 py-2.5 font-semibold">التغير</th>
                          <th className="text-right px-4 py-2.5 font-semibold">الملاحظة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {[...history].reverse().map((h, idx, arr) => {
                          const prev = arr[idx + 1]
                          const diff = prev ? h.price - prev.price : null
                          return (
                            <tr key={h.id} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 text-slate-600">
                                {new Date(h.date).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}
                              </td>
                              <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">
                                {h.price.toFixed(2)} ج
                              </td>
                              <td className="px-4 py-2.5 font-mono text-xs">
                                {diff === null ? <span className="text-slate-300">—</span>
                                  : diff > 0 ? <span className="text-red-500">▲ +{diff.toFixed(2)}</span>
                                  : diff < 0 ? <span className="text-green-600">▼ {diff.toFixed(2)}</span>
                                  : <span className="text-slate-400">= بدون تغيير</span>}
                              </td>
                              <td className="px-4 py-2.5 text-slate-400 text-xs truncate max-w-xs">{h.note ?? '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* form modal */}
      {showModal && (
        <Modal title={editItem ? 'تعديل المادة' : 'إضافة مادة خام'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* basic */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="الاسم *">
                <input required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls} placeholder="مثال: فراخ، زيت، دقيق" />
              </Field>
              <Field label="الاسم الثانوي">
                <input value={form.secondaryName}
                  onChange={e => setForm(f => ({ ...f, secondaryName: e.target.value }))}
                  className={inputCls} placeholder="الاسم بلغة أخرى" />
              </Field>
              <Field label="الفئة">
                <input value={form.category} list="cats"
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className={inputCls} placeholder="مثال: لحوم، خضار، مشروبات" />
                <datalist id="cats">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </Field>
              <Field label="باركود">
                <input value={form.barcode}
                  onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
                  className={inputCls} placeholder="امسح أو أدخل الباركود" />
              </Field>
            </div>

            {/* units section */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">الوحدات</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="وحدة المكون * (للوصفات والمخزون)">
                  <input value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                    list="units-list" required className={inputCls} placeholder="جرام، مل، قطعة" />
                  <datalist id="units-list">{UNITS.map(u => <option key={u} value={u} />)}</datalist>
                </Field>
                <Field label="وحدة التخزين (في فواتير الشراء)">
                  <input value={form.storageUnit}
                    onChange={e => setForm(f => ({ ...f, storageUnit: e.target.value }))}
                    list="units-list" className={inputCls} placeholder="كجم، كرتونة، جالون" />
                </Field>
              </div>
              {form.storageUnit && form.storageUnit !== form.unit && (
                <Field label={`معامل التحويل: 1 ${form.storageUnit} = كم ${form.unit}؟`}>
                  <input type="number" min="0.001" step="0.001" value={form.conversionFactor}
                    onChange={e => setForm(f => ({ ...f, conversionFactor: +e.target.value }))}
                    className={inputCls} />
                  <p className="text-xs text-slate-400 mt-1">
                    مثال: 1 كجم = 1000 جرام → اكتب 1000
                  </p>
                </Field>
              )}
            </div>

            {/* stock levels */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">مستويات المخزون ({form.unit})</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="الحد الأدنى ↓">
                  <input type="number" step="0.001" min="0" value={form.minStockAlert}
                    onChange={e => setForm(f => ({ ...f, minStockAlert: +e.target.value }))}
                    className={inputCls} />
                </Field>
                <Field label="نقطة إعادة الطلب ↺">
                  <input type="number" step="0.001" min="0" value={form.reorderLevel}
                    onChange={e => setForm(f => ({ ...f, reorderLevel: +e.target.value }))}
                    className={inputCls} />
                </Field>
                <Field label="الحد الأقصى ↑">
                  <input type="number" step="0.001" min="0" value={form.maxStockAlert}
                    onChange={e => setForm(f => ({ ...f, maxStockAlert: +e.target.value }))}
                    className={inputCls} />
                </Field>
              </div>
            </div>

            {/* cost + current stock */}
            <div className="grid grid-cols-2 gap-3">
              <Field label={`سعر الوحدة (ج/${form.unit || 'وحدة'})`}>
                <input type="number" step="0.01" min="0" value={form.costPerUnit}
                  onChange={e => setForm(f => ({ ...f, costPerUnit: +e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label={`الرصيد الحالي (${form.unit || 'وحدة'})`}>
                <input type="number" step="0.001" min="0" value={form.currentStock}
                  onChange={e => setForm(f => ({ ...f, currentStock: +e.target.value }))}
                  className={inputCls} />
              </Field>
            </div>

            <SaveCancelButtons saving={saving} onCancel={() => setShowModal(false)} />
          </form>
        </Modal>
      )}
    </div>
  )
}
