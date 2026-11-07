import { useState, useEffect } from 'react'
import { Plus, Trash2, ChevronDown, ChevronRight, RefreshCw, BookOpen, X } from 'lucide-react'
import type { JournalEntry, ChartOfAccount } from '../types'
import { Modal, Field, DeleteConfirm, inputCls } from '../components/ui'

const fmt = (n: number) => n.toFixed(2)
const pad2 = (n: number) => String(n).padStart(2, '0')
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
const monthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`
}

interface LineForm {
  accountCode: string
  accountName: string
  description: string
  debit:  number | ''
  credit: number | ''
}

const EMPTY_LINE: LineForm = { accountCode: '', accountName: '', description: '', debit: '', credit: '' }

export default function Journals() {
  const [entries,  setEntries]  = useState<JournalEntry[]>([])
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [loading,  setLoading]  = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [dateRange, setDateRange] = useState({ from: monthStart(), to: today() })
  const [deleteId,  setDeleteId]  = useState<number | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [form, setForm] = useState({
    date: today(), description: '', reference: '',
    lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE }] as LineForm[],
  })

  async function load() {
    setLoading(true)
    const data = await window.api.journals.getAll({ from: dateRange.from, to: dateRange.to })
    setEntries(data)
    setLoading(false)
  }

  useEffect(() => { window.api.accounts.getAll().then(setAccounts) }, [])
  useEffect(() => { load() }, [dateRange.from, dateRange.to])

  function toggleExpand(id: number) {
    setExpanded(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  function openAdd() {
    setForm({ date: today(), description: '', reference: '', lines: [{ ...EMPTY_LINE }, { ...EMPTY_LINE }] })
    setShowModal(true)
  }

  function updateLine(idx: number, field: keyof LineForm, value: string | number) {
    setForm(f => {
      const lines = [...f.lines]
      lines[idx] = { ...lines[idx], [field]: value }
      if (field === 'accountCode') {
        const acc = accounts.find(a => a.code === String(value))
        if (acc) lines[idx].accountName = acc.name
      }
      return { ...f, lines }
    })
  }

  function setDebit(idx: number, val: string) {
    setForm(f => {
      const lines = [...f.lines]
      lines[idx] = { ...lines[idx], debit: val === '' ? '' : +val, credit: val !== '' && +val > 0 ? '' : lines[idx].credit }
      return { ...f, lines }
    })
  }

  function setCredit(idx: number, val: string) {
    setForm(f => {
      const lines = [...f.lines]
      lines[idx] = { ...lines[idx], credit: val === '' ? '' : +val, debit: val !== '' && +val > 0 ? '' : lines[idx].debit }
      return { ...f, lines }
    })
  }

  const totalDebit  = form.lines.reduce((s, l) => s + (Number(l.debit)  || 0), 0)
  const totalCredit = form.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const isBalanced  = totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.001

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    if (!isBalanced) return
    setSaving(true)
    try {
      const lines = form.lines
        .filter(l => l.accountCode && (Number(l.debit) > 0 || Number(l.credit) > 0))
        .map(l => ({
          accountCode: l.accountCode,
          accountName: l.accountName || null,
          description: l.description || null,
          debit:  Number(l.debit)  || 0,
          credit: Number(l.credit) || 0,
        }))
      await window.api.journals.create({
        date: form.date, description: form.description,
        reference: form.reference || null, lines,
      })
      setShowModal(false)
      load()
    } finally { setSaving(false) }
  }

  async function del() {
    if (!deleteId) return
    try {
      await window.api.journals.delete(deleteId)
    } catch (e: any) {
      alert(e.message ?? 'خطأ في الحذف')
    }
    setDeleteId(null)
    load()
  }

  const totalManual = entries.filter(e => !e.isAutomatic).length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">القيود اليومية</h1>
          <p className="text-slate-400 text-sm mt-0.5">سجل القيود المحاسبية اليدوية والتلقائية</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 font-medium text-sm">
          <Plus size={16} /> قيد يدوي جديد
        </button>
      </div>

      {/* ملخص */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white rounded-xl shadow-sm p-4">
          <p className="text-xs text-slate-400 mb-1">إجمالي القيود</p>
          <p className="text-2xl font-bold text-slate-800">{entries.length}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">يدوية</p>
          <p className="text-2xl font-bold text-blue-700">{totalManual}</p>
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-xs text-slate-400 mb-1">تلقائية</p>
          <p className="text-2xl font-bold text-slate-600">{entries.length - totalManual}</p>
        </div>
      </div>

      {/* فلتر التاريخ */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex items-center gap-3 flex-wrap no-print">
        <span className="text-sm text-slate-500">من</span>
        <input type="date" value={dateRange.from}
          onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-sm text-slate-400">إلى</span>
        <input type="date" value={dateRange.to}
          onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button onClick={load}
          className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm font-medium">
          <RefreshCw size={13} /> تحديث
        </button>
      </div>

      {/* الجدول */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">جاري التحميل...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">لا توجد قيود في هذه الفترة</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="w-8" />
                {['رقم القيد', 'التاريخ', 'البيان', 'المرجع', 'إجمالي المدين', 'النوع', ''].map(h => (
                  <th key={h} className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map(entry => {
                const isOpen = expanded.has(entry.id)
                const totalD = entry.lines.reduce((s, l) => s + l.debit, 0)
                return (
                  <>
                    <tr key={entry.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-2 py-3 text-center">
                        <button onClick={() => toggleExpand(entry.id)} className="text-slate-400 hover:text-blue-500">
                          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{entry.entryNumber}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{new Date(entry.date).toISOString().slice(0, 10)}</td>
                      <td className="px-4 py-3 text-sm text-slate-800 font-medium">{entry.description}</td>
                      <td className="px-4 py-3 text-sm text-slate-400">{entry.reference ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-blue-700">{fmt(totalD)} ج</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          entry.isAutomatic ? 'bg-slate-100 text-slate-500' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {entry.isAutomatic ? 'تلقائي' : 'يدوي'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {!entry.isAutomatic && (
                          <button onClick={() => setDeleteId(entry.id)}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {isOpen && (
                      <tr key={`${entry.id}-detail`} className="bg-slate-50/70 border-b border-slate-100">
                        <td colSpan={8} className="px-8 py-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-slate-500">
                                <th className="text-right pb-1.5 font-medium w-24">رقم الحساب</th>
                                <th className="text-right pb-1.5 font-medium">اسم الحساب</th>
                                <th className="text-right pb-1.5 font-medium">البيان</th>
                                <th className="text-right pb-1.5 font-medium w-28">مدين</th>
                                <th className="text-right pb-1.5 font-medium w-28">دائن</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.lines.map((line, idx) => (
                                <tr key={idx} className="border-t border-slate-100">
                                  <td className="py-1.5 font-mono text-slate-600">{line.accountCode}</td>
                                  <td className="py-1.5 text-slate-700 font-medium">{line.accountName ?? line.accountCode}</td>
                                  <td className="py-1.5 text-slate-400">{line.description ?? '—'}</td>
                                  <td className="py-1.5 font-mono font-semibold text-blue-700">
                                    {line.debit > 0 ? fmt(line.debit) : '—'}
                                  </td>
                                  <td className="py-1.5 font-mono font-semibold text-green-700">
                                    {line.credit > 0 ? fmt(line.credit) : '—'}
                                  </td>
                                </tr>
                              ))}
                              <tr className="border-t-2 border-slate-200 font-bold text-slate-700">
                                <td colSpan={3} className="py-1.5">الإجمالي</td>
                                <td className="py-1.5 font-mono text-blue-700">
                                  {fmt(entry.lines.reduce((s, l) => s + l.debit, 0))}
                                </td>
                                <td className="py-1.5 font-mono text-green-700">
                                  {fmt(entry.lines.reduce((s, l) => s + l.credit, 0))}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal إدخال قيد */}
      {showModal && (
        <Modal title="إضافة قيد يومي" onClose={() => setShowModal(false)} maxWidth="max-w-4xl">
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Field label="التاريخ">
                <input type="date" required value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="البيان">
                <input required value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="وصف القيد" className={inputCls} />
              </Field>
              <Field label="رقم المرجع (اختياري)">
                <input value={form.reference}
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                  placeholder="رقم فاتورة أو مستند" className={inputCls} />
              </Field>
            </div>

            {/* سطور القيد */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold text-slate-700">سطور القيد</p>
                <div className={`text-xs px-3 py-1 rounded-full font-medium ${
                  isBalanced ? 'bg-green-100 text-green-700' : totalDebit > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'
                }`}>
                  مدين: {fmt(totalDebit)} ج &nbsp;|&nbsp; دائن: {fmt(totalCredit)} ج
                  {isBalanced ? ' ✓ متوازن' : totalDebit > 0 ? ' — غير متوازن' : ''}
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 w-28">رقم الحساب</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">اسم الحساب</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">البيان</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 w-28">مدين</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-500 w-28">دائن</th>
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {form.lines.map((line, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="px-2 py-1.5">
                          <input
                            list={`accs-${idx}`}
                            value={line.accountCode}
                            onChange={e => updateLine(idx, 'accountCode', e.target.value)}
                            placeholder="كود"
                            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-full font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <datalist id={`accs-${idx}`}>
                            {accounts.filter(a => a.subType !== 'header' && a.isActive).map(a => (
                              <option key={a.code} value={a.code}>{a.name}</option>
                            ))}
                          </datalist>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={line.accountName}
                            onChange={e => updateLine(idx, 'accountName', e.target.value)}
                            placeholder="اسم الحساب"
                            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            value={line.description}
                            onChange={e => updateLine(idx, 'description', e.target.value)}
                            placeholder="بيان (اختياري)"
                            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0" step="0.01"
                            value={line.debit}
                            onChange={e => setDebit(idx, e.target.value)}
                            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-full font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number" min="0" step="0.01"
                            value={line.credit}
                            onChange={e => setCredit(idx, e.target.value)}
                            className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs w-full font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-1 py-1.5 text-center">
                          {form.lines.length > 2 && (
                            <button type="button" onClick={() => setForm(f => ({ ...f, lines: f.lines.filter((_, i) => i !== idx) }))}
                              className="p-1 text-red-400 hover:text-red-600">
                              <X size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <button type="button"
                onClick={() => setForm(f => ({ ...f, lines: [...f.lines, { ...EMPTY_LINE }] }))}
                className="mt-2 text-blue-600 text-xs hover:underline flex items-center gap-1">
                <Plus size={11} /> إضافة سطر
              </button>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={saving || !isBalanced}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                {saving ? 'جاري الحفظ...' : 'حفظ القيد'}
              </button>
              <button type="button" onClick={() => setShowModal(false)}
                className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium">
                إلغاء
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteId !== null && (
        <DeleteConfirm
          message="هل تريد حذف هذا القيد؟ القيود التلقائية المرتبطة بحركات بنكية لا يمكن حذفها من هنا."
          onConfirm={del}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
