import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, TableProperties, Users } from 'lucide-react'
import type { Table } from '../types'
import { Modal, Field, SaveCancelButtons, DeleteConfirm, inputCls } from '../components/ui'

const STATUS_CYCLE: Record<Table['status'], Table['status']> = {
  available: 'occupied',
  occupied:  'reserved',
  reserved:  'available',
}

const STATUS_STYLE: Record<Table['status'], string> = {
  available: 'bg-green-50 border-2 border-green-300 text-green-800',
  occupied:  'bg-red-50  border-2 border-red-300   text-red-800',
  reserved:  'bg-amber-50 border-2 border-amber-300 text-amber-800',
}

const STATUS_LABEL: Record<Table['status'], string> = {
  available: 'متاح',
  occupied:  'مشغول',
  reserved:  'محجوز',
}

const STATUS_DOT: Record<Table['status'], string> = {
  available: 'bg-green-400',
  occupied:  'bg-red-400',
  reserved:  'bg-amber-400',
}

const emptyForm = { number: '', capacity: 4, zone: '', note: '' }

export default function TablesPage() {
  const [tables,   setTables]   = useState<Table[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState<{ table?: Table } | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form,     setForm]     = useState(emptyForm)
  const [saving,   setSaving]   = useState(false)
  const [zoneFilter, setZoneFilter] = useState('')

  const load = async () => {
    setLoading(true)
    setTables(await window.api.tables.getAll())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openAdd = () => { setForm(emptyForm); setModal({}) }
  const openEdit = (t: Table) => {
    setForm({ number: t.number, capacity: t.capacity, zone: t.zone ?? '', note: t.note ?? '' })
    setModal({ table: t })
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const payload = { ...form, capacity: +form.capacity, zone: form.zone || null, note: form.note || null }
      if (modal?.table) await window.api.tables.update({ id: modal.table.id, ...payload })
      else              await window.api.tables.create(payload)
      setModal(null)
      load()
    } finally { setSaving(false) }
  }

  const cycleStatus = async (table: Table) => {
    await window.api.tables.updateStatus({ id: table.id, status: STATUS_CYCLE[table.status] })
    setTables(prev => prev.map(t => t.id === table.id ? { ...t, status: STATUS_CYCLE[table.status] } : t))
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await window.api.tables.delete(deleteId)
    setDeleteId(null)
    load()
  }

  const zones = [...new Set(tables.map(t => t.zone).filter(Boolean))] as string[]
  const filtered = zoneFilter ? tables.filter(t => t.zone === zoneFilter) : tables

  const counts = {
    available: tables.filter(t => t.status === 'available').length,
    occupied:  tables.filter(t => t.status === 'occupied').length,
    reserved:  tables.filter(t => t.status === 'reserved').length,
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TableProperties size={22} /> إدارة الطاولات
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">{tables.length} طاولة مسجلة</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 text-sm font-medium">
          <Plus size={16} /> إضافة طاولة
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {(['available', 'occupied', 'reserved'] as const).map(s => (
          <div key={s} className={`rounded-xl p-4 ${STATUS_STYLE[s].replace('border-2', 'border')}`}>
            <div className="text-2xl font-bold">{counts[s]}</div>
            <div className="text-sm mt-0.5">{STATUS_LABEL[s]}</div>
          </div>
        ))}
      </div>

      {/* Zone Filter */}
      {zones.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={() => setZoneFilter('')}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !zoneFilter ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}>
            الكل ({tables.length})
          </button>
          {zones.map(z => (
            <button key={z} onClick={() => setZoneFilter(z)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                zoneFilter === z ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {z} ({tables.filter(t => t.zone === z).length})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="text-center text-slate-400 py-16">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <TableProperties size={48} className="mx-auto mb-3 text-slate-200" />
          <p>لا توجد طاولات — ابدأ بإضافة طاولة</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {filtered.map(table => (
            <div key={table.id}
              className={`rounded-2xl p-4 cursor-pointer select-none transition-all hover:shadow-md ${STATUS_STYLE[table.status]}`}
              onClick={() => cycleStatus(table)}>
              <div className="text-center mb-2">
                <div className="text-3xl font-bold leading-none">{table.number}</div>
                {table.zone && (
                  <div className="text-xs mt-1 opacity-60 truncate">{table.zone}</div>
                )}
              </div>
              <div className="flex items-center justify-center gap-1 text-xs mb-2">
                <Users size={10} className="opacity-60" />
                <span className="opacity-70">{table.capacity}</span>
              </div>
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[table.status]}`} />
                <span className="text-xs font-semibold">{STATUS_LABEL[table.status]}</span>
              </div>
              <div className="flex justify-center gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => openEdit(table)}
                  className="p-1.5 rounded-lg hover:bg-white/60 transition-colors">
                  <Edit2 size={11} />
                </button>
                <button onClick={() => setDeleteId(table.id)}
                  className="p-1.5 rounded-lg hover:bg-white/60 transition-colors">
                  <Trash2 size={11} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-400 mt-4 text-center">
        اضغط على الطاولة لتغيير حالتها: متاح ← مشغول ← محجوز
      </p>

      {modal && (
        <Modal title={modal.table ? 'تعديل الطاولة' : 'إضافة طاولة'} onClose={() => setModal(null)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="رقم / اسم الطاولة *">
                <input required value={form.number}
                  onChange={e => setForm(f => ({ ...f, number: e.target.value }))}
                  className={inputCls} placeholder="1، 2، VIP-1..." />
              </Field>
              <Field label="السعة (عدد الأشخاص)">
                <input type="number" min="1" max="100" value={form.capacity}
                  onChange={e => setForm(f => ({ ...f, capacity: +e.target.value }))}
                  className={inputCls} />
              </Field>
            </div>
            <Field label="القسم / المنطقة">
              <input value={form.zone}
                onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
                className={inputCls} placeholder="داخلي، خارجي، VIP..." />
            </Field>
            <Field label="ملاحظة">
              <input value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className={inputCls} placeholder="أي ملاحظة اختيارية..." />
            </Field>
            <SaveCancelButtons saving={saving} onCancel={() => setModal(null)} />
          </form>
        </Modal>
      )}

      {deleteId !== null && (
        <DeleteConfirm
          message="سيتم حذف الطاولة نهائياً."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
