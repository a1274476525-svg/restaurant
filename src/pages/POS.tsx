import { useEffect, useState, useCallback } from 'react'
import {
  ShoppingCart, Plus, Minus, X, Trash2, Printer,
  CreditCard, Banknote, Tag, TableProperties,
  CheckCircle, RotateCcw, Search, Clock, ChevronDown, ChevronUp,
  Bike, Store, UtensilsCrossed, Truck, Users,
} from 'lucide-react'
import type { Product, Table, Promotion, PosOrder, DeliveryPartner, DeliveryProductPrice } from '../types'

// ─── Receipt Print ────────────────────────────────────────────────────────────
function printReceipt(order: PosOrder, restaurantName: string) {
  const rows = order.items.map(i => `
    <tr>
      <td>${i.productName}</td>
      <td style="text-align:center">${i.quantity}</td>
      <td style="text-align:left;font-family:monospace">${i.unitPrice.toFixed(2)} ج</td>
      <td style="text-align:left;font-family:monospace">${i.total.toFixed(2)} ج</td>
    </tr>`).join('')

  const orderTypeLabel: Record<string, string> = {
    dine_in: 'طاولة', takeaway: 'استلام', delivery_own: 'توصيل ذاتي', delivery_external: 'شركة توصيل',
  }

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>فاتورة ${order.orderNumber}</title>
  <style>
    * { font-family: Arial, sans-serif; margin: 0; padding: 0; box-sizing: border-box; }
    body { padding: 20px; color: #1e293b; direction: rtl; max-width: 320px; margin: 0 auto; }
    .header { text-align: center; padding-bottom: 12px; margin-bottom: 12px; border-bottom: 2px dashed #cbd5e1; }
    .header h1 { font-size: 20px; font-weight: bold; }
    .header p  { font-size: 12px; color: #64748b; margin-top: 2px; }
    .meta { font-size: 12px; color: #475569; margin-bottom: 12px; }
    .meta div { margin-bottom: 3px; }
    table { width: 100%; font-size: 12px; border-collapse: collapse; margin-bottom: 12px; }
    th { border-bottom: 1px solid #e2e8f0; padding: 5px 3px; font-size: 11px; color: #64748b; text-align: right; }
    td { padding: 5px 3px; border-bottom: 1px solid #f1f5f9; }
    .totals { font-size: 13px; border-top: 2px dashed #cbd5e1; padding-top: 10px; }
    .totals .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
    .totals .final { font-weight: bold; font-size: 16px; margin-top: 6px; padding-top: 6px; border-top: 1px solid #e2e8f0; }
    .footer { margin-top: 16px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 2px dashed #cbd5e1; padding-top: 10px; }
    @media print { body { padding: 8px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${restaurantName}</h1>
    <p>فاتورة نقطة البيع</p>
  </div>
  <div class="meta">
    <div><strong>رقم الطلب:</strong> ${order.orderNumber}</div>
    <div><strong>التاريخ:</strong> ${new Date(order.createdAt).toLocaleString('ar-EG')}</div>
    <div><strong>نوع الطلب:</strong> ${orderTypeLabel[order.orderType] ?? order.orderType}</div>
    ${order.tableId ? `<div><strong>الطاولة:</strong> #${order.tableId}</div>` : ''}
    ${order.customer ? `<div><strong>العميل:</strong> ${order.customer.name}${order.customer.phone ? ` · ${order.customer.phone}` : ''}</div>` : ''}
    <div><strong>طريقة الدفع:</strong> ${order.paymentMethod === 'cash' ? 'نقدي' : 'بطاقة'}</div>
  </div>
  <table>
    <thead><tr><th>الصنف</th><th style="text-align:center">الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>المجموع الفرعي</span><span>${order.subtotal.toFixed(2)} ج</span></div>
    ${order.discountAmount > 0 ? `<div class="row" style="color:#16a34a"><span>خصم</span><span>- ${order.discountAmount.toFixed(2)} ج</span></div>` : ''}
    ${order.commissionAmount > 0 ? `<div class="row" style="color:#d97706"><span>عمولة توصيل</span><span>${order.commissionAmount.toFixed(2)} ج</span></div>` : ''}
    <div class="row final"><span>الإجمالي</span><span style="color:#2563eb">${order.total.toFixed(2)} ج</span></div>
  </div>
  <div class="footer">شكراً لزيارتكم<br/>${new Date().toLocaleDateString('ar-EG')}</div>
</body>
</html>`

  const w = window.open('', '_blank', 'width=400,height=600')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 400)
}

function isToday(dateVal: string | Date) {
  const d = new Date(dateVal)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

// ─── Cart Types ───────────────────────────────────────────────────────────────
interface CartItem {
  productId:   number
  productName: string
  unitPrice:   number
  quantity:    number
}

// ─── Image thumbnail ──────────────────────────────────────────────────────────
function ProductThumb({ imagePath, name }: { imagePath: string | null; name: string }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (!imagePath) { setSrc(null); return }
    window.api.products.getImageData(imagePath).then(setSrc)
  }, [imagePath])

  if (src) return (
    <img src={src} className="w-full h-24 object-cover rounded-t-xl" />
  )
  return (
    <div className="w-full h-24 bg-gradient-to-br from-blue-50 to-slate-100 rounded-t-xl flex items-center justify-center">
      <span className="text-3xl font-bold text-slate-300">{name[0]}</span>
    </div>
  )
}

// ─── Main POS Page ────────────────────────────────────────────────────────────
export default function POS() {
  const [tab, setTab] = useState<'pos' | 'orders'>('pos')

  type OrderType = 'dine_in' | 'takeaway' | 'delivery_own' | 'delivery_external'

  const ORDER_TYPES: { value: OrderType; label: string; icon: React.ElementType }[] = [
    { value: 'dine_in',           label: 'طاولة',         icon: UtensilsCrossed },
    { value: 'takeaway',          label: 'استلام',        icon: Store },
    { value: 'delivery_own',      label: 'توصيل ذاتي',   icon: Bike },
    { value: 'delivery_external', label: 'شركة توصيل',   icon: Truck },
  ]

  // Data
  const [products,       setProducts]       = useState<Product[]>([])
  const [tables,         setTables]         = useState<Table[]>([])
  const [promos,         setPromos]         = useState<Promotion[]>([])
  const [orders,         setOrders]         = useState<PosOrder[]>([])
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartner[]>([])
  const [partnerPrices,  setPartnerPrices]  = useState<Record<number, number>>({})
  const [restaurant,     setRestaurant]     = useState('المطعم')
  const [customers,      setCustomers]      = useState<import('../types').Customer[]>([])

  // Cart
  const [cart,          setCart]          = useState<CartItem[]>([])
  const [orderType,     setOrderType]     = useState<OrderType>('dine_in')
  const [tableId,       setTableId]       = useState<number | ''>('')
  const [customerId,    setCustomerId]    = useState<number | ''>('')
  const [partnerId,     setPartnerId]     = useState<number | ''>('')
  const [promoId,       setPromoId]       = useState<number | ''>('')
  const [payment,       setPayment]       = useState<'cash' | 'card'>('cash')
  const [note,          setNote]          = useState('')
  const [saving,        setSaving]        = useState(false)
  const [lastOrder,     setLastOrder]     = useState<PosOrder | null>(null)

  // Filter
  const [category, setCategory] = useState('')
  const [search,   setSearch]   = useState('')

  // Orders history
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null)
  const [voiding,       setVoiding]       = useState<number | null>(null)

  const loadOrders = useCallback(() =>
    window.api.pos.getOrders().then(setOrders), [])

  useEffect(() => {
    Promise.all([
      window.api.products.getAll(),
      window.api.tables.getAll(),
      window.api.promotions.getAll(),
      window.api.settings.getAll(),
      window.api.delivery.getAll(),
      window.api.customers.getAll(),
    ]).then(([prods, tbls, pmts, settings, partners, custs]) => {
      setProducts(prods.filter(p => p.isActive))
      setTables(tbls)
      setCustomers(custs)
      const now = new Date()
      setPromos(pmts.filter(p =>
        p.isActive &&
        new Date(p.startDate) <= now &&
        new Date(p.endDate) >= now
      ))
      setRestaurant(settings.restaurantName)
      setDeliveryPartners(partners.filter((p: DeliveryPartner) => p.isActive))
    })
    loadOrders()
  }, [loadOrders])

  // Load partner prices when partner changes
  useEffect(() => {
    if (partnerId) {
      window.api.delivery.getPrices(+partnerId).then((list: DeliveryProductPrice[]) => {
        const map: Record<number, number> = {}
        list.forEach(p => { map[p.productId] = p.price })
        setPartnerPrices(map)
        // Update existing cart prices to partner prices
        setCart(prev => prev.map(item => ({
          ...item,
          unitPrice: map[item.productId] ?? products.find(p => p.id === item.productId)?.price ?? item.unitPrice,
        })))
      })
    } else {
      setPartnerPrices({})
      // Restore default prices
      setCart(prev => prev.map(item => ({
        ...item,
        unitPrice: products.find(p => p.id === item.productId)?.price ?? item.unitPrice,
      })))
    }
  }, [partnerId]) // eslint-disable-line

  const getProductPrice = (product: Product) =>
    (partnerId && partnerPrices[product.id] !== undefined)
      ? partnerPrices[product.id]
      : product.price

  // ── Cart ops ─────────────────────────────────────────────────────────────
  const addToCart = (product: Product) => {
    const price = getProductPrice(product)
    setCart(prev => {
      const ex = prev.find(i => i.productId === product.id)
      if (ex) return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { productId: product.id, productName: product.name, unitPrice: price, quantity: 1 }]
    })
  }

  const setQty = (productId: number, qty: number) => {
    if (qty <= 0) setCart(prev => prev.filter(i => i.productId !== productId))
    else setCart(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i))
  }

  const clearCart = () => {
    setCart([]); setTableId(''); setPromoId('')
    setPartnerId(''); setNote(''); setPayment('cash')
    setCustomerId(''); setLastOrder(null)
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  const subtotal = cart.reduce((s, i) => s + i.quantity * i.unitPrice, 0)

  const selectedPartner = deliveryPartners.find(p => p.id === partnerId)
  const commissionAmount = (() => {
    if (!selectedPartner) return 0
    if (selectedPartner.commissionType === 'percentage')
      return +(subtotal * selectedPartner.commission / 100).toFixed(2)
    return selectedPartner.commission
  })()

  const selectedPromo = promos.find(p => p.id === promoId)
  const discountAmount = (() => {
    if (!selectedPromo) return 0
    let base = subtotal
    if (!selectedPromo.applyToAll) {
      const ids = selectedPromo.products.map(pp => pp.productId)
      base = cart.filter(i => ids.includes(i.productId)).reduce((s, i) => s + i.quantity * i.unitPrice, 0)
    }
    if (selectedPromo.discountType === 'percentage')
      return +(base * selectedPromo.discountValue / 100).toFixed(2)
    return Math.min(selectedPromo.discountValue, base)
  })()

  const total = Math.max(0, subtotal - discountAmount)

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleOrder = async () => {
    if (cart.length === 0) return
    setSaving(true)
    try {
      const order = await window.api.pos.createOrder({
        orderType:         orderType,
        tableId:           tableId || null,
        customerId:        customerId || null,
        deliveryPartnerId: (orderType === 'delivery_external' && partnerId) ? +partnerId : null,
        commissionAmount:  orderType === 'delivery_external' ? commissionAmount : 0,
        paymentMethod:     payment,
        note:              note || null,
        discountType:      selectedPromo?.discountType ?? null,
        discountValue:     selectedPromo?.discountValue ?? 0,
        discountAmount,
        subtotal,
        total,
        items: cart.map(i => ({
          productId:   i.productId,
          productName: i.productName,
          quantity:    i.quantity,
          unitPrice:   i.unitPrice,
          total:       i.quantity * i.unitPrice,
        })),
      })
      setLastOrder(order)
      setCart([]); setTableId(''); setPromoId(''); setNote('')
      setCustomerId('')
      loadOrders()
    } finally { setSaving(false) }
  }

  const handleVoid = async (id: number) => {
    setVoiding(id)
    try { await window.api.pos.voidOrder(id); loadOrders() }
    finally { setVoiding(null) }
  }

  // ── Filter ─────────────────────────────────────────────────────────────
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[]))
  const filtered = products
    .filter(p => !category || p.category === category)
    .filter(p => !search || p.name.includes(search))

  // ── Available tables ───────────────────────────────────────────────────
  const availTables = tables.filter(t => t.status === 'available' || t.id === tableId)

  // ═══════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="no-print flex items-center justify-between px-5 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          <button onClick={() => setTab('pos')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'pos' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
            <ShoppingCart size={14} className="inline ml-1.5" />نقطة البيع
          </button>
          <button onClick={() => setTab('orders')}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${tab === 'orders' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
            <Clock size={14} className="inline ml-1.5" />الطلبات ({orders.filter(o => o.status === 'completed').length})
          </button>
        </div>
        <p className="text-slate-400 text-xs">
          {new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ══ TAB: POS ═══════════════════════════════════════════════════════ */}
      {tab === 'pos' && (
        <div className="flex flex-1 overflow-hidden">

          {/* ── Left: Products ──────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
            {/* Search + Category Filter */}
            <div className="px-4 pt-3 pb-2 flex-shrink-0 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="بحث عن وجبة..."
                  className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button onClick={() => setCategory('')}
                  className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                    !category ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}>
                  الكل ({products.length})
                </button>
                {categories.map(c => (
                  <button key={c} onClick={() => setCategory(c)}
                    className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                      category === c ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}>
                    {c} ({products.filter(p => p.category === c).length})
                  </button>
                ))}
              </div>
            </div>

            {/* Product Grid */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">لا توجد وجبات</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filtered.map(product => {
                    const inCart = cart.find(i => i.productId === product.id)
                    return (
                      <button key={product.id} onClick={() => addToCart(product)}
                        className={`rounded-xl overflow-hidden text-right shadow-sm transition-all hover:shadow-md active:scale-95 border-2 ${
                          inCart ? 'border-blue-500 bg-white' : 'border-transparent bg-white'
                        }`}>
                        <ProductThumb imagePath={product.imagePath} name={product.name} />
                        <div className="p-2.5">
                          <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-2">{product.name}</p>
                          <p className="text-blue-600 font-bold text-sm mt-1">{product.price.toFixed(2)} ج</p>
                          {inCart && (
                            <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                              في السلة × {inCart.quantity}
                            </span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Cart ─────────────────────────────────────────────── */}
          <div className="w-80 flex flex-col bg-white border-r border-slate-200 flex-shrink-0">

              <div className="px-4 py-3 border-b border-slate-100 flex-shrink-0 space-y-2">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <ShoppingCart size={16} className="text-blue-600" />
                الطلب الحالي
                {cart.length > 0 && (
                  <span className="mr-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">
                    {cart.reduce((s, i) => s + i.quantity, 0)} صنف
                  </span>
                )}
              </h2>
              {/* Order Type */}
              <div className="grid grid-cols-4 gap-1">
                {ORDER_TYPES.map(t => {
                  const Icon = t.icon
                  return (
                    <button key={t.value} onClick={() => { setOrderType(t.value); if (t.value !== 'delivery_external') setPartnerId('') }}
                      className={`flex flex-col items-center gap-0.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        orderType === t.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}>
                      <Icon size={13} />
                      <span>{t.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                  <ShoppingCart size={40} />
                  <p className="text-sm">اختر وجبة من القائمة</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {cart.map(item => (
                    <div key={item.productId} className="px-4 py-2.5 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{item.productName}</p>
                        <p className="text-xs text-slate-400">{item.unitPrice.toFixed(2)} ج × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button onClick={() => setQty(item.productId, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                          <Minus size={10} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={e => setQty(item.productId, Math.max(0, +e.target.value || 0))}
                          onFocus={e => e.target.select()}
                          className="w-12 text-center text-sm font-bold text-slate-700 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button onClick={() => setQty(item.productId, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors">
                          <Plus size={10} />
                        </button>
                        <button onClick={() => setQty(item.productId, 0)}
                          className="w-6 h-6 flex items-center justify-center text-slate-300 hover:text-red-500 mr-1">
                          <X size={12} />
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-slate-700 w-16 text-left">
                        {(item.quantity * item.unitPrice).toFixed(2)} ج
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Order Options + Totals */}
            <div className="border-t border-slate-200 flex-shrink-0 p-4 space-y-3">

              {/* Table — only for dine_in */}
              {orderType === 'dine_in' && tables.length > 0 && (
                <div className="flex items-center gap-2">
                  <TableProperties size={14} className="text-slate-400 flex-shrink-0" />
                  <select value={tableId}
                    onChange={e => setTableId(e.target.value ? +e.target.value : '')}
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">بدون طاولة</option>
                    {availTables.map(t => (
                      <option key={t.id} value={t.id}>طاولة {t.number}{t.zone ? ` (${t.zone})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Customer — optional */}
              {customers.length > 0 && (
                <div className="flex items-center gap-2">
                  <Users size={14} className="text-slate-400 flex-shrink-0" />
                  <select value={customerId}
                    onChange={e => setCustomerId(e.target.value ? +e.target.value : '')}
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">بدون عميل</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Delivery Partner — only for delivery_external */}
              {orderType === 'delivery_external' && (
                <div className="flex items-center gap-2">
                  <Truck size={14} className="text-slate-400 flex-shrink-0" />
                  <select value={partnerId}
                    onChange={e => setPartnerId(e.target.value ? +e.target.value : '')}
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">اختر شركة التوصيل</option>
                    {deliveryPartners.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — عمولة {p.commission}{p.commissionType === 'percentage' ? '%' : ' ج'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Promotion */}
              {promos.length > 0 && (
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-slate-400 flex-shrink-0" />
                  <select value={promoId}
                    onChange={e => setPromoId(e.target.value ? +e.target.value : '')}
                    className="flex-1 text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">بدون عرض</option>
                    {promos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {p.discountType === 'percentage' ? `${p.discountValue}%` : `${p.discountValue} ج`} خصم
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Note */}
              <input value={note} onChange={e => setNote(e.target.value)}
                placeholder="ملاحظة للطلب (اختياري)"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />

              {/* Totals */}
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-500">
                  <span>المجموع الفرعي</span>
                  <span className="font-mono">{subtotal.toFixed(2)} ج</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>خصم ({selectedPromo?.name})</span>
                    <span className="font-mono">- {discountAmount.toFixed(2)} ج</span>
                  </div>
                )}
                {orderType === 'delivery_external' && selectedPartner && commissionAmount > 0 && (
                  <div className="flex justify-between text-amber-600 text-xs border-t border-slate-200 pt-1.5 mt-1">
                    <span>عمولة {selectedPartner.name}</span>
                    <span className="font-mono">{commissionAmount.toFixed(2)} ج</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-slate-800 text-base border-t border-slate-200 pt-1.5">
                  <span>الإجمالي</span>
                  <span className="font-mono text-blue-600">{total.toFixed(2)} ج</span>
                </div>
              </div>

              {/* Payment Method */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setPayment('cash')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                    payment === 'cash' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}>
                  <Banknote size={15} /> نقدي
                </button>
                <button onClick={() => setPayment('card')}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                    payment === 'card' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}>
                  <CreditCard size={15} /> بطاقة
                </button>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={clearCart} disabled={cart.length === 0}
                  className="flex items-center justify-center gap-1 py-2 border border-slate-200 rounded-xl text-slate-500 text-xs hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-30 transition-colors">
                  <Trash2 size={13} /> مسح
                </button>
                <button onClick={handleOrder} disabled={cart.length === 0 || saving}
                  className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {saving ? 'جاري...' : <><CheckCircle size={15} /> إتمام الطلب</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ Order Success Modal ═════════════════════════════════════════════ */}
      {lastOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-b from-green-50 to-white px-6 pt-8 pb-5 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-1">تم الطلب بنجاح!</h2>
              <p className="text-slate-400 text-sm">{lastOrder.orderNumber}</p>
              <p className="text-3xl font-bold text-blue-600 mt-3 mb-1">{lastOrder.total.toFixed(2)} ج</p>
              <p className="text-slate-400 text-xs">
                {lastOrder.paymentMethod === 'cash' ? 'نقدي' : 'بطاقة'}
                {lastOrder.tableId ? ` · طاولة #${lastOrder.tableId}` : ''}
              </p>
            </div>
            <div className="px-4 pb-4 flex gap-3">
              <button
                onClick={() => printReceipt(lastOrder, restaurant)}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors"
              >
                <Printer size={16} /> طباعة الفاتورة
              </button>
              <button
                onClick={() => setLastOrder(null)}
                className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm hover:bg-slate-200 transition-colors"
              >
                طلب جديد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TAB: Orders History ══════════════════════════════════════════════ */}
      {tab === 'orders' && (
        <div className="flex-1 overflow-y-auto p-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            {[
              {
                label: 'مبيعات اليوم',
                value: orders
                  .filter(o => o.status === 'completed' && isToday(o.createdAt))
                  .reduce((s, o) => s + o.total, 0).toFixed(2) + ' ج',
                color: 'text-green-600', bg: 'bg-green-50',
              },
              {
                label: 'طلبات اليوم',
                value: orders
                  .filter(o => o.status === 'completed' && isToday(o.createdAt))
                  .length + ' طلب',
                color: 'text-blue-600', bg: 'bg-blue-50',
              },
              {
                label: 'إجمالي الطلبات',
                value: orders.filter(o => o.status === 'completed').length + ' طلب',
                color: 'text-purple-600', bg: 'bg-purple-50',
              },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
                <p className="text-xs text-slate-500 mb-1">{s.label}</p>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <ShoppingCart size={48} className="mx-auto mb-3 opacity-20" />
              <p>لا توجد طلبات بعد</p>
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map(order => (
                <div key={order.id} className={`bg-white rounded-xl shadow-sm overflow-hidden border ${
                  order.status === 'voided' ? 'opacity-60 border-slate-200' : 'border-transparent'
                }`}>
                  <div className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-slate-50"
                    onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}>
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      order.status === 'voided' ? 'bg-slate-100 text-slate-400' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {order.paymentMethod === 'cash' ? <Banknote size={16} /> : <CreditCard size={16} />}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800 text-sm">{order.orderNumber}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(order.createdAt).toLocaleString('ar-EG')}
                        {order.tableId && ` · طاولة #${order.tableId}`}
                        {order.customer && ` · ${order.customer.name}`}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      order.status === 'voided' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
                    }`}>
                      {order.status === 'voided' ? 'ملغي' : 'مكتمل'}
                    </span>
                    <span className="font-bold text-slate-800 font-mono text-sm">{order.total.toFixed(2)} ج</span>
                    <div className="flex items-center gap-1">
                      {order.status === 'completed' && (
                        <>
                          <button onClick={e => { e.stopPropagation(); printReceipt(order, restaurant) }}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="طباعة الفاتورة">
                            <Printer size={14} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleVoid(order.id) }}
                            disabled={voiding === order.id}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="إلغاء الطلب وإعادة المخزون">
                            <RotateCcw size={14} />
                          </button>
                        </>
                      )}
                      {expandedOrder === order.id
                        ? <ChevronUp size={14} className="text-slate-400" />
                        : <ChevronDown size={14} className="text-slate-400" />}
                    </div>
                  </div>

                  {expandedOrder === order.id && (
                    <div className="border-t border-slate-100 px-5 py-3">
                      <table className="w-full text-sm mb-3">
                        <thead>
                          <tr className="text-slate-400 text-xs">
                            <th className="text-right pb-2 font-semibold">الصنف</th>
                            <th className="text-right pb-2 font-semibold">الكمية</th>
                            <th className="text-right pb-2 font-semibold">السعر</th>
                            <th className="text-right pb-2 font-semibold">الإجمالي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {order.items.map(item => (
                            <tr key={item.id}>
                              <td className="py-1.5 text-slate-700">{item.productName}</td>
                              <td className="py-1.5 text-slate-500">× {item.quantity}</td>
                              <td className="py-1.5 font-mono text-slate-600">{item.unitPrice.toFixed(2)} ج</td>
                              <td className="py-1.5 font-mono font-semibold text-slate-800">{item.total.toFixed(2)} ج</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1 text-slate-600">
                        <div className="flex justify-between"><span>المجموع الفرعي</span><span className="font-mono">{order.subtotal.toFixed(2)} ج</span></div>
                        {order.discountAmount > 0 && (
                          <div className="flex justify-between text-green-600"><span>خصم</span><span className="font-mono">- {order.discountAmount.toFixed(2)} ج</span></div>
                        )}
                        <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1">
                          <span>الإجمالي</span><span className="font-mono text-blue-600">{order.total.toFixed(2)} ج</span>
                        </div>
                        <div className="flex justify-between text-slate-400 pt-1">
                          <span>طريقة الدفع</span>
                          <span>{order.paymentMethod === 'cash' ? 'نقدي' : 'بطاقة'}</span>
                        </div>
                        {order.customer && (
                          <div className="flex justify-between text-slate-400">
                            <span>العميل</span>
                            <span>{order.customer.name}</span>
                          </div>
                        )}
                        {order.commissionAmount > 0 && (
                          <div className="flex justify-between text-amber-600">
                            <span>عمولة توصيل</span>
                            <span className="font-mono">{order.commissionAmount.toFixed(2)} ج</span>
                          </div>
                        )}
                        {order.note && <div className="text-slate-400">ملاحظة: {order.note}</div>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
