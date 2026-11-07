import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Tag, ToggleLeft, ToggleRight, Calendar, Percent, DollarSign } from 'lucide-react'
import type { Promotion, Product } from '../types'
import { Modal, Field, SaveCancelButtons, DeleteConfirm, inputCls } from '../components/ui'

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const emptyForm = {
  name: '', discountType: 'percentage' as 'percentage' | 'fixed',
  discountValue: 10, startDate: todayStr(), endDate: todayStr(),
  isActive: true, applyToAll: false, productIds: [] as number[],
}

function PromotionModal({
  initial, products, onSave, onClose,
}: { initial?: Promotion; products: Product[]; onSave: () => void; onClose: () => void }) {
  const isEdit = !!initial
  const [form, setForm] = useState<typeof emptyForm>(
    initial
      ? {
          name: initial.name,
          discountType: initial.discountType as 'percentage' | 'fixed',
          discountValue: initial.discountValue,
          startDate: new Date(initial.startDate).toISOString().slice(0, 10),
          endDate: new Date(initial.endDate).toISOString().slice(0, 10),
          isActive: initial.isActive,
          applyToAll: initial.applyToAll,
          productIds: initial.products.map(p => p.productId),
        }
      : { ...emptyForm }
  )
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  function toggleProduct(id: number) {
    setForm(f => ({
      ...f,
      productIds: f.productIds.includes(id)
        ? f.productIds.filter(p => p !== id)
        : [...f.productIds, id],
    }))
  }

  async function save() {
    if (!form.name.trim())    return setError('اسم العرض مطلوب')
    if (form.discountValue <= 0) return setError('قيمة الخصم يجب أن تكون أكبر من صفر')
    if (!form.applyToAll && form.productIds.length === 0)
      return setError('اختر منتجاً واحداً على الأقل أو فعّل "جميع المنتجات"')
    if (form.startDate > form.endDate) return setError('تاريخ البداية يجب أن يكون قبل نهاية العرض')
    setSaving(true)
    try {
      const payload = { ...form, name: form.name.trim() }
      if (isEdit) await window.api.promotions.update({ id: initial!.id, ...payload })
      else        await window.api.promotions.create(payload)
      onSave()
    } catch (e: any) { setError(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-6"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl my-auto">
        <h2 className="text-lg font-bold text-slate-800 mb-5">{isEdit ? 'تعديل العرض' : 'عرض جديد'}</h2>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}

        <div className="space-y-4">
          <Field label="اسم العرض *">
            <input value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setError('') }}
              className={inputCls} placeholder="عرض رمضان، العشاء المخفض..." />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="نوع الخصم">
              <select value={form.discountType}
                onChange={e => setForm(f => ({ ...f, discountType: e.target.value as 'percentage' | 'fixed' }))}
                className={inputCls}>
                <option value="percentage">نسبة مئوية (%)</option>
                <option value="fixed">مبلغ ثابت (ج)</option>
              </select>
            </Field>
            <Field label={`قيمة الخصم (${form.discountType === 'percentage' ? '%' : 'ج'})`}>
              <input type="number" min="0.01" step="0.01"
                value={form.discountValue}
                onChange={e => setForm(f => ({ ...f, discountValue: +e.target.value }))}
                className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="تاريخ البداية">
              <input type="date" value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className={inputCls} />
            </Field>
            <Field label="تاريخ الانتهاء">
              <input type="date" value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className={inputCls} />
            </Field>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <span className="text-sm font-medium text-slate-700">جميع المنتجات</span>
            <button onClick={() => setForm(f => ({ ...f, applyToAll: !f.applyToAll }))}
              className="text-blue-600">
              {form.applyToAll ? <ToggleRight size={24} /> : <ToggleLeft size={24} className="text-slate-300" />}
            </button>
          </div>

          {!form.applyToAll && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-2">
                اختر المنتجات
                {form.productIds.length > 0 && (
                  <span className="mr-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                    {form.productIds.length} محدد
                  </span>
                )}
              </label>
              <div className="border border-slate-200 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1">
                {products.filter(p => p.isActive).map(p => (
                  <label key={p.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                    <input type="checkbox" checked={form.productIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                      className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm text-slate-700">{p.name}</span>
                    <span className="text-xs text-slate-400 mr-auto">{p.price.toFixed(2)} ج</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
            <span className="text-sm font-medium text-slate-700">العرض فعّال</span>
            <button onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}>
              {form.isActive ? <ToggleRight size={24} className="text-blue-600" /> : <ToggleLeft size={24} className="text-slate-300" />}
            </button>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={save} disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 font-semibold hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button onClick={onClose}
            className="flex-1 border border-slate-300 text-slate-700 rounded-xl py-2.5 font-semibold hover:bg-slate-50">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PromotionsPage() {
  const [promos,   setPromos]   = useState<Promotion[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState<{ promo?: Promotion } | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    const [p, pr] = await Promise.all([window.api.promotions.getAll(), window.api.products.getAll()])
    setPromos(p)
    setProducts(pr)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (id: number) => {
    const updated = await window.api.promotions.toggle(id)
    setPromos(prev => prev.map(p => p.id === id ? updated : p))
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await window.api.promotions.delete(deleteId)
    setDeleteId(null)
    load()
  }

  const now = new Date()
  const isExpired = (p: Promotion) => new Date(p.endDate) < now
  const isUpcoming = (p: Promotion) => new Date(p.startDate) > now

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Tag size={22} /> العروض والخصومات
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {promos.filter(p => p.isActive && !isExpired(p)).length} عرض نشط
          </p>
        </div>
        <button onClick={() => setModal({})}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 text-sm font-medium">
          <Plus size={16} /> إضافة عرض
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-16">جاري التحميل...</div>
      ) : promos.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl shadow-sm">
          <Tag size={48} className="mx-auto mb-3 text-slate-200" />
          <p>لا توجد عروض — ابدأ بإضافة عرض جديد</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {promos.map(promo => {
            const expired  = isExpired(promo)
            const upcoming = isUpcoming(promo)
            const active   = promo.isActive && !expired && !upcoming
            return (
              <div key={promo.id} className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      active ? 'bg-green-100' : 'bg-slate-100'
                    }`}>
                      {promo.discountType === 'percentage'
                        ? <Percent size={20} className={active ? 'text-green-600' : 'text-slate-400'} />
                        : <DollarSign size={20} className={active ? 'text-green-600' : 'text-slate-400'} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-slate-800">{promo.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          active    ? 'bg-green-100 text-green-700' :
                          upcoming  ? 'bg-blue-100 text-blue-700' :
                          expired   ? 'bg-slate-100 text-slate-500' :
                          'bg-slate-100 text-slate-500'
                        }`}>
                          {active ? 'نشط' : upcoming ? 'قريباً' : expired ? 'منتهي' : 'موقوف'}
                        </span>
                        <span className="text-sm font-bold text-blue-600">
                          {promo.discountType === 'percentage' ? `${promo.discountValue}%` : `${promo.discountValue} ج`} خصم
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
                        <Calendar size={11} />
                        <span>{new Date(promo.startDate).toLocaleDateString('ar-EG')} — {new Date(promo.endDate).toLocaleDateString('ar-EG')}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {promo.applyToAll ? (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">جميع المنتجات</span>
                        ) : (
                          promo.products.map(pp => (
                            <span key={pp.id} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                              {pp.product.name}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleToggle(promo.id)}
                      title={promo.isActive ? 'إيقاف' : 'تفعيل'}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      {promo.isActive ? <ToggleRight size={18} className="text-blue-500" /> : <ToggleLeft size={18} />}
                    </button>
                    <button onClick={() => setModal({ promo })}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => setDeleteId(promo.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal && (
        <PromotionModal
          initial={modal.promo}
          products={products}
          onSave={() => { setModal(null); load() }}
          onClose={() => setModal(null)}
        />
      )}

      {deleteId !== null && (
        <DeleteConfirm
          message="سيتم حذف العرض نهائياً."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
