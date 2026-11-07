import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { Plus, Edit2, Trash2, Download, FileText, Search, X } from 'lucide-react'
import type { Expense } from '../types'
import { inputCls, Modal, Field, DeleteConfirm, SaveCancelButtons } from '../components/ui'

const CATEGORY_LABELS: Record<string, string> = {
  labor_kitchen:  'عمالة المطبخ',
  fuel:           'وقود المطبخ',
  kitchen_clean:  'نظافة المطبخ',
  water_ops:      'مياه التشغيل',
  rent:           'إيجار المحل',
  labor_other:    'رواتب (إدارة / خدمة)',
  electricity:    'كهرباء',
  gas:            'غاز',
  water:          'مياه',
  internet:       'اتصالات وإنترنت',
  maintenance:    'صيانة معدات',
  depreciation:   'إهلاك معدات',
  marketing:      'تسويق وإعلانات',
  licenses:       'رسوم وتراخيص',
  insurance:      'تأمين',
  cleaning:       'نظافة عامة',
  packaging:      'تغليف',
  other:          'أخرى',
}

const fmt   = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pad2  = (n: number) => String(n).padStart(2, '0')
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
const monthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`
}

const EMPTY_FORM = {
  date: today(), category: 'other', type: 'indirect' as 'direct' | 'indirect',
  description: '', amount: 0, invoiceNumber: '', vendor: '', notes: '',
}

export default function Expenses() {
  const [expenses, setExpenses]   = useState<Expense[]>([])
  const [loading,  setLoading]    = useState(true)
  const [search,   setSearch]     = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [dateRange, setDateRange] = useState({ from: monthStart(), to: today() })

  const [showModal, setShowModal] = useState(false)
  const [editing,   setEditing]   = useState<Expense | null>(null)
  const [deleteId,  setDeleteId]  = useState<number | null>(null)
  const [form,      setForm]      = useState({ ...EMPTY_FORM })
  const [saving,    setSaving]    = useState(false)

  async function load() {
    setLoading(true)
    const data = await window.api.expenses.getAll({ from: dateRange.from, to: dateRange.to })
    setExpenses(data)
    setLoading(false)
  }

  useEffect(() => { load() }, [dateRange.from, dateRange.to])

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, date: today() })
    setShowModal(true)
  }

  function openEdit(e: Expense) {
    setEditing(e)
    setForm({
      date:          new Date(e.date).toISOString().slice(0, 10),
      category:      e.category,
      type:          e.type,
      description:   e.description,
      amount:        e.amount,
      invoiceNumber: e.invoiceNumber ?? '',
      vendor:        e.vendor ?? '',
      notes:         e.notes ?? '',
    })
    setShowModal(true)
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    if (!form.description.trim()) return
    if (form.amount <= 0) return
    setSaving(true)
    try {
      if (editing) await window.api.expenses.update({ id: editing.id, ...form })
      else         await window.api.expenses.create(form)
      setShowModal(false)
      load()
    } finally { setSaving(false) }
  }

  async function del() {
    if (!deleteId) return
    await window.api.expenses.delete(deleteId)
    setDeleteId(null)
    load()
  }

  // فلترة
  const visible = expenses.filter(e => {
    if (filterCat  !== 'all' && e.category !== filterCat)  return false
    if (filterType !== 'all' && e.type     !== filterType)  return false
    if (search && !e.description.includes(search) && !(e.vendor ?? '').includes(search)
      && !(e.invoiceNumber ?? '').includes(search)) return false
    return true
  })

  const totalVisible = visible.reduce((s, e) => s + e.amount, 0)
  const totalDirect  = visible.filter(e => e.type === 'direct').reduce((s, e) => s + e.amount, 0)
  const totalIndirect= visible.filter(e => e.type === 'indirect').reduce((s, e) => s + e.amount, 0)

  function exportExcel() {
    const headers = ['التاريخ', 'الفئة', 'النوع', 'البيان', 'المبلغ', 'رقم الفاتورة', 'الجهة', 'ملاحظات']
    const rows = visible.map(e => [
      new Date(e.date).toISOString().slice(0, 10),
      CATEGORY_LABELS[e.category] ?? e.category,
      e.type === 'direct' ? 'مباشر' : 'غير مباشر',
      e.description, e.amount,
      e.invoiceNumber ?? '', e.vendor ?? '', e.notes ?? '',
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [12, 16, 12, 28, 12, 14, 16, 20].map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'فواتير المصاريف')
    XLSX.writeFile(wb, `expenses-${dateRange.from}-${dateRange.to}.xlsx`)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">فواتير المصاريف</h1>
          <p className="text-slate-400 text-sm mt-0.5">تسجيل المصاريف الفعلية بفواتيرها لإدراجها في قائمة الدخل</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 font-medium text-sm">
          <Plus size={16} /> إضافة مصروف
        </button>
      </div>

      {/* الفلاتر */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-slate-500">من</span>
          <input type="date" value={dateRange.from}
            onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <span className="text-sm text-slate-400">إلى</span>
          <input type="date" value={dateRange.to}
            onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">كل الأنواع</option>
          <option value="direct">مباشرة</option>
          <option value="indirect">غير مباشرة</option>
        </select>

        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">كل الفئات</option>
          {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>

        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث في البيان / الجهة / رقم الفاتورة..."
            className="w-full border border-slate-200 rounded-lg pr-8 pl-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          {search && <button onClick={() => setSearch('')} className="absolute left-2 top-2"><X size={13} className="text-slate-400" /></button>}
        </div>

        <button onClick={exportExcel} disabled={visible.length === 0}
          className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 text-sm font-medium disabled:opacity-40 mr-auto">
          <Download size={14} /> Excel
        </button>
      </div>

      {/* بطاقات الإجمالي */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-slate-400 mb-1">إجمالي الفترة</p>
          <p className="text-xl font-bold text-slate-800 font-mono">{fmt(totalVisible)} ج</p>
          <p className="text-xs text-slate-400 mt-0.5">{visible.length} فاتورة</p>
        </div>
        <div className="bg-orange-50 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">مباشرة</p>
          <p className="text-xl font-bold text-orange-700 font-mono">{fmt(totalDirect)} ج</p>
          <p className="text-xs text-slate-400 mt-0.5">{visible.filter(e => e.type === 'direct').length} فاتورة</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">غير مباشرة</p>
          <p className="text-xl font-bold text-blue-700 font-mono">{fmt(totalIndirect)} ج</p>
          <p className="text-xs text-slate-400 mt-0.5">{visible.filter(e => e.type === 'indirect').length} فاتورة</p>
        </div>
      </div>

      {/* الجدول */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">جاري التحميل...</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-16">
            <FileText size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">لا توجد فواتير في هذه الفترة</p>
            <button onClick={openAdd} className="mt-3 text-blue-600 text-sm hover:underline">
              إضافة أول مصروف
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['التاريخ','الفئة','النوع','البيان / الجهة','المبلغ','رقم الفاتورة',''].map(h => (
                  <th key={h} className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {visible.map(e => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                    {new Date(e.date).toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">
                    {CATEGORY_LABELS[e.category] ?? e.category}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      e.type === 'direct'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {e.type === 'direct' ? 'مباشر' : 'غير مباشر'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 text-sm">{e.description}</p>
                    {e.vendor && <p className="text-xs text-slate-400 mt-0.5">{e.vendor}</p>}
                    {e.notes  && <p className="text-xs text-slate-400">{e.notes}</p>}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-800 text-sm whitespace-nowrap">
                    {fmt(e.amount)} ج
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {e.invoiceNumber ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(e)}
                        className="p-1.5 text-blue-400 hover:bg-blue-50 rounded-lg">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => setDeleteId(e.id)}
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-slate-600">
                  الإجمالي ({visible.length} فاتورة)
                </td>
                <td className="px-4 py-3 font-mono font-bold text-slate-800">{fmt(totalVisible)} ج</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Modal الإضافة / التعديل */}
      {showModal && (
        <Modal title={editing ? 'تعديل مصروف' : 'إضافة مصروف جديد'} onClose={() => setShowModal(false)}>
          <form onSubmit={save} className="space-y-4">

            <div className="grid grid-cols-2 gap-3">
              <Field label="التاريخ">
                <input type="date" required value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="المبلغ (ج)">
                <input type="number" required min="0.01" step="0.01" value={form.amount || ''}
                  onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))}
                  placeholder="0.00" className={inputCls} />
              </Field>
            </div>

            <Field label="البيان / وصف المصروف">
              <input required value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="مثال: فاتورة كهرباء شهر يونيو" className={inputCls} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="النوع">
                <select value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                  className={inputCls}>
                  <option value="direct">مباشر (مرتبط بالإنتاج)</option>
                  <option value="indirect">غير مباشر (تشغيلي)</option>
                </select>
              </Field>
              <Field label="الفئة">
                <select value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className={inputCls}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="رقم الفاتورة (اختياري)">
                <input value={form.invoiceNumber}
                  onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))}
                  placeholder="مثال: INV-2024-001" className={inputCls} />
              </Field>
              <Field label="الجهة / المورد (اختياري)">
                <input value={form.vendor}
                  onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))}
                  placeholder="مثال: شركة الكهرباء" className={inputCls} />
              </Field>
            </div>

            <Field label="ملاحظات (اختياري)">
              <input value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className={inputCls} />
            </Field>

            {/* توجيه سريع */}
            <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
              <p className="font-semibold mb-1">الفرق بين النوعين:</p>
              <p>• <span className="font-medium text-orange-700">مباشر</span>: مرتبط مباشرة بالإنتاج — رواتب مطبخ، وقود، تغليف</p>
              <p>• <span className="font-medium text-blue-700">غير مباشر</span>: تكاليف تشغيلية — إيجار، كهرباء، صيانة، تسويق</p>
            </div>

            <SaveCancelButtons saving={saving} onCancel={() => setShowModal(false)} />
          </form>
        </Modal>
      )}

      {deleteId !== null && (
        <DeleteConfirm
          message="هل تريد حذف هذا المصروف؟"
          onConfirm={del}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
