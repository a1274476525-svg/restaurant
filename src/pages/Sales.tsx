import { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import {
  Plus, X, Download, Upload, CheckCircle, Trash2, Edit2,
  TrendingUp, Calendar, ShoppingCart, FileSpreadsheet, AlertCircle,
} from 'lucide-react'
import type { Sale, Product, Customer } from '../types'
import { inputCls } from '../components/ui'

const pad2 = (n: number) => String(n).padStart(2, '0')
const localDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
const todayStr = () => localDateStr(new Date())
const toISODate = (v: unknown): string => {
  if (!v) return ''
  const d = v instanceof Date ? v : new Date(v as string)
  return localDateStr(d)
}

interface SaleRow { productId: number; quantity: number; unitPrice: number }

interface ImportRow {
  product_id: number
  name: string
  quantity: number
  unitPrice: number
  saleDate: string
  note: string
  valid: boolean
  error: string
}

export default function Sales() {
  const [tab, setTab] = useState<'history' | 'manual' | 'import'>('history')
  const [sales, setSales] = useState<Sale[]>([])
  const [drafts, setDrafts] = useState<Sale[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [saving, setSaving] = useState(false)
  const [filterSource, setFilterSource] = useState<string>('all')
  const [filterFrom, setFilterFrom] = useState<string>('')
  const [filterTo,   setFilterTo]   = useState<string>('')
  const [searchName, setSearchName] = useState<string>('')

  // manual entry
  const [entryDate, setEntryDate] = useState(todayStr())
  const [entryCustomerId, setEntryCustomerId] = useState<string>('')
  const [rows, setRows] = useState<SaleRow[]>([])
  const [editingDraft, setEditingDraft] = useState<Sale | null>(null)

  // excel import
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importFileName, setImportFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadAll = async () => {
    const [s, d, p, c] = await Promise.all([
      window.api.sales.getAll(),
      window.api.sales.getDrafts(),
      window.api.products.getAll(),
      window.api.customers.getAll(),
    ])
    setSales(s)
    setDrafts(d)
    setCustomers(c)
    const active = p.filter(x => x.isActive)
    setProducts(active)
    if (rows.length === 0 && active.length > 0) {
      setRows([{ productId: active[0].id, quantity: 1, unitPrice: active[0].price }])
    }
  }

  useEffect(() => { loadAll() }, [])

  // ── stats ──────────────────────────────────────────────────────────────
  const todaySales  = sales.filter(s => toISODate(s.saleDate) === todayStr())
  const todayTotal  = todaySales.reduce((sum, s) => sum + s.total, 0)
  const now = new Date()
  const monthPrefix = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`
  const monthTotal  = sales.filter(s => toISODate(s.saleDate).startsWith(monthPrefix))
                           .reduce((sum, s) => sum + s.total, 0)
  const grandTotal  = sales.reduce((sum, s) => sum + s.total, 0)

  // ── filtered sales ─────────────────────────────────────────────────────
  const filteredSales = sales.filter(s => {
    if (filterSource !== 'all' && s.source !== filterSource) return false
    if (filterFrom && toISODate(s.saleDate) < filterFrom) return false
    if (filterTo   && toISODate(s.saleDate) > filterTo)   return false
    if (searchName && !s.product?.name.includes(searchName)) return false
    return true
  })

  // ── manual entry helpers ───────────────────────────────────────────────
  const addRow = () => {
    const p = products[0]
    setRows(r => [...r, { productId: p?.id ?? 0, quantity: 1, unitPrice: p?.price ?? 0 }])
  }

  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i))

  const updateRow = (i: number, field: keyof SaleRow, value: number) =>
    setRows(r => {
      const next = [...r]
      if (field === 'productId') {
        const p = products.find(p => p.id === value)
        next[i] = { ...next[i], productId: value, unitPrice: p?.price ?? next[i].unitPrice }
      } else {
        next[i] = { ...next[i], [field]: value }
      }
      return next
    })

  const validRows = rows.filter(r => r.productId > 0 && r.quantity > 0)
  const rowsTotal = rows.reduce((s, r) => s + r.quantity * r.unitPrice, 0)

  const buildPayload = (status: 'draft' | 'confirmed', source = 'manual') =>
    validRows.map(r => ({
      productId: r.productId,
      customerId: entryCustomerId ? parseInt(entryCustomerId) : null,
      quantity:  r.quantity,
      unitPrice: r.unitPrice,
      total:     r.quantity * r.unitPrice,
      saleDate:  entryDate,
      source,
      status,
    }))

  const resetRows = () => {
    const p = products[0]
    setRows(p ? [{ productId: p.id, quantity: 1, unitPrice: p.price }] : [])
  }

  const handleSaveDraft = async () => {
    if (!validRows.length) return
    setSaving(true)
    try { await window.api.sales.saveDraft(buildPayload('draft')); resetRows(); await loadAll() }
    finally { setSaving(false) }
  }

  const handleConfirmDirect = async () => {
    if (!validRows.length) return
    setSaving(true)
    try { await window.api.sales.create(buildPayload('confirmed')); resetRows(); await loadAll() }
    finally { setSaving(false) }
  }

  const handleConfirmDraft = async (id: number) => {
    await window.api.sales.confirmDrafts([id])
    await loadAll()
  }

  const handleConfirmAllDrafts = async () => {
    if (!drafts.length) return
    await window.api.sales.confirmDrafts(drafts.map(d => d.id))
    await loadAll()
  }

  const handleDeleteDraft = async (id: number) => {
    await window.api.sales.deleteDraft(id)
    await loadAll()
  }

  const saveEditingDraft = async () => {
    if (!editingDraft) return
    await window.api.sales.updateDraft({
      id:         editingDraft.id,
      customerId: editingDraft.customerId,
      quantity:   editingDraft.quantity,
      unitPrice:  editingDraft.unitPrice,
      total:      editingDraft.quantity * editingDraft.unitPrice,
      saleDate:   toISODate(editingDraft.saleDate),
    })
    setEditingDraft(null)
    await loadAll()
  }

  // ── excel helpers ──────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const headers = ['product_id', 'اسم الوجبة', 'السعر الافتراضي', 'الكمية', 'السعر الفعلي', 'التاريخ', 'ملاحظة']
    const dataRows = products.map(p => [p.id, p.name, p.price, '', p.price, todayStr(), ''])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows])
    ws['!cols'] = [{ wch: 10 }, { wch: 28 }, { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 13 }, { wch: 22 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'المبيعات')
    XLSX.writeFile(wb, `sales_template_${todayStr()}.xlsx`)
  }

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFileName(file.name)
    const buf  = await file.arrayBuffer()
    const wb   = XLSX.read(buf, { cellDates: true })
    const ws   = wb.Sheets[wb.SheetNames[0]]
    const raw  = XLSX.utils.sheet_to_json(ws) as any[]

    const parsed: ImportRow[] = raw.map(row => {
      const productId = Number(row['product_id'])
      const qty       = Number(row['الكمية'] ?? 0)
      const price     = Number(row['السعر الفعلي'] ?? row['السعر الافتراضي'] ?? 0)
      const product   = products.find(p => p.id === productId)
      let error = ''
      if (!product)   error = 'الوجبة غير موجودة'
      else if (qty <= 0) error = 'الكمية يجب أن تكون أكبر من صفر'

      // Parse date: cellDates:true gives JS Date for date cells
      let saleDate = todayStr()
      const rawDate = row['التاريخ']
      if (rawDate instanceof Date) {
        saleDate = rawDate.toISOString().split('T')[0]
      } else if (rawDate) {
        saleDate = String(rawDate).slice(0, 10)
      }

      return {
        product_id: productId,
        name:       product?.name ?? String(row['اسم الوجبة'] ?? ''),
        quantity:   qty,
        unitPrice:  price || product?.price || 0,
        saleDate,
        note:       String(row['ملاحظة'] ?? ''),
        valid:      !error && qty > 0,
        error,
      }
    })
    setImportRows(parsed)
  }

  const handleImport = async () => {
    const valid = importRows.filter(r => r.valid)
    if (!valid.length) return
    setImporting(true)
    try {
      await window.api.sales.importConfirm(valid.map(r => ({
        productId: r.product_id,
        quantity:  r.quantity,
        unitPrice: r.unitPrice,
        total:     r.quantity * r.unitPrice,
        saleDate:  r.saleDate,
        note:      r.note || null,
      })))
      setImportRows([])
      setImportFileName('')
      if (fileRef.current) fileRef.current.value = ''
      await loadAll()
      setTab('history')
    } finally { setImporting(false) }
  }

  const clearImport = () => {
    setImportRows([])
    setImportFileName('')
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div className="p-6">
      {/* header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">المبيعات</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          {sales.length} مبيعة مؤكدة
          {drafts.length > 0 && <span className="text-amber-500"> — {drafts.length} مسودة في الانتظار</span>}
        </p>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center">
            <TrendingUp size={20} className="text-green-600" />
          </div>
          <div>
            <p className="text-xs text-slate-400">مبيعات اليوم</p>
            <p className="text-xl font-bold text-slate-800">{todayTotal.toFixed(2)} ج</p>
            <p className="text-xs text-slate-400">{todaySales.length} عملية</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 bg-blue-100 rounded-xl flex items-center justify-center">
            <Calendar size={20} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-slate-400">مبيعات الشهر</p>
            <p className="text-xl font-bold text-slate-800">{monthTotal.toFixed(2)} ج</p>
          </div>
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 bg-purple-100 rounded-xl flex items-center justify-center">
            <ShoppingCart size={20} className="text-purple-600" />
          </div>
          <div>
            <p className="text-xs text-slate-400">إجمالي الكل</p>
            <p className="text-xl font-bold text-slate-800">{grandTotal.toFixed(2)} ج</p>
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5 w-fit">
        {([
          ['history', 'سجل المبيعات'],
          ['manual',  'إدخال يدوي'],
          ['import',  'استيراد Excel'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors relative ${
              tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {label}
            {key === 'manual' && drafts.length > 0 && (
              <span className="mr-1.5 bg-amber-400 text-white text-xs px-1.5 py-0.5 rounded-full">
                {drafts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TAB: history ─────────────────────────────────────────────── */}
      {tab === 'history' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="bg-white rounded-xl shadow-sm p-3 flex flex-wrap items-center gap-3">
            <input
              value={searchName} onChange={e => setSearchName(e.target.value)}
              placeholder="بحث بالوجبة..."
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500 w-40"
            />
            <select value={filterSource} onChange={e => setFilterSource(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">كل المصادر</option>
              <option value="pos">POS فقط</option>
              <option value="manual">يدوي فقط</option>
              <option value="excel">إكسيل فقط</option>
            </select>
            <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-slate-400 text-sm">—</span>
            <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            {(filterSource !== 'all' || filterFrom || filterTo || searchName) && (
              <button onClick={() => { setFilterSource('all'); setFilterFrom(''); setFilterTo(''); setSearchName('') }}
                className="text-xs text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1">
                <X size={12} /> مسح الفلاتر
              </button>
            )}
            <span className="mr-auto text-xs text-slate-400">{filteredSales.length} نتيجة</span>
          </div>

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['الوجبة','الكمية','سعر الوحدة','الإجمالي','التاريخ','العميل','المصدر'].map(h => (
                    <th key={h} className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredSales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-800">{s.product?.name}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">× {s.quantity}</td>
                    <td className="px-4 py-3 font-mono text-sm text-slate-600">{s.unitPrice.toFixed(2)} ج</td>
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800">{s.total.toFixed(2)} ج</td>
                    <td className="px-4 py-3 text-slate-500 text-sm">
                      {new Date(s.saleDate).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-sm">{s.customer?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.source === 'excel' ? 'bg-green-50 text-green-700' :
                        s.source === 'pos'   ? 'bg-blue-50 text-blue-700' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {s.source === 'excel' ? 'إكسيل' : s.source === 'pos' ? 'POS' : 'يدوي'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">
                      {sales.length === 0 ? 'لا توجد مبيعات مؤكدة بعد' : 'لا توجد نتائج مطابقة للفلتر'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB: manual entry ─────────────────────────────────────────── */}
      {tab === 'manual' && (
        <div className="space-y-5">
          {/* entry form */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800">إدخال مبيعات جديدة</h2>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-500">العميل:</label>
                <select value={entryCustomerId}
                  onChange={e => setEntryCustomerId(e.target.value)}
                  className={`${inputCls} w-auto`}>
                  <option value="">بدون عميل</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <label className="text-sm text-slate-500">تاريخ البيع:</label>
                <input type="date" value={entryDate}
                  onChange={e => setEntryDate(e.target.value)}
                  className={`${inputCls} w-auto`} />
              </div>
            </div>

            {/* rows table */}
            <div className="border border-slate-100 rounded-xl overflow-hidden mb-4">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 w-2/5">الوجبة</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 w-24">الكمية</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 w-28">السعر (ج)</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 w-28">الإجمالي</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row, i) => {
                    const lineTotal = row.quantity * row.unitPrice
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2">
                          <select value={row.productId}
                            onChange={e => updateRow(i, 'productId', +e.target.value)}
                            className={inputCls}>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0.5" step="0.5" value={row.quantity}
                            onChange={e => updateRow(i, 'quantity', +e.target.value)}
                            className={inputCls} />
                        </td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.01" value={row.unitPrice}
                            onChange={e => updateRow(i, 'unitPrice', +e.target.value)}
                            className={inputCls} />
                        </td>
                        <td className="px-3 py-2 font-mono text-sm font-semibold text-slate-700">
                          {lineTotal.toFixed(2)} ج
                        </td>
                        <td className="px-3 py-2">
                          {rows.length > 1 && (
                            <button onClick={() => removeRow(i)}
                              className="p-1 text-slate-300 hover:text-red-500 rounded">
                              <X size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between">
              <button onClick={addRow}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
                <Plus size={15} /> إضافة وجبة
              </button>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-500">
                  الإجمالي: <span className="font-bold text-slate-800 font-mono">{rowsTotal.toFixed(2)} ج</span>
                </span>
              </div>
            </div>

            {products.length === 0 && (
              <p className="text-amber-600 text-sm mt-3 bg-amber-50 rounded-lg p-3">
                لازم تضيف وجبات نشطة أولاً
              </p>
            )}

            {/* action buttons */}
            <div className="flex gap-3 mt-5 pt-4 border-t border-slate-100">
              <button onClick={handleConfirmDirect}
                disabled={saving || !validRows.length}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                <CheckCircle size={16} />
                {saving ? 'جاري الحفظ...' : 'تأكيد وخصم المخزون'}
              </button>
              <button onClick={handleSaveDraft}
                disabled={saving || !validRows.length}
                className="flex items-center gap-2 bg-amber-500 text-white px-5 py-2.5 rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm font-medium">
                حفظ كمسودة
              </button>
              <button onClick={resetRows}
                className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-sm">
                مسح
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              "تأكيد وخصم المخزون" — يخصم الخامات فوراً ولا يمكن التعديل.
              "حفظ كمسودة" — يحفظ بدون خصم، يمكنك مراجعتها وتأكيدها لاحقاً.
            </p>
          </div>

          {/* drafts list */}
          {drafts.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 bg-amber-400 rounded-full inline-block"></span>
                  المسودات ({drafts.length})
                </h2>
                <button onClick={handleConfirmAllDrafts}
                  className="flex items-center gap-1.5 text-sm bg-green-600 text-white px-4 py-1.5 rounded-lg hover:bg-green-700 font-medium">
                  <CheckCircle size={14} /> تأكيد الكل وخصم المخزون
                </button>
              </div>
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    {['الوجبة','الكمية','السعر','الإجمالي','التاريخ','العميل',''].map(h => (
                      <th key={h} className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {drafts.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      {editingDraft?.id === d.id ? (
                        <>
                          <td className="px-4 py-2 font-medium text-slate-800">{d.product?.name}</td>
                          <td className="px-4 py-2">
                            <input type="number" min="0.5" step="0.5"
                              value={editingDraft.quantity}
                              onChange={e => setEditingDraft(x => x && ({ ...x, quantity: +e.target.value }))}
                              className={`${inputCls} w-20`} />
                          </td>
                          <td className="px-4 py-2">
                            <input type="number" min="0" step="0.01"
                              value={editingDraft.unitPrice}
                              onChange={e => setEditingDraft(x => x && ({ ...x, unitPrice: +e.target.value }))}
                              className={`${inputCls} w-24`} />
                          </td>
                          <td className="px-4 py-2 font-mono text-sm font-semibold text-slate-700">
                            {(editingDraft.quantity * editingDraft.unitPrice).toFixed(2)} ج
                          </td>
                          <td className="px-4 py-2">
                            <input type="date"
                              value={toISODate(editingDraft.saleDate)}
                              onChange={e => setEditingDraft(x => x && ({ ...x, saleDate: e.target.value }))}
                              className={`${inputCls} w-36`} />
                          </td>
                          <td className="px-4 py-2">
                            <select value={editingDraft.customerId ?? ''}
                              onChange={e => setEditingDraft(x => x && ({ ...x, customerId: e.target.value ? +e.target.value : null }))}
                              className={`${inputCls} w-32`}>
                              <option value="">بدون عميل</option>
                              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <button onClick={saveEditingDraft}
                                className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded-lg hover:bg-blue-700">
                                حفظ
                              </button>
                              <button onClick={() => setEditingDraft(null)}
                                className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg hover:bg-slate-200">
                                إلغاء
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium text-slate-800">{d.product?.name}</td>
                          <td className="px-4 py-3 text-slate-600 text-sm">× {d.quantity}</td>
                          <td className="px-4 py-3 font-mono text-sm text-slate-600">{d.unitPrice.toFixed(2)} ج</td>
                          <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800">{d.total.toFixed(2)} ج</td>
                          <td className="px-4 py-3 text-slate-500 text-sm">
                            {new Date(d.saleDate).toLocaleDateString('ar-EG')}
                          </td>
                          <td className="px-4 py-3 text-slate-500 text-sm">{d.customer?.name ?? '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-1">
                              <button onClick={() => handleConfirmDraft(d.id)}
                                title="تأكيد وخصم المخزون"
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg">
                                <CheckCircle size={15} />
                              </button>
                              <button onClick={() => setEditingDraft(d)}
                                title="تعديل"
                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDeleteDraft(d.id)}
                                title="حذف"
                                className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: excel import ─────────────────────────────────────────── */}
      {tab === 'import' && (
        <div className="space-y-5">
          {/* step 1 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800 mb-1">تحميل قالب Excel</h3>
                <p className="text-sm text-slate-500 mb-3">
                  القالب يحتوي على أسماء الوجبات وأسعارها الافتراضية. فقط اكتب الكميات في عمود "الكمية".
                  الصفوف التي تكون كميتها صفر سيتم تجاهلها تلقائياً.
                </p>
                <button onClick={downloadTemplate} disabled={products.length === 0}
                  className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium">
                  <Download size={16} /> تحميل القالب ({products.length} وجبة)
                </button>
                {products.length === 0 && (
                  <p className="text-amber-600 text-xs mt-2">لازم تضيف وجبات نشطة أولاً</p>
                )}
              </div>
            </div>
          </div>

          {/* step 2 */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-800 mb-1">رفع الملف المكتمل</h3>
                <p className="text-sm text-slate-500 mb-3">
                  بعد ما تملأ الكميات في القالب، ارفع الملف هنا للمعاينة قبل التأكيد.
                </p>
                <label className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-lg cursor-pointer text-sm font-medium w-fit transition-colors">
                  <Upload size={16} />
                  {importFileName ? importFileName : 'اختر ملف .xlsx أو .xls'}
                  <input ref={fileRef} type="file" accept=".xlsx,.xls"
                    onChange={onFileChange} className="hidden" />
                </label>
                {importFileName && (
                  <button onClick={clearImport}
                    className="mr-2 text-sm text-red-400 hover:text-red-600">
                    مسح
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* preview */}
          {importRows.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h3 className="font-semibold text-slate-800">معاينة البيانات</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {importRows.filter(r => r.valid).length} صف صالح
                    {importRows.filter(r => !r.valid).length > 0 &&
                      <span className="text-red-500 mr-2">— {importRows.filter(r => !r.valid).length} صف بخطأ</span>
                    }
                  </p>
                </div>
                <button onClick={handleImport}
                  disabled={importing || !importRows.some(r => r.valid)}
                  className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  <FileSpreadsheet size={16} />
                  {importing ? 'جاري الاستيراد...' : `تأكيد استيراد ${importRows.filter(r=>r.valid).length} صف`}
                </button>
              </div>
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    {['الوجبة','الكمية','السعر','الإجمالي','التاريخ','ملاحظة',''].map(h => (
                      <th key={h} className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {importRows.map((row, i) => (
                    <tr key={i} className={row.valid ? 'hover:bg-slate-50' : 'bg-red-50'}>
                      <td className="px-4 py-3 font-medium text-slate-800">{row.name || `ID: ${row.product_id}`}</td>
                      <td className="px-4 py-3 text-slate-600 text-sm">× {row.quantity}</td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-600">{row.unitPrice.toFixed(2)} ج</td>
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800">
                        {(row.quantity * row.unitPrice).toFixed(2)} ج
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-sm">{row.saleDate}</td>
                      <td className="px-4 py-3 text-slate-400 text-sm">{row.note}</td>
                      <td className="px-4 py-3">
                        {row.valid
                          ? <CheckCircle size={15} className="text-green-500" />
                          : (
                            <span className="flex items-center gap-1 text-xs text-red-500">
                              <AlertCircle size={13} /> {row.error}
                            </span>
                          )
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* import total */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
                <span className="text-sm text-slate-600">
                  إجمالي الاستيراد:{' '}
                  <span className="font-bold text-slate-800 font-mono">
                    {importRows.filter(r=>r.valid).reduce((s,r) => s + r.quantity * r.unitPrice, 0).toFixed(2)} ج
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
