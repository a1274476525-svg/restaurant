import { useEffect, useState } from 'react'
import { Plus, Eye, X, Trash2, FileText, Calendar, Building2, Printer, Edit2, CheckCircle } from 'lucide-react'
import type { PurchaseInvoice, Supplier, Ingredient } from '../types'
import { Field, inputCls } from '../components/ui'

function printInvoice(inv: PurchaseInvoice) {
  const rows = (inv.items || []).map(item => `
    <tr>
      <td>${item.ingredient?.name ?? ''}</td>
      <td>${item.quantity} ${item.ingredient?.unit ?? ''}</td>
      <td>${item.unitPrice.toFixed(2)} ج</td>
      <td>${item.totalPrice.toFixed(2)} ج</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>فاتورة شراء ${inv.invoiceNumber || '#' + inv.id}</title>
  <style>
    * { font-family: Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
    body { padding: 32px; color: #1e293b; direction: rtl; }
    .header { text-align: center; border-bottom: 2px solid #334155; padding-bottom: 16px; margin-bottom: 24px; }
    .header h1 { font-size: 22px; margin-bottom: 4px; }
    .header p  { font-size: 13px; color: #64748b; }
    .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; font-size: 13px; }
    .meta div { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 14px; }
    .meta label { color: #64748b; display: block; font-size: 11px; margin-bottom: 3px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
    th { background: #1e293b; color: #fff; padding: 9px 12px; text-align: right; font-weight: 600; }
    td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .totals { width: 280px; margin-right: auto; font-size: 13px; }
    .totals tr td { padding: 6px 10px; border: none; }
    .totals tr:last-child td { font-weight: bold; font-size: 15px; border-top: 2px solid #334155; padding-top: 10px; }
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>فاتورة شراء</h1>
    <p>${inv.invoiceNumber ? `رقم الفاتورة: ${inv.invoiceNumber}` : `فاتورة #${inv.id}`}</p>
  </div>
  <div class="meta">
    <div><label>المورد</label>${inv.supplier?.name ?? 'بدون مورد'}</div>
    <div><label>التاريخ</label>${new Date(inv.invoiceDate).toLocaleDateString('ar-EG')}</div>
    ${inv.notes ? `<div style="grid-column:1/-1"><label>ملاحظات</label>${inv.notes}</div>` : ''}
  </div>
  <table>
    <thead><tr><th>المادة</th><th>الكمية</th><th>سعر الوحدة</th><th>الإجمالي</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals">
    <tr><td>الإجمالي قبل الضريبة</td><td>${inv.subtotal.toFixed(2)} ج</td></tr>
    ${inv.taxRate > 0 ? `<tr><td>ضريبة ${inv.taxRate}%</td><td>${inv.taxAmount.toFixed(2)} ج</td></tr>` : ''}
    <tr><td>الإجمالي الكلي</td><td>${inv.total.toFixed(2)} ج</td></tr>
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

type InvoiceRow = { ingredientId: number; quantity: number; unitPrice: number }

function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const emptyHeader = {
  supplierId: '',
  invoiceNumber: '',
  invoiceDate: todayLocal(),
  taxRate: 0,
  notes: '',
}

export default function PurchaseInvoices() {
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([])
  const [drafts, setDrafts] = useState<PurchaseInvoice[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [ingredients, setIngredients] = useState<Ingredient[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editingDraftId, setEditingDraftId] = useState<number | null>(null)
  const [viewInvoice, setViewInvoice] = useState<PurchaseInvoice | null>(null)
  const [header, setHeader] = useState(emptyHeader)
  const [rows, setRows] = useState<InvoiceRow[]>([])
  const [saving, setSaving] = useState(false)

  const loadAll = async () => {
    const [inv, drf, sup, ing] = await Promise.all([
      window.api.invoices.getAll(),
      window.api.invoices.getDrafts(),
      window.api.suppliers.getAll(),
      window.api.ingredients.getAll(),
    ])
    setInvoices(inv)
    setDrafts(drf)
    setSuppliers(sup)
    setIngredients(ing)
  }

  useEffect(() => { loadAll() }, [])

  const openForm = () => {
    setEditingDraftId(null)
    setHeader(emptyHeader)
    setRows([{ ingredientId: ingredients[0]?.id || 0, quantity: 0, unitPrice: 0 }])
    setShowForm(true)
  }

  const openDraftForEdit = (inv: PurchaseInvoice) => {
    setEditingDraftId(inv.id)
    setHeader({
      supplierId:    String(inv.supplierId ?? ''),
      invoiceNumber: inv.invoiceNumber ?? '',
      invoiceDate:   new Date(inv.invoiceDate).toISOString().slice(0, 10),
      taxRate:       inv.taxRate,
      notes:         inv.notes ?? '',
    })
    setRows(inv.items.map(it => ({
      ingredientId: it.ingredientId,
      quantity:     it.quantity,
      unitPrice:    it.unitPrice,
    })))
    setShowForm(true)
  }

  const addRow = () => {
    const used = rows.map(r => r.ingredientId)
    const available = ingredients.find(i => !used.includes(i.id))
    setRows(prev => [...prev, { ingredientId: available?.id || ingredients[0]?.id || 0, quantity: 0, unitPrice: 0 }])
  }

  const updateRow = (index: number, field: keyof InvoiceRow, value: number) => {
    setRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r))
  }

  const removeRow = (index: number) => setRows(prev => prev.filter((_, i) => i !== index))

  const getIng = (id: number) => ingredients.find(i => i.id === id)

  const subtotal = rows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0)
  const taxAmount = subtotal * (header.taxRate / 100)
  const total = subtotal + taxAmount

  const buildPayload = (validRows: InvoiceRow[]) => ({
    supplierId:    header.supplierId ? +header.supplierId : null,
    invoiceNumber: header.invoiceNumber || null,
    invoiceDate:   header.invoiceDate,
    subtotal,
    taxRate:       header.taxRate,
    taxAmount,
    total,
    notes:         header.notes || null,
    items: validRows.map(r => ({
      ingredientId: r.ingredientId,
      quantity:     r.quantity,
      unitPrice:    r.unitPrice,
      totalPrice:   r.quantity * r.unitPrice,
    })),
  })

  const handleConfirmDirect = async (e: React.FormEvent) => {
    e.preventDefault()
    const validRows = rows.filter(r => r.quantity > 0 && r.unitPrice > 0)
    if (!validRows.length) return
    setSaving(true)
    try {
      if (editingDraftId) {
        // update draft then confirm it
        await window.api.invoices.updateDraft({ id: editingDraftId, ...buildPayload(validRows) })
        await window.api.invoices.confirmDraft(editingDraftId)
      } else {
        await window.api.invoices.create(buildPayload(validRows))
      }
      setShowForm(false)
      await loadAll()
    } finally { setSaving(false) }
  }

  const handleSaveDraft = async () => {
    const validRows = rows.filter(r => r.quantity > 0 && r.unitPrice > 0)
    if (!validRows.length) return
    setSaving(true)
    try {
      if (editingDraftId) {
        await window.api.invoices.updateDraft({ id: editingDraftId, ...buildPayload(validRows) })
      } else {
        await window.api.invoices.saveDraft(buildPayload(validRows))
      }
      setShowForm(false)
      await loadAll()
    } finally { setSaving(false) }
  }

  const handleDeleteDraft = async (id: number) => {
    await window.api.invoices.deleteDraft(id)
    await loadAll()
  }

  const handleConfirmDraft = async (id: number) => {
    await window.api.invoices.confirmDraft(id)
    await loadAll()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">فواتير الشراء</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {invoices.length} فاتورة مؤكدة
            {drafts.length > 0 && (
              <span className="text-amber-500 mr-2">— {drafts.length} مسودة في الانتظار</span>
            )}
          </p>
        </div>
        <button onClick={openForm} disabled={ingredients.length === 0}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed">
          <Plus size={16} /> فاتورة شراء جديدة
        </button>
      </div>

      {ingredients.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-amber-700 text-sm">
          لازم تضيف مواد خام أولاً قبل ما تقدر تعمل فاتورة شراء.
        </div>
      )}

      {/* Drafts Section */}
      {drafts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden mb-5">
          <div className="flex items-center justify-between px-5 py-3 border-b border-amber-200">
            <h2 className="font-semibold text-amber-800 flex items-center gap-2">
              <span className="w-2 h-2 bg-amber-400 rounded-full inline-block"></span>
              مسودات غير مؤكدة ({drafts.length})
            </h2>
          </div>
          <table className="w-full">
            <thead className="bg-amber-100/60">
              <tr>
                {['رقم/المرجع','المورد','التاريخ','الأصناف','الإجمالي',''].map(h => (
                  <th key={h} className="text-right px-4 py-2.5 text-xs font-semibold text-amber-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {drafts.map(inv => (
                <tr key={inv.id} className="hover:bg-amber-100/40">
                  <td className="px-4 py-3 font-mono text-sm text-slate-700">
                    {inv.invoiceNumber || `مسودة #${inv.id}`}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-sm">
                    {inv.supplier?.name || <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-sm">
                    {new Date(inv.invoiceDate).toLocaleDateString('ar-EG')}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-sm">{inv.items?.length || 0} صنف</td>
                  <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800">
                    {inv.total.toFixed(2)} ج
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => handleConfirmDraft(inv.id)}
                        title="تأكيد وتحديث المخزون"
                        className="flex items-center gap-1 text-xs bg-green-600 text-white px-2.5 py-1.5 rounded-lg hover:bg-green-700 font-medium">
                        <CheckCircle size={13} /> تأكيد
                      </button>
                      <button onClick={() => openDraftForEdit(inv)}
                        title="تعديل المسودة"
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setViewInvoice(inv)}
                        title="عرض"
                        className="p-1.5 text-slate-400 hover:bg-slate-100 rounded-lg">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => handleDeleteDraft(inv.id)}
                        title="حذف المسودة"
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoices Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              {['رقم الفاتورة', 'المورد', 'التاريخ', 'عدد الأصناف', 'الإجمالي قبل الضريبة', 'الضريبة', 'الإجمالي', ''].map(h => (
                <th key={h} className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {invoices.map(inv => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="font-mono text-sm text-slate-700">
                    {inv.invoiceNumber || `#${inv.id}`}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 text-sm">
                  {inv.supplier?.name || <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-sm">
                  {new Date(inv.invoiceDate).toLocaleDateString('ar-EG')}
                </td>
                <td className="px-4 py-3 text-slate-500 text-sm">{inv.items?.length || 0} صنف</td>
                <td className="px-4 py-3 font-mono text-sm text-slate-700">{inv.subtotal.toFixed(2)} ج</td>
                <td className="px-4 py-3 font-mono text-sm text-slate-500">
                  {inv.taxAmount > 0 ? `${inv.taxAmount.toFixed(2)} ج` : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800">
                  {inv.total.toFixed(2)} ج
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => setViewInvoice(inv)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                    <Eye size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {invoices.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">
                  لا توجد فواتير بعد — أضف أول فاتورة شراء
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* New Invoice Full-Screen Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col shadow-2xl">
            {/* Form Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText size={20} className={editingDraftId ? 'text-amber-500' : 'text-blue-600'} />
                {editingDraftId ? 'تعديل المسودة' : 'فاتورة شراء جديدة'}
              </h2>
              <button onClick={() => setShowForm(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmDirect} className="flex flex-col flex-1 overflow-hidden">
              {/* Invoice Meta */}
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
                <div className="grid grid-cols-4 gap-4">
                  <Field label="المورد">
                    <select
                      value={header.supplierId}
                      onChange={e => setHeader(h => ({ ...h, supplierId: e.target.value }))}
                      className={inputCls}
                    >
                      <option value="">بدون مورد</option>
                      {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </Field>
                  <Field label="رقم الفاتورة">
                    <input
                      value={header.invoiceNumber}
                      onChange={e => setHeader(h => ({ ...h, invoiceNumber: e.target.value }))}
                      className={inputCls}
                      placeholder="اختياري"
                    />
                  </Field>
                  <Field label="تاريخ الفاتورة *">
                    <input
                      type="date" required
                      value={header.invoiceDate}
                      onChange={e => setHeader(h => ({ ...h, invoiceDate: e.target.value }))}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="نسبة الضريبة (%)">
                    <input
                      type="number" min="0" max="100" step="0.1"
                      value={header.taxRate}
                      onChange={e => setHeader(h => ({ ...h, taxRate: +e.target.value }))}
                      className={inputCls}
                      placeholder="0"
                    />
                  </Field>
                </div>
                <div className="mt-3">
                  <Field label="ملاحظات">
                    <input
                      value={header.notes}
                      onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))}
                      className={inputCls}
                      placeholder="أي ملاحظات إضافية..."
                    />
                  </Field>
                </div>
              </div>

              {/* Items */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-6 py-3 flex items-center justify-between sticky top-0 bg-white border-b border-slate-100 z-10">
                  <span className="text-sm font-semibold text-slate-600">بنود الفاتورة</span>
                  <button type="button" onClick={addRow}
                    className="flex items-center gap-1.5 text-sm text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg">
                    <Plus size={14} /> إضافة صنف
                  </button>
                </div>

                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 min-w-[200px]">المادة الخام</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 w-20">الوحدة</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 w-28">الكمية</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 w-32">سعر الوحدة (ج)</th>
                      <th className="text-right px-4 py-2.5 text-xs font-semibold text-slate-500 w-28">الإجمالي</th>
                      <th className="w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {rows.map((row, index) => {
                      const ing = getIng(row.ingredientId)
                      const rowTotal = row.quantity * row.unitPrice
                      return (
                        <tr key={index}>
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
                          <td className="px-4 py-2.5 text-slate-500 text-sm">{ing?.storageUnit || ing?.unit || '—'}</td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number" min="0" step="0.001"
                              value={row.quantity || ''}
                              onChange={e => updateRow(index, 'quantity', +e.target.value)}
                              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full font-mono bg-white"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number" min="0" step="0.01"
                              value={row.unitPrice || ''}
                              onChange={e => updateRow(index, 'unitPrice', +e.target.value)}
                              className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full font-mono bg-white"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-4 py-2.5 font-mono text-sm font-semibold text-slate-700">
                            {rowTotal > 0 ? `${rowTotal.toFixed(2)} ج` : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            {rows.length > 1 && (
                              <button type="button" onClick={() => removeRow(index)}
                                className="p-1 text-slate-300 hover:text-red-500 rounded">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
                <div className="flex items-end justify-between">
                  <div className="text-xs text-slate-400 max-w-xs">
                    {editingDraftId
                      ? '"تأكيد" يحدّث المخزون ويقفل الفاتورة. "حفظ كمسودة" يحدّث المسودة بدون خصم.'
                      : '"تأكيد" يحدّث المخزون فوراً. "مسودة" تحفظ بدون خصم للمراجعة لاحقاً.'}
                  </div>
                  <div className="flex items-center gap-8">
                    <div className="text-right space-y-1">
                      <div className="flex items-center justify-between gap-12">
                        <span className="text-sm text-slate-500">الإجمالي قبل الضريبة</span>
                        <span className="font-mono text-sm text-slate-700">{subtotal.toFixed(2)} ج</span>
                      </div>
                      {header.taxRate > 0 && (
                        <div className="flex items-center justify-between gap-12">
                          <span className="text-sm text-slate-500">ضريبة {header.taxRate}%</span>
                          <span className="font-mono text-sm text-slate-700">{taxAmount.toFixed(2)} ج</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-12 pt-1 border-t border-slate-200">
                        <span className="text-sm font-semibold text-slate-700">الإجمالي الكلي</span>
                        <span className="font-mono text-lg font-bold text-slate-900">{total.toFixed(2)} ج</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {editingDraftId && (
                        <button type="button"
                          onClick={() => { handleDeleteDraft(editingDraftId); setShowForm(false) }}
                          className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 text-sm font-medium">
                          حذف المسودة
                        </button>
                      )}
                      <button type="button" onClick={() => setShowForm(false)}
                        className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 text-sm font-medium">
                        إلغاء
                      </button>
                      <button type="button"
                        onClick={handleSaveDraft}
                        disabled={saving || rows.every(r => r.quantity === 0)}
                        className="px-5 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 text-sm font-medium">
                        {saving ? '...' : editingDraftId ? 'تحديث المسودة' : 'حفظ كمسودة'}
                      </button>
                      <button type="submit"
                        disabled={saving || rows.every(r => r.quantity === 0)}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium min-w-36">
                        {saving ? 'جاري الحفظ...' : editingDraftId ? 'تأكيد الفاتورة' : 'تأكيد وتحديث المخزون'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Invoice Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">
                تفاصيل الفاتورة {viewInvoice.invoiceNumber || `#${viewInvoice.id}`}
              </h2>
              <div className="flex items-center gap-2">
                <button onClick={() => printInvoice(viewInvoice)}
                  className="flex items-center gap-1.5 text-sm bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                  <Printer size={15} /> طباعة
                </button>
                <button onClick={() => setViewInvoice(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <InfoBox
                  icon={<Building2 size={15} />}
                  label="المورد"
                  value={viewInvoice.supplier?.name || 'بدون مورد'}
                />
                <InfoBox
                  icon={<Calendar size={15} />}
                  label="التاريخ"
                  value={new Date(viewInvoice.invoiceDate).toLocaleDateString('ar-EG')}
                />
              </div>

              {/* Items Table */}
              <table className="w-full mb-6">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {['المادة', 'الكمية', 'الوحدة', 'سعر الوحدة', 'الإجمالي'].map(h => (
                      <th key={h} className="text-right px-3 py-2.5 text-xs font-semibold text-slate-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {viewInvoice.items?.map(item => (
                    <tr key={item.id}>
                      <td className="px-3 py-2.5 text-sm font-medium text-slate-800">{item.ingredient?.name}</td>
                      <td className="px-3 py-2.5 text-sm font-mono text-slate-600">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-sm text-slate-500">{item.ingredient?.unit}</td>
                      <td className="px-3 py-2.5 text-sm font-mono text-slate-600">{item.unitPrice.toFixed(2)} ج</td>
                      <td className="px-3 py-2.5 text-sm font-mono font-semibold text-slate-800">{item.totalPrice.toFixed(2)} ج</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>الإجمالي قبل الضريبة</span>
                  <span className="font-mono">{viewInvoice.subtotal.toFixed(2)} ج</span>
                </div>
                {viewInvoice.taxRate > 0 && (
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>ضريبة {viewInvoice.taxRate}%</span>
                    <span className="font-mono">{viewInvoice.taxAmount.toFixed(2)} ج</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-slate-800 border-t border-slate-200 pt-2">
                  <span>الإجمالي الكلي</span>
                  <span className="font-mono text-blue-600">{viewInvoice.total.toFixed(2)} ج</span>
                </div>
              </div>

              {viewInvoice.notes && (
                <div className="mt-4 p-3 bg-amber-50 rounded-lg text-sm text-slate-600">
                  <span className="font-semibold">ملاحظات: </span>{viewInvoice.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoBox({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-slate-400 text-xs mb-1">
        {icon} {label}
      </div>
      <p className="font-semibold text-slate-800">{value}</p>
    </div>
  )
}
