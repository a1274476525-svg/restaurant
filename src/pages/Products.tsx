import { useEffect, useState, useCallback } from 'react'
import { Plus, Edit2, Trash2, Search, Tag, CheckCircle, XCircle, Camera, X, TrendingUp, TrendingDown, Minus as MinusIcon } from 'lucide-react'
import type { Product, DeliveryPartner, DeliveryProductPrice } from '../types'
import { Modal, Field, DeleteConfirm, SaveCancelButtons, inputCls } from '../components/ui'

const CATEGORIES = ['فراخ', 'لحوم', 'مشروبات', 'حلويات', 'مقبلات', 'أطباق جانبية', 'بيتزا', 'ساندوتشات', 'أخرى']

const emptyForm = { name: '', price: 0, category: '', isActive: true }

function ProductImage({ imagePath, size = 32 }: { imagePath: string | null; size?: number }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!imagePath) { setSrc(null); return }
    window.api.products.getImageData(imagePath).then(setSrc)
  }, [imagePath])

  const style = { width: size, height: size }

  if (!src) return (
    <div style={style} className="bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
      <Camera size={Math.round(size * 0.4)} className="text-slate-300" />
    </div>
  )
  return <img src={src} style={style} className="rounded-lg object-cover flex-shrink-0" />
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcCost(product: Product) {
  return (product.recipes || []).reduce((sum, r) => sum + r.quantity * r.ingredient.costPerUnit, 0)
}

function MarginBadge({ price, cost }: { price: number; cost: number }) {
  if (cost === 0) return <span className="text-slate-300 text-sm">—</span>
  const profit = price - cost
  const margin = price > 0 ? (profit / price) * 100 : 0
  const color = margin >= 30 ? 'text-green-600' : margin >= 15 ? 'text-amber-500' : 'text-red-500'
  return <span className={`font-semibold text-sm ${color}`}>{margin.toFixed(1)}%</span>
}

function ProfitCell({ price, cost }: { price: number; cost: number }) {
  if (cost === 0) return <span className="text-slate-300 text-sm">—</span>
  const profit = price - cost
  return (
    <span className={`font-mono text-sm font-medium ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
      {profit.toFixed(2)} ج
    </span>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Products() {
  const [items,    setItems]    = useState<Product[]>([])
  const [search,   setSearch]   = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Product | null>(null)
  const [form,     setForm]     = useState(emptyForm)
  const [saving,   setSaving]   = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [imageLoading, setImageLoading] = useState<number | null>(null)

  // Delivery tabs
  const [partners,      setPartners]      = useState<DeliveryPartner[]>([])
  const [activeTab,     setActiveTab]     = useState<'restaurant' | number>('restaurant')
  const [deliveryPrices, setDeliveryPrices] = useState<Record<number, number>>({})
  const [dirtyPrices,   setDirtyPrices]   = useState<Record<number, string>>({})
  const [pricesLoading, setPricesLoading] = useState(false)

  const load = () => window.api.products.getAll().then(setItems)

  useEffect(() => {
    load()
    window.api.delivery.getAll().then((ps: DeliveryPartner[]) =>
      setPartners(ps.filter((p: DeliveryPartner) => p.isActive))
    )
  }, [])

  // Load delivery prices when partner tab selected
  useEffect(() => {
    if (activeTab === 'restaurant') {
      setDeliveryPrices({})
      setDirtyPrices({})
      return
    }
    setPricesLoading(true)
    window.api.delivery.getPrices(activeTab as number).then((list: DeliveryProductPrice[]) => {
      const map: Record<number, number> = {}
      list.forEach(p => { map[p.productId] = p.price })
      setDeliveryPrices(map)
      const dirty: Record<number, string> = {}
      list.forEach(p => { dirty[p.productId] = String(p.price) })
      setDirtyPrices(dirty)
      setPricesLoading(false)
    })
  }, [activeTab])

  // Save a single delivery price on blur
  const handlePriceBlur = useCallback(async (productId: number, defaultPrice: number) => {
    if (activeTab === 'restaurant') return
    const raw = dirtyPrices[productId] ?? ''
    const num = parseFloat(raw)

    if (raw === '' || isNaN(num)) {
      // Remove custom price → fallback to restaurant price
      await window.api.delivery.removePrice({ partnerId: activeTab as number, productId })
      setDeliveryPrices(prev => { const n = { ...prev }; delete n[productId]; return n })
      setDirtyPrices(prev => { const n = { ...prev }; delete n[productId]; return n })
    } else if (num !== deliveryPrices[productId]) {
      await window.api.delivery.setPrice({ partnerId: activeTab as number, productId, price: num })
      setDeliveryPrices(prev => ({ ...prev, [productId]: num }))
    }
  }, [activeTab, dirtyPrices, deliveryPrices])

  const openAdd  = () => { setEditItem(null); setForm(emptyForm); setShowModal(true) }
  const openEdit = (item: Product) => {
    setEditItem(item)
    setForm({ name: item.name, price: item.price, category: item.category || '', isActive: item.isActive })
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editItem) await window.api.products.update({ id: editItem.id, ...form })
      else          await window.api.products.create(form)
      setShowModal(false)
      load()
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    await window.api.products.delete(deleteId)
    setDeleteId(null)
    load()
  }

  const handleSelectImage = async (item: Product) => {
    setImageLoading(item.id)
    try {
      const path = await window.api.products.selectImage(item.id)
      if (path) load()
    } finally { setImageLoading(null) }
  }

  const handleRemoveImage = async (item: Product) => {
    await window.api.products.removeImage(item.id)
    load()
  }

  const filtered = items.filter(i => i.name.includes(search))

  const activePartner = typeof activeTab === 'number'
    ? partners.find(p => p.id === activeTab) ?? null
    : null

  return (
    <div className="p-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">الوجبات</h1>
          <p className="text-slate-400 text-sm mt-0.5">{items.length} وجبة مسجلة</p>
        </div>
        {activeTab === 'restaurant' && (
          <button onClick={openAdd}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
            <Plus size={16} /> إضافة وجبة
          </button>
        )}
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-xl p-1 w-fit flex-wrap">
        <button
          onClick={() => setActiveTab('restaurant')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'restaurant' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}>
          المطعم
        </button>
        {partners.map(p => (
          <button key={p.id}
            onClick={() => setActiveTab(p.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === p.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {p.name}
          </button>
        ))}
        {partners.length === 0 && (
          <span className="px-3 py-2 text-xs text-slate-400 italic">أضف شركات توصيل من صفحة التوصيل لتظهر هنا</span>
        )}
      </div>

      {/* ── Delivery partner info bar ───────────────────────────────────────── */}
      {activePartner && (
        <div className="mb-4 flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-2.5 text-sm">
          <span className="font-semibold text-blue-700">{activePartner.name}</span>
          <span className="text-blue-500">
            عمولة {activePartner.commission}{activePartner.commissionType === 'percentage' ? '%' : ' ج'}
          </span>
          <span className="text-slate-400 text-xs mr-auto">
            عدّل السعر مباشرةً في الجدول — اتركه فارغاً لاستخدام سعر المطعم
          </span>
        </div>
      )}

      {/* ── Search ─────────────────────────────────────────────────────────── */}
      <div className="relative mb-4">
        <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث عن وجبة..."
          className="w-full pr-9 pl-4 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* ══ RESTAURANT TAB ══════════════════════════════════════════════════ */}
      {activeTab === 'restaurant' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {['', 'الوجبة', 'التصنيف', 'سعر البيع', 'التكلفة', 'الربح', 'هامش الربح', 'الحالة', ''].map((h, i) => (
                  <th key={i} className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(item => {
                const cost   = calcCost(item)
                const hasCost = (item.recipes?.length ?? 0) > 0
                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    {/* Image */}
                    <td className="px-3 py-2.5">
                      <div className="relative group">
                        <ProductImage imagePath={item.imagePath} size={38} />
                        <div className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-0.5">
                          <button onClick={() => handleSelectImage(item)}
                            disabled={imageLoading === item.id}
                            className="p-0.5 text-white hover:text-blue-300 transition-colors" title="تغيير الصورة">
                            <Camera size={12} />
                          </button>
                          {item.imagePath && (
                            <button onClick={() => handleRemoveImage(item)}
                              className="p-0.5 text-white hover:text-red-300 transition-colors" title="حذف الصورة">
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{item.name}</td>
                    <td className="px-4 py-3">
                      {item.category
                        ? <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"><Tag size={10} /> {item.category}</span>
                        : <span className="text-slate-300 text-sm">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700 font-mono text-sm">{item.price.toFixed(2)} ج</td>
                    <td className="px-4 py-3 text-slate-500 font-mono text-sm">
                      {hasCost ? `${cost.toFixed(2)} ج` : <span className="text-slate-300">لا وصفة</span>}
                    </td>
                    <td className="px-4 py-3"><ProfitCell price={item.price} cost={hasCost ? cost : 0} /></td>
                    <td className="px-4 py-3"><MarginBadge price={item.price} cost={hasCost ? cost : 0} /></td>
                    <td className="px-4 py-3">
                      {item.isActive
                        ? <span className="inline-flex items-center gap-1 text-green-600 text-xs"><CheckCircle size={12} /> نشط</span>
                        : <span className="inline-flex items-center gap-1 text-slate-400 text-xs"><XCircle size={12} /> موقوف</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => setDeleteId(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">
                    {search ? 'لا توجد نتائج' : 'لا توجد وجبات — ابدأ بإضافة أول وجبة'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ══ DELIVERY PARTNER TABS ═══════════════════════════════════════════ */}
      {activeTab !== 'restaurant' && activePartner && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {pricesLoading ? (
            <div className="py-12 text-center text-slate-400 text-sm">جاري التحميل...</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">الوجبة</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">التصنيف</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">سعر المطعم</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-blue-600">سعر {activePartner.name}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500"></th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">التكلفة</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">الربح</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">هامش الربح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(item => {
                  const cost      = calcCost(item)
                  const hasCost   = (item.recipes?.length ?? 0) > 0
                  const rawVal    = dirtyPrices[item.id] ?? ''
                  const savedPrice = deliveryPrices[item.id]
                  const effectivePrice = savedPrice !== undefined ? savedPrice : item.price

                  // Indicator vs restaurant price
                  const diff = effectivePrice - item.price
                  const indicator = diff > 0
                    ? <TrendingUp size={13} className="text-green-500" />
                    : diff < 0
                      ? <TrendingDown size={13} className="text-red-400" />
                      : <MinusIcon size={13} className="text-slate-300" />

                  const hasCustom = savedPrice !== undefined

                  return (
                    <tr key={item.id} className={`hover:bg-slate-50 ${hasCustom ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{item.name}</td>
                      <td className="px-4 py-2.5">
                        {item.category
                          ? <span className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"><Tag size={10} />{item.category}</span>
                          : <span className="text-slate-300 text-sm">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm text-slate-400">{item.price.toFixed(2)} ج</td>

                      {/* Editable delivery price */}
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min="0" step="0.01"
                            value={rawVal}
                            placeholder={item.price.toFixed(2)}
                            onChange={e => setDirtyPrices(prev => ({ ...prev, [item.id]: e.target.value }))}
                            onBlur={() => handlePriceBlur(item.id, item.price)}
                            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                            className={`w-24 border rounded-lg px-2 py-1 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                              hasCustom
                                ? 'border-blue-300 bg-blue-50 text-blue-800 font-semibold'
                                : 'border-slate-200 bg-white text-slate-400'
                            }`}
                          />
                          {hasCustom && (
                            <button
                              onClick={async () => {
                                await window.api.delivery.removePrice({ partnerId: activeTab as number, productId: item.id })
                                setDeliveryPrices(prev => { const n = { ...prev }; delete n[item.id]; return n })
                                setDirtyPrices(prev => { const n = { ...prev }; delete n[item.id]; return n })
                              }}
                              className="text-slate-300 hover:text-red-400 transition-colors" title="إزالة السعر المخصص">
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Trend indicator */}
                      <td className="px-1 py-2.5">{indicator}</td>

                      <td className="px-4 py-2.5 font-mono text-sm text-slate-500">
                        {hasCost ? `${cost.toFixed(2)} ج` : <span className="text-slate-300">لا وصفة</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <ProfitCell price={effectivePrice} cost={hasCost ? cost : 0} />
                      </td>
                      <td className="px-4 py-2.5">
                        <MarginBadge price={effectivePrice} cost={hasCost ? cost : 0} />
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-sm">
                      {search ? 'لا توجد نتائج' : 'لا توجد وجبات'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      {showModal && (
        <Modal title={editItem ? 'تعديل الوجبة' : 'إضافة وجبة'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="اسم الوجبة *">
              <input required value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={inputCls} placeholder="مثال: شاورما دجاج، كفتة، برجر..." />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="سعر البيع (ج) *">
                <input type="number" step="0.01" min="0" required
                  value={form.price}
                  onChange={e => setForm(f => ({ ...f, price: +e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="التصنيف">
                <select value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className={inputCls}>
                  <option value="">بدون تصنيف</option>
                  {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                className="w-4 h-4 text-blue-600 rounded" />
              <span className="text-sm text-slate-700">وجبة نشطة (تظهر في القوائم)</span>
            </label>
            {editItem && (
              <div className="p-3 bg-slate-50 rounded-xl text-sm text-slate-500 flex items-center gap-2">
                <Camera size={14} />
                لإضافة أو تغيير صورة الوجبة، مرّر على الصورة في جدول المطعم واضغط على أيقونة الكاميرا
              </div>
            )}
            <SaveCancelButtons saving={saving} onCancel={() => setShowModal(false)} />
          </form>
        </Modal>
      )}

      {deleteId && (
        <DeleteConfirm
          message="سيتم حذف الوجبة ووصفتها. لا يمكن التراجع."
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  )
}
