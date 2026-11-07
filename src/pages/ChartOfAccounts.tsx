import { useState, useEffect, useMemo } from 'react'
import { Plus, Edit2, Trash2, Search, BookOpen, ChevronRight, ChevronDown, Layers } from 'lucide-react'
import type { ChartOfAccount } from '../types'
import { inputCls, Modal, Field, DeleteConfirm, SaveCancelButtons } from '../components/ui'

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  asset:     { label: 'أصول',         color: 'bg-blue-100 text-blue-700' },
  liability: { label: 'خصوم',         color: 'bg-red-100 text-red-700' },
  equity:    { label: 'حقوق ملكية',   color: 'bg-purple-100 text-purple-700' },
  revenue:   { label: 'إيرادات',      color: 'bg-green-100 text-green-700' },
  expense:   { label: 'مصاريف',       color: 'bg-orange-100 text-orange-700' },
}

const SUBTYPE_LABELS: Record<string, string> = {
  header:               'رأس مجموعة',
  current_asset:        'أصول متداولة',
  fixed_asset:          'أصول ثابتة',
  current_liability:    'خصوم متداولة',
  long_term_liability:  'خصوم طويلة الأجل',
  equity:               'حقوق ملكية',
  revenue:              'إيرادات',
  contra_revenue:       'مقابل إيرادات',
  cogs:                 'تكلفة المبيعات',
  operating:            'تشغيلية',
}

const EMPTY_FORM = {
  code: '', name: '', type: 'expense' as ChartOfAccount['type'],
  subType: 'operating', parentCode: '', notes: '',
}

function AccountRow({
  account, depth, children, onEdit, onDelete,
}: {
  account: ChartOfAccount
  depth: number
  children?: React.ReactNode
  onEdit: (a: ChartOfAccount) => void
  onDelete: (id: number) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const hasChildren = !!children

  return (
    <>
      <tr className={`hover:bg-slate-50 border-b border-slate-50 ${account.subType === 'header' ? 'bg-slate-50/60' : ''}`}>
        <td className="px-3 py-2">
          <div className="flex items-center" style={{ paddingRight: depth * 20 }}>
            {hasChildren ? (
              <button onClick={() => setOpen(o => !o)} className="p-0.5 text-slate-400 hover:text-slate-600 ml-1">
                {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </button>
            ) : (
              <span className="w-5 ml-1" />
            )}
            <span className={`font-mono text-sm ${account.subType === 'header' ? 'font-bold text-slate-700' : 'text-slate-500'}`}>
              {account.code}
            </span>
          </div>
        </td>
        <td className="px-3 py-2">
          <span className={`text-sm ${account.subType === 'header' ? 'font-semibold text-slate-800' : 'text-slate-700'}`}>
            {account.name}
          </span>
        </td>
        <td className="px-3 py-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_LABELS[account.type]?.color ?? ''}`}>
            {TYPE_LABELS[account.type]?.label}
          </span>
        </td>
        <td className="px-3 py-2 text-xs text-slate-400">
          {SUBTYPE_LABELS[account.subType ?? ''] ?? account.subType}
        </td>
        <td className="px-3 py-2">
          <span className={`text-xs px-1.5 py-0.5 rounded ${account.isActive ? 'bg-green-50 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
            {account.isActive ? 'نشط' : 'معطل'}
          </span>
        </td>
        <td className="px-3 py-2">
          <div className="flex gap-1 justify-end">
            <button onClick={() => onEdit(account)} className="p-1.5 text-blue-400 hover:bg-blue-50 rounded-lg">
              <Edit2 size={13} />
            </button>
            <button onClick={() => onDelete(account.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
              <Trash2 size={13} />
            </button>
          </div>
        </td>
      </tr>
      {open && children}
    </>
  )
}

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState<ChartOfAccount[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filterType, setFilterType] = useState('all')
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<ChartOfAccount | null>(null)
  const [deleteId, setDeleteId]     = useState<number | null>(null)
  const [form, setForm]             = useState({ ...EMPTY_FORM })
  const [saving, setSaving]         = useState(false)
  const [seeding, setSeeding]       = useState(false)

  async function load() {
    setLoading(true)
    setAccounts(await window.api.accounts.getAll())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function seed() {
    setSeeding(true)
    const r = await window.api.accounts.seed()
    if (r.seeded) await load()
    else alert('دليل الحسابات محمّل مسبقاً')
    setSeeding(false)
  }

  function openAdd() {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  function openEdit(a: ChartOfAccount) {
    setEditing(a)
    setForm({
      code: a.code, name: a.name, type: a.type,
      subType: a.subType ?? 'operating',
      parentCode: a.parentCode ?? '',
      notes: a.notes ?? '',
    })
    setShowModal(true)
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault()
    setSaving(true)
    try {
      const data = { ...form, parentCode: form.parentCode || null, subType: form.subType || null }
      if (editing) await window.api.accounts.update({ id: editing.id, ...data })
      else         await window.api.accounts.create(data)
      setShowModal(false)
      load()
    } finally { setSaving(false) }
  }

  async function del() {
    if (!deleteId) return
    await window.api.accounts.delete(deleteId)
    setDeleteId(null)
    load()
  }

  async function suggestCode() {
    const next = await window.api.accounts.getNextCode(form.parentCode || null)
    setForm(f => ({ ...f, code: next }))
  }

  // بناء الشجرة
  const filtered = useMemo(() => {
    let list = accounts
    if (filterType !== 'all') list = list.filter(a => a.type === filterType)
    if (search) list = list.filter(a =>
      a.name.includes(search) || a.code.includes(search)
    )
    return list
  }, [accounts, filterType, search])

  // تجميع حسب الـ parent
  const byParent = useMemo(() => {
    const map = new Map<string | null, ChartOfAccount[]>()
    for (const a of filtered) {
      const key = a.parentCode ?? null
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(a)
    }
    return map
  }, [filtered])

  function renderChildren(parentCode: string | null, depth: number): React.ReactNode {
    const kids = byParent.get(parentCode) ?? []
    return kids.map(a => (
      <AccountRow key={a.id} account={a} depth={depth} onEdit={openEdit} onDelete={setDeleteId}>
        {byParent.has(a.code) ? renderChildren(a.code, depth + 1) : undefined}
      </AccountRow>
    ))
  }

  const isSearching = !!search || filterType !== 'all'

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">دليل الحسابات</h1>
          <p className="text-slate-400 text-sm mt-0.5">شجرة الحسابات المحاسبية مع الترميز الرقمي</p>
        </div>
        <div className="flex gap-2">
          {accounts.length === 0 && (
            <button onClick={seed} disabled={seeding}
              className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl hover:bg-purple-700 font-medium text-sm disabled:opacity-60">
              <Layers size={16} />
              {seeding ? 'جاري التحميل...' : 'تحميل الدليل الافتراضي'}
            </button>
          )}
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 font-medium text-sm">
            <Plus size={16} /> إضافة حساب
          </button>
        </div>
      </div>

      {/* إحصاءات سريعة */}
      <div className="grid grid-cols-5 gap-3 mb-4">
        {Object.entries(TYPE_LABELS).map(([type, { label, color }]) => {
          const count = accounts.filter(a => a.type === type).length
          return (
            <button key={type}
              onClick={() => setFilterType(f => f === type ? 'all' : type)}
              className={`rounded-xl p-3 text-center border-2 transition-all ${
                filterType === type ? 'border-blue-500 shadow-md' : 'border-transparent'
              } ${color.replace('text-', 'bg-').split(' ')[0].replace('bg-', 'bg-').replace('100', '50')}`}>
              <p className={`text-xl font-bold ${color.split(' ')[1]}`}>{count}</p>
              <p className="text-xs text-slate-500 mt-0.5">{label}</p>
            </button>
          )
        })}
      </div>

      {/* شريط البحث */}
      <div className="bg-white rounded-xl shadow-sm p-3 mb-4 flex gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute right-3 top-2.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو رقم الحساب..."
            className="w-full border border-slate-200 rounded-lg pr-8 pl-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">كل الأنواع</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* الجدول / الشجرة */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-12 text-slate-400">جاري التحميل...</div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-16">
            <BookOpen size={40} className="text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">دليل الحسابات فارغ</p>
            <p className="text-slate-400 text-sm mt-1">اضغط "تحميل الدليل الافتراضي" للبدء بدليل حسابات مطعم متكامل</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['رقم الحساب', 'اسم الحساب', 'النوع', 'التصنيف', 'الحالة', ''].map(h => (
                  <th key={h} className="text-right px-3 py-3 text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isSearching
                ? filtered.map(a => (
                    <AccountRow key={a.id} account={a} depth={0} onEdit={openEdit} onDelete={setDeleteId} />
                  ))
                : renderChildren(null, 0)
              }
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={6} className="px-3 py-2 text-xs text-slate-400">
                  إجمالي الحسابات: {accounts.length}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <Modal title={editing ? 'تعديل حساب' : 'إضافة حساب جديد'} onClose={() => setShowModal(false)}>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="رقم الحساب">
                <div className="flex gap-1.5">
                  <input required value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    placeholder="مثال: 6210" className={inputCls} />
                  {!editing && (
                    <button type="button" onClick={suggestCode}
                      title="اقتراح أول رقم متاح تحت هذا الحساب الأب"
                      className="px-3 rounded-xl border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 whitespace-nowrap flex-shrink-0">
                      ترقيم تلقائي
                    </button>
                  )}
                </div>
              </Field>
              <Field label="رقم الحساب الأب (اختياري)">
                <input value={form.parentCode}
                  onChange={e => setForm(f => ({ ...f, parentCode: e.target.value }))}
                  placeholder="مثال: 6200" className={inputCls} />
              </Field>
            </div>
            <Field label="اسم الحساب">
              <input required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="مثال: إيجار المحل" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="النوع الرئيسي">
                <select value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as any }))}
                  className={inputCls}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="التصنيف الفرعي">
                <select value={form.subType}
                  onChange={e => setForm(f => ({ ...f, subType: e.target.value }))}
                  className={inputCls}>
                  {Object.entries(SUBTYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="ملاحظات (اختياري)">
              <input value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className={inputCls} />
            </Field>
            <SaveCancelButtons saving={saving} onCancel={() => setShowModal(false)} />
          </form>
        </Modal>
      )}

      {deleteId !== null && (
        <DeleteConfirm message="هل تريد حذف هذا الحساب؟" onConfirm={del} onCancel={() => setDeleteId(null)} />
      )}
    </div>
  )
}
