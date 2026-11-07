import { useEffect, useState } from 'react'
import { Plus, Edit2, Trash2, Search, Phone, MapPin } from 'lucide-react'
import type { Supplier } from '../types'
import { Modal, Field, DeleteConfirm, SaveCancelButtons, inputCls } from '../components/ui'

const emptyForm = { name: '', phone: '', address: '' }

export default function Suppliers() {
  const [items, setItems] = useState<Supplier[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Supplier | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = () => window.api.suppliers.getAll().then(setItems)
  useEffect(() => { load() }, [])

  const openAdd = () => { setEditItem(null); setForm(emptyForm); setShowModal(true) }
  const openEdit = (item: Supplier) => {
    setEditItem(item)
    setForm({ name: item.name, phone: item.phone || '', address: item.address || '' })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = { name: form.name, phone: form.phone || null, address: form.address || null }
      if (editItem) await window.api.suppliers.update({ id: editItem.id, ...data })
      else await window.api.suppliers.create(data)
      setShowModal(false)
      load()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await window.api.suppliers.delete(deleteId)
    setDeleteId(null)
    load()
  }

  const filtered = items.filter(i =>
    i.name.includes(search) || (i.phone || '').includes(search)
  )

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الموردين</h1>
          <p className="text-slate-400 text-sm mt-0.5">{items.length} مورد مسجل</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus size={16} /> إضافة مورد
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الهاتف..."
          className="w-full pr-9 pl-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Cards Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center shadow-sm">
          <p className="text-slate-400 text-sm">
            {search ? 'لا توجد نتائج' : 'لا يوجد موردين — ابدأ بإضافة أول مورد'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(item => (
            <div key={item.id} className="bg-white rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold text-lg flex-shrink-0">
                  {item.name.charAt(0)}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(item)}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteId(item.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-slate-800 mb-2">{item.name}</h3>
              {item.phone && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm mb-1">
                  <Phone size={12} />
                  <span dir="ltr">{item.phone}</span>
                </div>
              )}
              {item.address && (
                <div className="flex items-center gap-1.5 text-slate-500 text-sm">
                  <MapPin size={12} />
                  <span className="truncate">{item.address}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editItem ? 'تعديل المورد' : 'إضافة مورد'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="اسم المورد *">
              <input required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inputCls} placeholder="مثال: شركة الأهرام للتوريدات" />
            </Field>
            <Field label="رقم الهاتف">
              <input value={form.phone} dir="ltr"
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                className={inputCls} placeholder="01xxxxxxxxx" />
            </Field>
            <Field label="العنوان">
              <input value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className={inputCls} placeholder="العنوان التفصيلي" />
            </Field>
            <SaveCancelButtons saving={saving} onCancel={() => setShowModal(false)} />
          </form>
        </Modal>
      )}

      {deleteId && (
        <DeleteConfirm
          message="سيتم حذف بيانات المورد. الفواتير المرتبطة به لن تُحذف."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
