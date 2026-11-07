import { useEffect, useState } from 'react'
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight,
  Percent, DollarSign, Calendar, FileText, Package, X, Save,
} from 'lucide-react'
import type { DeliveryPartner, DeliveryProductPrice, Product } from '../types'
import { Modal, Field, SaveCancelButtons, DeleteConfirm, inputCls } from '../components/ui'

const emptyForm = {
  name: '',
  commissionType: 'percentage' as 'percentage' | 'fixed',
  commission: 0,
  contractStart: '',
  contractEnd: '',
  contractNotes: '',
  isActive: true,
}

// ─── Partner Form Modal ────────────────────────────────────────────────────────
function PartnerModal({
  initial, onSave, onClose,
}: { initial?: DeliveryPartner; onSave: () => void; onClose: () => void }) {
  const [form, setForm] = useState(
    initial
      ? {
          name:           initial.name,
          commissionType: initial.commissionType as 'percentage' | 'fixed',
          commission:     initial.commission,
          contractStart:  initial.contractStart ?? '',
          contractEnd:    initial.contractEnd   ?? '',
          contractNotes:  initial.contractNotes ?? '',
          isActive:       initial.isActive,
        }
      : { ...emptyForm }
  )
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return setError('اسم الشركة مطلوب')
    setSaving(true)
    try {
      if (initial) await window.api.delivery.update({ id: initial.id, ...form })
      else         await window.api.delivery.create(form)
      onSave()
    } catch (e: any) { setError(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <Modal title={initial ? 'تعديل شركة التوصيل' : 'إضافة شركة توصيل'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">{error}</div>}

        <Field label="اسم الشركة *">
          <input required value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className={inputCls} placeholder="طلبات، أوتو، كريم فوود..." />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="نوع العمولة">
            <select value={form.commissionType}
              onChange={e => setForm(f => ({ ...f, commissionType: e.target.value as 'percentage' | 'fixed' }))}
              className={inputCls}>
              <option value="percentage">نسبة مئوية (%)</option>
              <option value="fixed">مبلغ ثابت (ج)</option>
            </select>
          </Field>
          <Field label={`العمولة (${form.commissionType === 'percentage' ? '%' : 'ج'})`}>
            <input type="number" min="0" step="0.01" value={form.commission}
              onChange={e => setForm(f => ({ ...f, commission: +e.target.value }))}
              className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="بداية العقد">
            <input type="date" value={form.contractStart}
              onChange={e => setForm(f => ({ ...f, contractStart: e.target.value }))}
              className={inputCls} />
          </Field>
          <Field label="نهاية العقد">
            <input type="date" value={form.contractEnd}
              onChange={e => setForm(f => ({ ...f, contractEnd: e.target.value }))}
              className={inputCls} />
          </Field>
        </div>

        <Field label="بنود العقد / ملاحظات">
          <textarea value={form.contractNotes} rows={3}
            onChange={e => setForm(f => ({ ...f, contractNotes: e.target.value }))}
            className={`${inputCls} resize-none`}
            placeholder="نسبة العمولة، شروط الدفع، الحد الأدنى للطلب، أوقات التسليم..." />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={form.isActive}
            onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
            className="w-4 h-4 text-blue-600 rounded" />
          <span className="text-sm text-slate-700">شركة نشطة (تظهر في نقطة البيع)</span>
        </label>

        <SaveCancelButtons saving={saving} onCancel={onClose} />
      </form>
    </Modal>
  )
}

// ─── Pricing Modal ─────────────────────────────────────────────────────────────
function PricingModal({
  partner, products, onClose,
}: { partner: DeliveryPartner; products: Product[]; onClose: () => void }) {
  const [prices, setPrices] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    window.api.delivery.getPrices(partner.id).then(list => {
      const map: Record<number, string> = {}
      list.forEach(p => { map[p.productId] = String(p.price) })
      setPrices(map)
    })
  }, [partner.id])

  const handleSave = async () => {
    setSaving(true)
    try {
      for (const product of products) {
        const val = prices[product.id]
        if (val === undefined || val === '') {
          await window.api.delivery.removePrice({ partnerId: partner.id, productId: product.id })
        } else {
          const price = parseFloat(val)
          if (!isNaN(price) && price >= 0) {
            await window.api.delivery.setPrice({ partnerId: partner.id, productId: product.id, price })
          }
        }
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const filtered = products.filter(p => p.isActive && (!search || p.name.includes(search)))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl my-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-800">أسعار {partner.name}</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              اتركها فارغة لاستخدام السعر الافتراضي — أدخل سعراً مختلفاً لتخصيص منيو هذه الشركة
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"><X size={18} /></button>
        </div>

        <div className="px-6 pt-4 pb-2">
          <div className="relative">
            <Package size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث عن وجبة..."
              className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto px-6 py-2">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-slate-400 text-xs border-b border-slate-100">
                <th className="text-right py-2 font-semibold">الوجبة</th>
                <th className="text-right py-2 font-semibold w-28">سعر المطعم</th>
                <th className="text-right py-2 font-semibold w-36">سعر {partner.name}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(product => {
                const custom = prices[product.id]
                const hasCustom = custom !== undefined && custom !== ''
                return (
                  <tr key={product.id} className={hasCustom ? 'bg-blue-50/50' : ''}>
                    <td className="py-2 text-slate-700">{product.name}
                      {product.category && (
                        <span className="mr-1.5 text-xs text-slate-400">({product.category})</span>
                      )}
                    </td>
                    <td className="py-2 font-mono text-slate-500">{product.price.toFixed(2)} ج</td>
                    <td className="py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min="0" step="0.01"
                          value={prices[product.id] ?? ''}
                          onChange={e => setPrices(prev => ({ ...prev, [product.id]: e.target.value }))}
                          placeholder={product.price.toFixed(2)}
                          className="border border-slate-200 rounded-lg px-2 py-1 text-sm w-24 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {hasCustom && (
                          <button onClick={() => setPrices(prev => { const n = { ...prev }; delete n[product.id]; return n })}
                            className="text-slate-300 hover:text-red-500 p-0.5" title="إزالة السعر المخصص">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            {Object.values(prices).filter(v => v !== '').length} وجبة بسعر مخصص
          </p>
          <div className="flex gap-2">
            {saved && <span className="text-green-600 text-sm flex items-center gap-1"><Save size={13} /> تم الحفظ</span>}
            <button onClick={onClose}
              className="px-4 py-2 border border-slate-200 rounded-xl text-slate-600 text-sm hover:bg-slate-50">
              إغلاق
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5">
              <Save size={14} /> {saving ? 'جاري الحفظ...' : 'حفظ الأسعار'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function DeliveryPartnersPage() {
  const [partners,  setPartners]  = useState<DeliveryPartner[]>([])
  const [products,  setProducts]  = useState<Product[]>([])
  const [modal,     setModal]     = useState<{ partner?: DeliveryPartner } | null>(null)
  const [pricing,   setPricing]   = useState<DeliveryPartner | null>(null)
  const [deleteId,  setDeleteId]  = useState<number | null>(null)

  const load = async () => {
    const [p, pr] = await Promise.all([window.api.delivery.getAll(), window.api.products.getAll()])
    setPartners(p)
    setProducts(pr)
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (id: number) => {
    const updated = await window.api.delivery.toggle(id)
    setPartners(prev => prev.map(p => p.id === id ? updated : p))
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await window.api.delivery.delete(deleteId)
    setDeleteId(null)
    load()
  }

  const isExpiring = (p: DeliveryPartner) => {
    if (!p.contractEnd) return false
    const end = new Date(p.contractEnd)
    const diff = (end.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 30
  }
  const isExpired = (p: DeliveryPartner) => {
    if (!p.contractEnd) return false
    return new Date(p.contractEnd) < new Date()
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">شركات التوصيل</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {partners.filter(p => p.isActive).length} شركة نشطة
          </p>
        </div>
        <button onClick={() => setModal({})}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 text-sm font-medium">
          <Plus size={16} /> إضافة شركة
        </button>
      </div>

      {partners.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl shadow-sm text-slate-400">
          <DollarSign size={48} className="mx-auto mb-3 opacity-20" />
          <p>لا توجد شركات توصيل — ابدأ بإضافة أول شركة</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {partners.map(partner => {
            const expired  = isExpired(partner)
            const expiring = isExpiring(partner)
            const priceCount = partner.prices?.length ?? 0

            return (
              <div key={partner.id} className={`bg-white rounded-2xl shadow-sm p-5 border ${
                !partner.isActive ? 'opacity-60 border-slate-200' : 'border-transparent'
              }`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      partner.isActive ? 'bg-blue-100' : 'bg-slate-100'
                    }`}>
                      {partner.commissionType === 'percentage'
                        ? <Percent size={22} className={partner.isActive ? 'text-blue-600' : 'text-slate-400'} />
                        : <DollarSign size={22} className={partner.isActive ? 'text-blue-600' : 'text-slate-400'} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name + badges */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-bold text-slate-800 text-base">{partner.name}</h3>
                        {!partner.isActive && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">موقوف</span>
                        )}
                        {expired && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">العقد منتهي</span>
                        )}
                        {expiring && !expired && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">العقد ينتهي قريباً</span>
                        )}
                      </div>

                      {/* Commission */}
                      <p className="text-sm text-slate-600 mb-2">
                        <span className="font-semibold text-blue-600">
                          عمولة {partner.commission}{partner.commissionType === 'percentage' ? '%' : ' ج'}
                        </span>
                        {partner.commissionType === 'percentage' && (
                          <span className="text-slate-400 mr-1.5 text-xs">من كل طلب</span>
                        )}
                      </p>

                      {/* Contract dates */}
                      {(partner.contractStart || partner.contractEnd) && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                          <Calendar size={11} />
                          {partner.contractStart && (
                            <span>من {new Date(partner.contractStart).toLocaleDateString('ar-EG')}</span>
                          )}
                          {partner.contractEnd && (
                            <span className={expired ? 'text-red-500 font-medium' : expiring ? 'text-amber-500 font-medium' : ''}>
                              حتى {new Date(partner.contractEnd).toLocaleDateString('ar-EG')}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Contract notes */}
                      {partner.contractNotes && (
                        <div className="flex items-start gap-1.5 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2 mb-2">
                          <FileText size={11} className="mt-0.5 flex-shrink-0 text-slate-400" />
                          <span className="whitespace-pre-wrap">{partner.contractNotes}</span>
                        </div>
                      )}

                      {/* Prices badge */}
                      <button onClick={() => setPricing(partner)}
                        className="inline-flex items-center gap-1.5 text-xs bg-purple-50 text-purple-700 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors font-medium">
                        <Package size={11} />
                        {priceCount > 0 ? `${priceCount} وجبة بسعر مخصص` : 'لا توجد أسعار مخصصة'}
                        <span className="text-purple-400">— إدارة الأسعار</span>
                      </button>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleToggle(partner.id)}
                      title={partner.isActive ? 'إيقاف' : 'تفعيل'}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      {partner.isActive
                        ? <ToggleRight size={20} className="text-blue-500" />
                        : <ToggleLeft size={20} />}
                    </button>
                    <button onClick={() => setModal({ partner })}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => setDeleteId(partner.id)}
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
        <PartnerModal
          initial={modal.partner}
          onSave={() => { setModal(null); load() }}
          onClose={() => setModal(null)}
        />
      )}

      {pricing && (
        <PricingModal
          partner={pricing}
          products={products}
          onClose={() => { setPricing(null); load() }}
        />
      )}

      {deleteId !== null && (
        <DeleteConfirm
          message="سيتم حذف شركة التوصيل وجميع أسعارها المخصصة."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
