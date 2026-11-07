import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, X, GitBranch, Warehouse as WarehouseIcon, Star, RefreshCw } from 'lucide-react'
import type { Branch, Warehouse } from '../types'
import { Field, inputCls, DeleteConfirm } from '../components/ui'

// ─── Branch CRUD ───────────────────────────────────────────
function BranchSection({
  branches, onCreated, onUpdated, onDeleted,
}: {
  branches: Branch[]
  onCreated: (b: Branch) => void
  onUpdated: (b: Branch) => void
  onDeleted: (id: number) => void
}) {
  const [form, setForm]       = useState({ name: '' })
  const [editing, setEditing] = useState<Branch | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [saving, setSaving]   = useState(false)

  const openCreate = () => { setEditing(null); setForm({ name: '' }) }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        const updated = await window.api.branches.update({ id: editing.id, name: form.name })
        onUpdated(updated)
      } else {
        const created = await window.api.branches.create({ name: form.name })
        onCreated(created)
      }
      setForm({ name: '' })
      setEditing(null)
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (deleteId == null) return
    try {
      await window.api.branches.delete(deleteId)
      onDeleted(deleteId)
    } catch (err: any) {
      alert(err.message || 'حدث خطأ')
    }
    setDeleteId(null)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <GitBranch size={17} className="text-blue-500" />
          <h2 className="font-bold text-slate-800">الفروع</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{branches.length}</span>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
          <Plus size={15} /> فرع جديد
        </button>
      </div>

      {/* Inline create form */}
      {editing === null && (
        <form onSubmit={handleSave} className="flex gap-3 px-5 py-3 border-b border-slate-50 bg-blue-50/40">
          <input
            required
            placeholder="اسم الفرع..."
            value={form.name}
            onChange={e => setForm({ name: e.target.value })}
            className={`${inputCls} flex-1`}
          />
          <button type="submit" disabled={saving || !form.name.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap">
            {saving ? '...' : 'إضافة'}
          </button>
        </form>
      )}

      <table className="w-full">
        <tbody className="divide-y divide-slate-50">
          {branches.length === 0 && (
            <tr><td colSpan={3} className="px-5 py-8 text-center text-slate-400 text-sm">لا توجد فروع</td></tr>
          )}
          {branches.map(branch => (
            <tr key={branch.id}>
              {editing?.id === branch.id ? (
                <td colSpan={3} className="px-5 py-2">
                  <form onSubmit={handleSave} className="flex gap-2">
                    <input required value={form.name}
                      onChange={e => setForm({ name: e.target.value })}
                      className={`${inputCls} flex-1`} autoFocus />
                    <button type="submit" disabled={saving}
                      className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-50">
                      {saving ? '...' : 'حفظ'}
                    </button>
                    <button type="button" onClick={() => setEditing(null)}
                      className="px-3 py-1.5 bg-slate-100 rounded-lg text-sm">إلغاء</button>
                  </form>
                </td>
              ) : (
                <>
                  <td className="px-5 py-3 font-medium text-slate-800">
                    {branch.name}
                    {branch.isDefault && (
                      <span className="mr-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">افتراضي</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-400 text-sm">{branch.warehouses?.length ?? 0} مخزن</td>
                  <td className="px-5 py-3 text-left">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => { setEditing(branch); setForm({ name: branch.name }) }}
                        className="p-1.5 text-slate-300 hover:text-blue-500 rounded-lg transition-colors">
                        <Pencil size={14} />
                      </button>
                      {!branch.isDefault && (
                        <button onClick={() => setDeleteId(branch.id)}
                          className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-colors">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {deleteId != null && (
        <DeleteConfirm
          message="سيتم حذف الفرع وكل مخازنه. هل أنت متأكد؟"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}

// ─── Warehouse CRUD ────────────────────────────────────────
function WarehouseSection({
  warehouses, branches, onReload,
}: {
  warehouses: Warehouse[]
  branches:   Branch[]
  onReload:   () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]         = useState({ name: '', branchId: '' })
  const [editing, setEditing]   = useState<Warehouse | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [syncing, setSyncing]   = useState<number | null>(null)
  const [saving, setSaving]     = useState(false)

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', branchId: String(branches[0]?.id ?? '') })
    setShowForm(true)
  }

  const openEdit = (w: Warehouse) => {
    setEditing(w)
    setForm({ name: w.name, branchId: String(w.branchId) })
    setShowForm(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing) {
        await window.api.warehouses.update({ id: editing.id, name: form.name })
      } else {
        await window.api.warehouses.create({ name: form.name, branchId: +form.branchId })
      }
      setShowForm(false)
      onReload()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (deleteId == null) return
    try {
      await window.api.warehouses.delete(deleteId)
      onReload()
    } catch (err: any) { alert(err.message || 'حدث خطأ') }
    setDeleteId(null)
  }

  const handleSetDefault = async (id: number) => {
    await window.api.warehouses.setDefault(id)
    onReload()
  }

  const handleSync = async (id: number) => {
    setSyncing(id)
    try {
      await window.api.warehouses.syncStock(id)
      onReload()
    } finally { setSyncing(null) }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <WarehouseIcon size={17} className="text-indigo-500" />
          <h2 className="font-bold text-slate-800">المخازن</h2>
          <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{warehouses.length}</span>
        </div>
        <button onClick={openCreate} disabled={branches.length === 0}
          className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-40">
          <Plus size={15} /> مخزن جديد
        </button>
      </div>

      <table className="w-full">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            {['المخزن', 'الفرع', 'عدد المواد', ''].map(h => (
              <th key={h} className="text-right px-5 py-2.5 text-xs font-semibold text-slate-500">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {warehouses.length === 0 && (
            <tr><td colSpan={4} className="px-5 py-8 text-center text-slate-400 text-sm">لا توجد مخازن</td></tr>
          )}
          {warehouses.map(wh => (
            <tr key={wh.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-3 font-medium text-slate-800">
                {wh.name}
                {wh.isDefault && (
                  <span className="mr-2 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">افتراضي</span>
                )}
              </td>
              <td className="px-5 py-3 text-slate-500 text-sm">{wh.branch?.name}</td>
              <td className="px-5 py-3 text-slate-500 text-sm">{wh.stocks?.length ?? 0} مادة</td>
              <td className="px-5 py-3">
                <div className="flex items-center gap-1 justify-end">
                  <button
                    title="مزامنة أرصدة المخزون"
                    onClick={() => handleSync(wh.id)}
                    disabled={syncing === wh.id}
                    className="p-1.5 text-slate-300 hover:text-indigo-500 rounded-lg transition-colors">
                    <RefreshCw size={14} className={syncing === wh.id ? 'animate-spin' : ''} />
                  </button>
                  {!wh.isDefault && (
                    <button title="تعيين كافتراضي" onClick={() => handleSetDefault(wh.id)}
                      className="p-1.5 text-slate-300 hover:text-amber-500 rounded-lg transition-colors">
                      <Star size={14} />
                    </button>
                  )}
                  <button onClick={() => openEdit(wh)}
                    className="p-1.5 text-slate-300 hover:text-blue-500 rounded-lg transition-colors">
                    <Pencil size={14} />
                  </button>
                  {!wh.isDefault && (
                    <button onClick={() => setDeleteId(wh.id)}
                      className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-bold text-slate-800">{editing ? 'تعديل مخزن' : 'مخزن جديد'}</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <Field label="اسم المخزن *">
                <input required value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className={inputCls} placeholder="مثال: مخزن المطبخ" />
              </Field>
              {!editing && (
                <Field label="الفرع *">
                  <select value={form.branchId}
                    onChange={e => setForm(f => ({ ...f, branchId: e.target.value }))}
                    className={inputCls}>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </Field>
              )}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={saving || !form.name.trim()}
                  className="flex-1 bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                  {saving ? 'جاري الحفظ...' : 'حفظ'}
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
          message="سيتم حذف المخزن وكل أرصدته. هل أنت متأكد؟"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────
export default function BranchesPage() {
  const [branches,   setBranches]   = useState<Branch[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  const load = async () => {
    const [b, w] = await Promise.all([
      window.api.branches.getAll(),
      window.api.warehouses.getAll(),
    ])
    setBranches(b)
    setWarehouses(w)
  }

  useEffect(() => {
    window.api.warehouses.init().then(load)
  }, [])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">الفروع والمخازن</h1>
        <p className="text-slate-400 text-sm mt-0.5">إدارة فروع المطعم ومخازن المواد الخام</p>
      </div>

      <BranchSection
        branches={branches}
        onCreated={b => setBranches(prev => [...prev, b])}
        onUpdated={b => setBranches(prev => prev.map(x => x.id === b.id ? b : x))}
        onDeleted={id => { setBranches(prev => prev.filter(x => x.id !== id)); load() }}
      />

      <WarehouseSection
        warehouses={warehouses}
        branches={branches}
        onReload={load}
      />

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 text-sm text-blue-700">
        <p className="font-semibold mb-1">زر المزامنة <RefreshCw size={13} className="inline" /></p>
        <p className="text-blue-500">يقوم بمزامنة أرصدة المخزن مع الرصيد الكلي للمواد — استخدمه عند إنشاء مخزن جديد أو بعد جرد المخزون.</p>
      </div>
    </div>
  )
}
