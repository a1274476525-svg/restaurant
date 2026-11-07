import { useEffect, useState } from 'react'
import { Plus, X, Trash2, ClipboardList, ChevronDown, ChevronUp, CheckCircle, Clock, Printer, FileText } from 'lucide-react'
import type { PurchaseRequest, Ingredient, Supplier } from '../types'
import { Field, inputCls, DeleteConfirm } from '../components/ui'

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'معلق',    color: 'bg-yellow-100 text-yellow-700' },
  approved:  { label: 'معتمد',   color: 'bg-blue-100 text-blue-700' },
  ordered:   { label: 'مُطلب',   color: 'bg-purple-100 text-purple-700' },
  completed: { label: 'مكتمل',   color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'ملغي',    color: 'bg-red-100 text-red-600' },
}

const STATUS_ORDER = ['pending', 'approved', 'ordered', 'completed', 'cancelled']

function printRequest(req: PurchaseRequest) {
  const rows = req.items.map(item => `
    <tr>
      <td>${item.ingredient?.name ?? ''}</td>
      <td style="font-family:monospace">${item.quantity} ${item.ingredient?.unit ?? ''}</td>
      <td>${item.notes ?? '—'}</td>
    </tr>`).join('')

  const statusLabel = STATUS_CONFIG[req.status]?.label ?? req.status
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>طلب شراء #${req.id}</title>
  <style>
    * { font-family: Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
    body { padding: 32px; color: #1e293b; direction: rtl; }
    .header { text-align: center; border-bottom: 2px solid #334155; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 22px; margin-bottom: 4px; }
    .header p  { font-size: 13px; color: #64748b; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; font-size: 13px; }
    .meta div { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
    .meta label { color: #64748b; display: block; font-size: 11px; margin-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #1e293b; color: #fff; padding: 9px 12px; text-align: right; font-weight: 600; }
    td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>طلب شراء</h1>
    <p>رقم الطلب: #${req.id} &nbsp;|&nbsp; الحالة: ${statusLabel}</p>
  </div>
  <div class="meta">
    <div><label>المورد</label>${req.supplier?.name ?? 'بدون مورد'}</div>
    <div><label>تاريخ الطلب</label>${new Date(req.requestDate).toLocaleDateString('ar-EG')}</div>
    ${req.notes ? `<div style="grid-column:1/-1"><label>ملاحظات</label>${req.notes}</div>` : ''}
  </div>
  <table>
    <thead><tr><th>المادة</th><th>الكمية المطلوبة</th><th>ملاحظة</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">تم إنشاؤه بواسطة نظام إدارة المطعم — ${new Date().toLocaleDateString('ar-EG')}</div>
</body>
</html>`
  const w = window.open('', '_blank', 'width=800,height=600')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 400)
}

interface ItemRow { ingredientId: number; quantity: number; notes: string }

export default function PurchaseRequests() {
  const [requests, setRequests]       = useState<PurchaseRequest[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [suppliers, setSuppliers]     = useState<Supplier[]>([])
  const [showForm, setShowForm]       = useState(false)
  const [expanded, setExpanded]       = useState<number | null>(null)
  const [deleteId, setDeleteId]       = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [saving, setSaving]           = useState(false)
  const [convertReq, setConvertReq]   = useState<PurchaseRequest | null>(null)

  const [form, setForm] = useState({
    supplierId: '' as string | number,
    notes: '',
    items: [] as ItemRow[],
  })

  const load = () => window.api.purchaseRequests.getAll().then(setRequests)

  useEffect(() => {
    Promise.all([
      window.api.purchaseRequests.getAll(),
      window.api.ingredients.getAll(),
      window.api.suppliers.getAll(),
    ]).then(([r, i, s]) => { setRequests(r); setIngredients(i); setSuppliers(s) })
  }, [])

  const addRow = () =>
    setForm(f => ({
      ...f,
      items: [...f.items, { ingredientId: ingredients[0]?.id || 0, quantity: 0, notes: '' }],
    }))

  const removeRow = (idx: number) =>
    setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))

  const updateRow = (idx: number, field: keyof ItemRow, val: string | number) =>
    setForm(f => ({
      ...f,
      items: f.items.map((r, i) => i === idx ? { ...r, [field]: val } : r),
    }))

  const openForm = () => {
    setForm({
      supplierId: suppliers[0]?.id ?? '',
      notes: '',
      items: ingredients.length > 0
        ? [{ ingredientId: ingredients[0].id, quantity: 0, notes: '' }]
        : [],
    })
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    const validItems = form.items.filter(r => r.quantity > 0)
    if (validItems.length === 0) return
    setSaving(true)
    try {
      await window.api.purchaseRequests.create({
        supplierId: form.supplierId ? +form.supplierId : null,
        notes:      form.notes || null,
        items:      validItems,
      })
      setShowForm(false)
      load()
    } finally { setSaving(false) }
  }

  const handleStatusChange = async (id: number, status: string) => {
    await window.api.purchaseRequests.updateStatus({ id, status })
    load()
  }

  const handleDelete = async () => {
    if (deleteId == null) return
    await window.api.purchaseRequests.delete(deleteId)
    setDeleteId(null)
    load()
  }

  const filtered = filterStatus
    ? requests.filter(r => r.status === filterStatus)
    : requests

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">طلبات الشراء</h1>
          <p className="text-slate-400 text-sm mt-0.5">{requests.length} طلب مسجل</p>
        </div>
        <button onClick={openForm} disabled={ingredients.length === 0}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
          <Plus size={16} /> طلب شراء جديد
        </button>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-xl shadow-sm p-3 mb-5 flex flex-wrap items-center gap-2">
        {[{ value: '', label: 'الكل' }, ...STATUS_ORDER.map(s => ({ value: s, label: STATUS_CONFIG[s].label }))].map(opt => (
          <button key={opt.value}
            onClick={() => setFilterStatus(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === opt.value
                ? 'bg-blue-600 text-white'
                : 'text-slate-500 hover:bg-slate-100'
            }`}>
            {opt.label}
          </button>
        ))}
        <span className="text-slate-400 text-sm mr-auto">{filtered.length} طلب</span>
      </div>

      {/* Records */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm px-6 py-12 text-center text-slate-400">
            <ClipboardList size={40} className="mx-auto mb-3 opacity-30" />
            لا توجد طلبات شراء
          </div>
        )}

        {filtered.map(req => {
          const cfg    = STATUS_CONFIG[req.status] ?? { label: req.status, color: 'bg-slate-100 text-slate-600' }
          const isOpen = expanded === req.id
          return (
            <div key={req.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50 select-none"
                onClick={() => setExpanded(isOpen ? null : req.id)}
              >
                <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  #{req.id}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">
                    {req.supplier?.name ?? 'بدون مورد'}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {new Date(req.requestDate).toLocaleDateString('ar-EG')}
                    {req.notes && ` · ${req.notes}`}
                  </p>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.color}`}>{cfg.label}</span>
                <span className="text-slate-400 text-sm">{req.items.length} مادة</span>
                {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                <button
                  onClick={e => { e.stopPropagation(); setDeleteId(req.id) }}
                  className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>

              {isOpen && (
                <div className="border-t border-slate-100 px-5 py-4">
                  {/* Items */}
                  <table className="w-full text-sm mb-4">
                    <thead>
                      <tr className="text-slate-400 text-xs border-b border-slate-100">
                        <th className="text-right pb-2 font-semibold">المادة</th>
                        <th className="text-right pb-2 font-semibold">الكمية</th>
                        <th className="text-right pb-2 font-semibold">ملاحظة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {req.items.map(item => (
                        <tr key={item.id}>
                          <td className="py-2 text-slate-700">{item.ingredient?.name}</td>
                          <td className="py-2 font-mono">{item.quantity} {item.ingredient?.unit}</td>
                          <td className="py-2 text-slate-400">{item.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Status actions */}
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                    {/* Print button always visible */}
                    <button onClick={() => printRequest(req)}
                      className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-50 font-medium">
                      <Printer size={11} /> طباعة
                    </button>

                    {/* Convert to invoice - for non-completed, non-cancelled */}
                    {req.status !== 'completed' && req.status !== 'cancelled' && (
                      <button onClick={() => setConvertReq(req)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border border-blue-300 text-blue-700 hover:bg-blue-50 font-medium">
                        <FileText size={11} /> تحويل لفاتورة شراء
                      </button>
                    )}

                    {req.status !== 'completed' && req.status !== 'cancelled' && (
                      <>
                        <span className="text-slate-300 text-xs">|</span>
                        <p className="text-xs text-slate-400">تغيير الحالة:</p>
                        {STATUS_ORDER.filter(s => s !== req.status && s !== 'pending').map(s => (
                          <button key={s}
                            onClick={() => handleStatusChange(req.id, s)}
                            className={`text-xs px-3 py-1 rounded-full border font-medium transition-colors ${
                              s === 'completed' ? 'border-green-300 text-green-700 hover:bg-green-50' :
                              s === 'cancelled' ? 'border-red-300 text-red-600 hover:bg-red-50' :
                              'border-slate-300 text-slate-600 hover:bg-slate-50'
                            }`}>
                            {STATUS_CONFIG[s].label}
                          </button>
                        ))}
                      </>
                    )}

                    {(req.status === 'completed' || req.status === 'cancelled') && (
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${
                        req.status === 'completed' ? 'text-green-600' : 'text-red-500'
                      }`}>
                        {req.status === 'completed' ? <CheckCircle size={13} /> : <Clock size={13} />}
                        {STATUS_CONFIG[req.status].label}
                      </span>
                    )}
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
              <h2 className="text-lg font-bold text-slate-800">طلب شراء جديد</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <Field label="المورد">
                  <select value={form.supplierId}
                    onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                    className={inputCls}>
                    <option value="">بدون مورد</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </Field>
                <Field label="ملاحظات">
                  <input value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className={inputCls} placeholder="ملاحظة عامة..." />
                </Field>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-700">المواد المطلوبة</p>
                  <button type="button" onClick={addRow}
                    className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                    <Plus size={13} /> إضافة مادة
                  </button>
                </div>

                {form.items.length === 0 && (
                  <p className="text-slate-400 text-sm text-center py-4">لا توجد مواد، أضف مادة واحدة على الأقل</p>
                )}

                {form.items.map((row, idx) => (
                  <div key={idx} className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-2 mb-2">
                      <select value={row.ingredientId}
                        onChange={e => updateRow(idx, 'ingredientId', +e.target.value)}
                        className={`${inputCls} flex-1`}>
                        {ingredients.map(i => (
                          <option key={i.id} value={i.id}>{i.name} ({i.currentStock} {i.unit})</option>
                        ))}
                      </select>
                      <button type="button" onClick={() => removeRow(idx)}
                        className="text-slate-300 hover:text-red-500 p-1.5 flex-shrink-0"><X size={15} /></button>
                    </div>
                    <div className="flex gap-2">
                      <input type="number" step="0.001" min="0" placeholder="الكمية" required
                        value={row.quantity || ''}
                        onChange={e => updateRow(idx, 'quantity', +e.target.value)}
                        className={`${inputCls} w-32`} />
                      <input placeholder="ملاحظة (اختياري)"
                        value={row.notes}
                        onChange={e => updateRow(idx, 'notes', e.target.value)}
                        className={`${inputCls} flex-1`} />
                    </div>
                  </div>
                ))}
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
          message="هل تريد حذف طلب الشراء هذا؟"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {convertReq && (
        <ConvertModal
          req={convertReq}
          onClose={() => setConvertReq(null)}
          onDone={() => { setConvertReq(null); load() }}
        />
      )}
    </div>
  )
}

interface ConvRow { ingredientId: number; quantity: number; unitPrice: number; name: string; unit: string }

function ConvertModal({ req, onClose, onDone }: { req: PurchaseRequest; onClose: () => void; onDone: () => void }) {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const [invoiceDate,   setInvoiceDate]   = useState(today)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [taxRate,       setTaxRate]       = useState(0)
  const [notes,         setNotes]         = useState(req.notes ?? '')
  const [rows, setRows] = useState<ConvRow[]>(
    req.items.map(it => ({
      ingredientId: it.ingredientId,
      quantity:     it.quantity,
      unitPrice:    it.ingredient?.costPerUnit ?? 0,
      name:         it.ingredient?.name ?? '',
      unit:         it.ingredient?.unit ?? '',
    }))
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const subtotal  = rows.reduce((s, r) => s + r.quantity * r.unitPrice, 0)
  const taxAmount = subtotal * (taxRate / 100)
  const total     = subtotal + taxAmount

  const buildPayload = () => ({
    supplierId:    req.supplierId,
    invoiceNumber: invoiceNumber || null,
    invoiceDate,
    subtotal, taxRate, taxAmount, total,
    notes: notes || null,
    items: rows.map(r => ({
      ingredientId: r.ingredientId,
      quantity:     r.quantity,
      unitPrice:    r.unitPrice,
      totalPrice:   r.quantity * r.unitPrice,
    })),
  })

  const save = async (confirm: boolean) => {
    if (rows.some(r => r.quantity <= 0)) return setError('تأكد من إدخال الكميات')
    setSaving(true)
    setError('')
    try {
      if (confirm) {
        await window.api.invoices.create(buildPayload())
      } else {
        await window.api.invoices.saveDraft(buildPayload())
      }
      await window.api.purchaseRequests.updateStatus({ id: req.id, status: 'completed' })
      onDone()
    } catch (e: any) { setError(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <FileText size={18} className="text-blue-600" />
            تحويل طلب #{req.id} إلى فاتورة شراء
          </h2>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2">{error}</div>}

          <div className="grid grid-cols-3 gap-3">
            <Field label="تاريخ الفاتورة *">
              <input type="date" value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="رقم الفاتورة">
              <input value={invoiceNumber} placeholder="اختياري"
                onChange={e => setInvoiceNumber(e.target.value)} className={inputCls} />
            </Field>
            <Field label="نسبة الضريبة (%)">
              <input type="number" min="0" max="100" step="0.1" value={taxRate}
                onChange={e => setTaxRate(+e.target.value)} className={inputCls} />
            </Field>
          </div>

          <Field label="ملاحظات">
            <input value={notes} placeholder="اختياري"
              onChange={e => setNotes(e.target.value)} className={inputCls} />
          </Field>

          {/* Items */}
          <div>
            <p className="text-sm font-semibold text-slate-700 mb-2">
              المواد — أدخل سعر الوحدة الفعلي عند الاستلام
            </p>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500">المادة</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">الكمية</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-32">سعر الوحدة (ج)</th>
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500 w-28">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {rows.map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-slate-700">{row.name} <span className="text-slate-400 text-xs">({row.unit})</span></td>
                      <td className="px-3 py-2">
                        <input type="number" min="0.001" step="0.001" value={row.quantity || ''}
                          onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, quantity: +e.target.value } : r))}
                          className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-full font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" step="0.01" value={row.unitPrice || ''}
                          onChange={e => setRows(prev => prev.map((r, idx) => idx === i ? { ...r, unitPrice: +e.target.value } : r))}
                          className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-full font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </td>
                      <td className="px-3 py-2 font-mono text-slate-700">
                        {(row.quantity * row.unitPrice).toFixed(2)} ج
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totals */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>الإجمالي قبل الضريبة</span>
              <span className="font-mono">{subtotal.toFixed(2)} ج</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-slate-600">
                <span>ضريبة {taxRate}%</span>
                <span className="font-mono">{taxAmount.toFixed(2)} ج</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1.5">
              <span>الإجمالي الكلي</span>
              <span className="font-mono text-blue-600">{total.toFixed(2)} ج</span>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            سيتم تحديث حالة طلب الشراء إلى "مكتمل" عند الحفظ.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex gap-2">
          <button onClick={() => save(false)} disabled={saving}
            className="flex-1 bg-amber-500 text-white py-2.5 rounded-xl font-semibold hover:bg-amber-600 disabled:opacity-50 text-sm">
            {saving ? '...' : 'حفظ كمسودة'}
          </button>
          <button onClick={() => save(true)} disabled={saving}
            className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 text-sm">
            {saving ? 'جاري الحفظ...' : 'تأكيد وتحديث المخزون'}
          </button>
          <button onClick={onClose}
            className="px-5 border border-slate-300 text-slate-700 py-2.5 rounded-xl font-semibold hover:bg-slate-50 text-sm">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}
