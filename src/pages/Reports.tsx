import { useEffect, useState } from 'react'
import * as XLSX from 'xlsx'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { AlertTriangle, Package, TrendingUp, Activity, ClipboardList, Save, Download, Printer, Plus, Edit2, Trash2, X, FileBarChart2, RefreshCw, Scale } from 'lucide-react'
import type { Ingredient, OverheadEntry } from '../types'
import { inputCls, Modal, Field, DeleteConfirm, SaveCancelButtons } from '../components/ui'

type Tab = 'stock' | 'consumption' | 'costs' | 'overhead' | 'variance' | 'income' | 'trialBalance' | 'balanceSheet' | 'cashFlow' | 'supplierDebt'

interface IncomeStatement {
  period:  { from: string; to: string; days: number; months: number }
  revenue: { pos: number; manual: number; total: number; discounts: number; commissions: number; net: number }
  cogs:    number
  wasteValue: number
  grossProfit:  number
  grossMargin:  number
  expenses: {
    direct:        { id: number; name: string; category: string; monthlyAmount: number; periodAmount: number }[]
    indirect:      { id: number; name: string; category: string; monthlyAmount: number; periodAmount: number }[]
    totalDirect:   number
    totalIndirect: number
    total:         number
    months:        number
    days:          number
  }
  actualExpenses: {
    direct:        { id: number; date: string; description: string; category: string; amount: number; vendor?: string | null }[]
    indirect:      { id: number; date: string; description: string; category: string; amount: number; vendor?: string | null }[]
    totalDirect:   number
    totalIndirect: number
    total:         number
  }
  operatingProfit: number
  netMargin:       number
  purchases:       number
}

interface TrialBalanceRow {
  code:          string
  name:          string
  type:          string
  debitBalance:  number
  creditBalance: number
  totalDebit:    number
  totalCredit:   number
}

interface TrialBalance {
  rows:         TrialBalanceRow[]
  sumDebitBal:  number
  sumCreditBal: number
  sumDebitTx:   number
  sumCreditTx:  number
}

const CATEGORY_LABELS: Record<string, string> = {
  labor_kitchen:  'عمالة المطبخ',
  fuel:           'وقود المطبخ',
  kitchen_clean:  'نظافة المطبخ',
  water_ops:      'مياه التشغيل',
  rent:           'إيجار المحل',
  labor_other:    'رواتب (غير مطبخ)',
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
  other:          'أخرى',
}

interface ProductCostItem {
  ingredientName: string; unit: string; quantity: number; costPerUnit: number; subtotal: number
}
interface ProductCost {
  id: number; name: string; category: string | null; price: number; isActive: boolean
  rawCost: number; profit: number; margin: number; items: ProductCostItem[]
}
interface ConsumptionRow {
  ingredient: Ingredient; saleQty: number; wasteQty: number
}

const fmt = (n: number) => n.toFixed(2)
const pad2 = (n: number) => String(n).padStart(2, '0')
const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}
const monthStart = () => {
  const d = new Date()
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-01`
}

export default function Reports() {
  const [tab, setTab]                   = useState<Tab>('stock')
  const [ingredients, setIngredients]   = useState<Ingredient[]>([])
  const [productCosts, setProductCosts] = useState<ProductCost[]>([])
  const [consumption, setConsumption]   = useState<ConsumptionRow[]>([])
  const [dateRange, setDateRange]       = useState({ from: monthStart(), to: todayStr() })
  const [loadingC, setLoadingC]         = useState(false)

  // Cost controls
  const [wastePercent,   setWastePercent]   = useState(5)
  const [packagingCost,  setPackagingCost]  = useState(0)
  const [expectedMeals,  setExpectedMeals]  = useState(0)
  const [expandedIds,    setExpandedIds]    = useState<Set<number>>(new Set())

  // Overhead entries
  const [overheadEntries, setOverheadEntries] = useState<OverheadEntry[]>([])
  const [showOvModal, setShowOvModal] = useState(false)
  const [editOv,      setEditOv]      = useState<OverheadEntry | null>(null)
  const [deleteOvId,  setDeleteOvId]  = useState<number | null>(null)
  const [savingOv,    setSavingOv]    = useState(false)
  const [ovForm,      setOvForm]      = useState({
    name: '', category: 'other', type: 'indirect' as 'direct'|'indirect', amount: 0, note: '',
  })

  // Variance / جرد state
  const [actualCounts, setActualCounts] = useState<Record<number, string>>({})
  const [savingV, setSavingV]           = useState(false)
  const [savedV, setSavedV]             = useState(false)

  // Income Statement state
  const [incomeStmt,   setIncomeStmt]   = useState<IncomeStatement | null>(null)
  const [incomeRange,  setIncomeRange]  = useState({ from: monthStart(), to: todayStr() })
  const [loadingIncome, setLoadingIncome] = useState(false)

  // Trial Balance state
  const [trialBalance,   setTrialBalance]   = useState<TrialBalance | null>(null)
  const [trialRange,     setTrialRange]     = useState({ from: monthStart(), to: todayStr() })
  const [loadingTrial,   setLoadingTrial]   = useState(false)

  // Balance Sheet state
  const [balanceSheet,   setBalanceSheet]   = useState<any>(null)
  const [bsAsOf,         setBsAsOf]         = useState(todayStr())
  const [loadingBS,      setLoadingBS]      = useState(false)

  // Cash Flow state
  const [cashFlow,       setCashFlow]       = useState<any>(null)
  const [cfRange,        setCfRange]        = useState({ from: monthStart(), to: todayStr() })
  const [loadingCF,      setLoadingCF]      = useState(false)

  // Supplier Debt state
  const [supplierDebt,   setSupplierDebt]   = useState<any>(null)
  const [loadingSD,      setLoadingSD]      = useState(false)

  const loadIngredients = () => window.api.ingredients.getAll().then(setIngredients)
  const loadOverhead    = () => window.api.overhead.getAll().then(setOverheadEntries)

  useEffect(() => {
    loadIngredients()
    window.api.reports.productCosts().then(setProductCosts)
    loadOverhead()
  }, [])

  useEffect(() => {
    if (tab !== 'consumption') return
    setLoadingC(true)
    window.api.reports.consumption(dateRange).then(setConsumption).finally(() => setLoadingC(false))
  }, [tab, dateRange])

  // Reset actual counts when tab changes to variance (fresh جرد session)
  useEffect(() => {
    if (tab === 'variance')     { setActualCounts({}); setSavedV(false) }
    if (tab === 'income')       loadIncome()
    if (tab === 'trialBalance') loadTrialBalance()
    if (tab === 'balanceSheet') loadBalanceSheet()
    if (tab === 'cashFlow')     loadCashFlow()
    if (tab === 'supplierDebt') loadSupplierDebt()
  }, [tab])

  async function loadIncome() {
    setLoadingIncome(true)
    const data = await window.api.reports.incomeStatement(incomeRange)
    setIncomeStmt(data)
    setLoadingIncome(false)
  }

  async function loadTrialBalance() {
    setLoadingTrial(true)
    const data = await window.api.reports.trialBalance(trialRange)
    setTrialBalance(data)
    setLoadingTrial(false)
  }

  async function loadBalanceSheet() {
    setLoadingBS(true)
    const data = await window.api.reports.balanceSheet({ asOf: bsAsOf })
    setBalanceSheet(data)
    setLoadingBS(false)
  }

  async function loadCashFlow() {
    setLoadingCF(true)
    const data = await window.api.reports.cashFlow(cfRange)
    setCashFlow(data)
    setLoadingCF(false)
  }

  async function loadSupplierDebt() {
    setLoadingSD(true)
    const data = await window.api.reports.supplierDebt()
    setSupplierDebt(data)
    setLoadingSD(false)
  }

  function exportCashFlowExcel(cf: any) {
    const headers = ['الشهر', 'التدفق الداخل', 'التدفق الخارج', 'الصافي']
    const rows = cf.months.map((m: any) => [m.month, m.inflow.toFixed(2), m.outflow.toFixed(2), m.net.toFixed(2)])
    rows.push(['الإجمالي', cf.totalInflow.toFixed(2), cf.totalOutflow.toFixed(2), cf.netCashFlow.toFixed(2)])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'التدفق النقدي')
    XLSX.writeFile(wb, `cash-flow-${cfRange.from}-${cfRange.to}.xlsx`)
  }

  function exportSupplierDebtExcel(sd: any) {
    const headers = ['المورد', 'عدد الفواتير', 'إجمالي المشتريات']
    const rows = sd.suppliers.map((s: any) => [s.supplierName, s.invoiceCount, s.totalAmount.toFixed(2)])
    rows.push(['الإجمالي', '', sd.grandTotal.toFixed(2)])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'مشتريات الموردين')
    XLSX.writeFile(wb, `supplier-debt-${todayStr()}.xlsx`)
  }

  function exportBalanceSheetExcel(bs: any) {
    const wb = XLSX.utils.book_new()
    const rows: any[] = [['الميزانية العمومية — بتاريخ ' + bs.asOf.slice(0, 10)], []]
    rows.push(['الأصول', '', ''], ...bs.assets.map((a: any) => [a.code, a.name, a.balance.toFixed(2)]))
    rows.push(['إجمالي الأصول', '', bs.totalAssets.toFixed(2)], [])
    rows.push(['الخصوم', '', ''], ...bs.liabilities.map((a: any) => [a.code, a.name, a.balance.toFixed(2)]))
    rows.push(['إجمالي الخصوم', '', bs.totalLiabilities.toFixed(2)], [])
    rows.push(['حقوق الملكية', '', ''], ...bs.equity.map((a: any) => [a.code, a.name, a.balance.toFixed(2)]))
    rows.push(['إجمالي حقوق الملكية', '', bs.totalEquity.toFixed(2)])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'الميزانية العمومية')
    XLSX.writeFile(wb, `balance-sheet-${bs.asOf.slice(0, 10)}.xlsx`)
  }

  const lowStock = ingredients.filter(i => i.currentStock <= i.minStockAlert)

  // Variance helpers
  const actual = (id: number, currentStock: number) => {
    const v = actualCounts[id]
    return v === undefined || v === '' ? null : parseFloat(v)
  }
  const variance = (id: number, currentStock: number) => {
    const a = actual(id, currentStock)
    return a === null ? null : a - currentStock
  }
  const varianceValue = (id: number, ing: Ingredient) => {
    const v = variance(id, ing.currentStock)
    return v === null ? null : v * ing.costPerUnit
  }

  const totalVarianceValue = ingredients.reduce((sum, i) => {
    const vv = varianceValue(i.id, i)
    return sum + (vv ?? 0)
  }, 0)

  const filledCount = Object.values(actualCounts).filter(v => v !== '').length

  const saveVariance = async () => {
    setSavingV(true)
    try {
      for (const ing of ingredients) {
        const v = variance(ing.id, ing.currentStock)
        if (v !== null && v !== 0) {
          await window.api.stock.adjust({
            ingredientId: ing.id,
            quantity: v,
            note: `جرد دوري بتاريخ ${todayStr()}`,
          })
        }
      }
      await loadIngredients()
      setActualCounts({})
      setSavedV(true)
    } finally { setSavingV(false) }
  }

  function exportStockExcel() {
    const headers = ['المادة', 'الوحدة', 'الكمية الحالية', 'الحد الأدنى', 'سعر التكلفة (ج)', 'القيمة الإجمالية (ج)', 'الحالة']
    const rows = ingredients.map(i => [
      i.name, i.unit, i.currentStock, i.minStockAlert,
      i.costPerUnit.toFixed(2),
      (i.currentStock * i.costPerUnit).toFixed(2),
      i.currentStock <= i.minStockAlert ? 'منخفض' : 'جيد',
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [20, 8, 12, 10, 14, 16, 8].map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'المخزون')
    XLSX.writeFile(wb, `stock-report-${todayStr()}.xlsx`)
  }

  function exportConsumptionExcel() {
    const headers = ['المادة', 'الوحدة', 'استهلاك المبيعات', 'الهالك', 'الإجمالي', 'التكلفة الكلية (ج)']
    const rows = consumption.map(r => [
      r.ingredient.name, r.ingredient.unit,
      r.saleQty.toFixed(3), r.wasteQty.toFixed(3),
      (r.saleQty + r.wasteQty).toFixed(3),
      ((r.saleQty + r.wasteQty) * r.ingredient.costPerUnit).toFixed(2),
    ])
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [20, 8, 16, 10, 10, 16].map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'الاستهلاك')
    XLSX.writeFile(wb, `consumption-report-${todayStr()}.xlsx`)
  }

  // ── Overhead computed values ──────────────────────────────────────
  const activeOverhead   = overheadEntries.filter(e => e.isActive)
  const totalDirect      = activeOverhead.filter(e => e.type === 'direct').reduce((s, e) => s + e.amount, 0)
  const totalIndirect    = activeOverhead.filter(e => e.type === 'indirect').reduce((s, e) => s + e.amount, 0)
  const totalMonthly     = totalDirect + totalIndirect
  const directPerMeal    = expectedMeals > 0 ? totalDirect   / expectedMeals : 0
  const indirectPerMeal  = expectedMeals > 0 ? totalIndirect / expectedMeals : 0

  // ── Overhead CRUD ─────────────────────────────────────────────────
  const openAddOv  = () => { setEditOv(null); setOvForm({ name:'', category:'other', type:'indirect', amount:0, note:'' }); setShowOvModal(true) }
  const openEditOv = (e: OverheadEntry) => { setEditOv(e); setOvForm({ name:e.name, category:e.category, type:e.type, amount:e.amount, note:e.note??'' }); setShowOvModal(true) }

  const handleSaveOv = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setSavingOv(true)
    try {
      if (editOv) await window.api.overhead.update({ id: editOv.id, ...ovForm })
      else        await window.api.overhead.create(ovForm)
      setShowOvModal(false)
      loadOverhead()
    } finally { setSavingOv(false) }
  }

  const handleDeleteOv = async () => {
    if (!deleteOvId) return
    await window.api.overhead.delete(deleteOvId)
    setDeleteOvId(null)
    loadOverhead()
  }

  function exportCostsExcel() {
    const headers = ['الوجبة', 'التصنيف', 'سعر البيع', 'خامات', `هالك ${wastePercent}%`, 'تغليف', 'مباشرة/وجبة', 'غير مباشرة/وجبة', 'إجمالي التكلفة', 'الربح', 'هامش %', 'التقييم']
    const rows: (string | number)[][] = []
    for (const p of productCosts) {
      if (p.items.length === 0) {
        rows.push([p.name, p.category ?? '', p.price, 'لا وصفة', '', '', '', '', '', '', '', 'بدون وصفة'])
        continue
      }
      const wasteAdj  = p.rawCost * (wastePercent / 100)
      const totalCost = p.rawCost + wasteAdj + packagingCost + directPerMeal + indirectPerMeal
      const profit    = p.price - totalCost
      const margin    = p.price > 0 ? (profit / p.price) * 100 : 0
      rows.push([
        p.name, p.category ?? '',
        p.price.toFixed(2), p.rawCost.toFixed(2),
        wasteAdj.toFixed(2), packagingCost.toFixed(2),
        directPerMeal.toFixed(2), indirectPerMeal.toFixed(2),
        totalCost.toFixed(2), profit.toFixed(2), margin.toFixed(1) + '%',
        margin >= 30 ? 'ممتاز' : margin >= 15 ? 'مقبول' : 'ضعيف',
      ])
      for (const item of p.items)
        rows.push(['', `  › ${item.ingredientName}`, '', '', '', '', '', '', '', `${item.quantity} ${item.unit} × ${item.costPerUnit.toFixed(2)} = ${item.subtotal.toFixed(2)} ج`, '', ''])
    }
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [22, 10, 11, 11, 10, 10, 12, 14, 13, 11, 10, 10].map(wch => ({ wch }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'تكاليف الوجبات')
    XLSX.writeFile(wb, `product-costs-${todayStr()}.xlsx`)
  }

  const tabs = [
    { key: 'stock'        as Tab, label: 'المخزون الحالي',   icon: <Package size={14} /> },
    { key: 'consumption'  as Tab, label: 'الاستهلاك',         icon: <Activity size={14} /> },
    { key: 'overhead'     as Tab, label: 'مراكز التكلفة',     icon: <Plus size={14} /> },
    { key: 'costs'        as Tab, label: 'تكاليف الوجبات',    icon: <TrendingUp size={14} /> },
    { key: 'variance'     as Tab, label: 'الجرد والفرق',      icon: <ClipboardList size={14} /> },
    { key: 'income'       as Tab, label: 'قائمة الدخل',       icon: <FileBarChart2 size={14} /> },
    { key: 'trialBalance' as Tab, label: 'ميزان المراجعة',    icon: <Scale size={14} /> },
    { key: 'balanceSheet' as Tab, label: 'الميزانية العمومية', icon: <FileBarChart2 size={14} /> },
    { key: 'cashFlow'     as Tab, label: 'التدفق النقدي',      icon: <TrendingUp size={14} /> },
    { key: 'supplierDebt' as Tab, label: 'مشتريات الموردين',  icon: <Activity size={14} /> },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">التقارير</h1>
        <button onClick={() => window.print()}
          className="no-print flex items-center gap-2 bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium">
          <Printer size={15} /> طباعة
        </button>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <AlertTriangle size={17} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-700 mb-1">{lowStock.length} مادة وصلت للحد الأدنى</p>
            <p className="text-xs text-amber-600">{lowStock.map(i => `${i.name} (${i.currentStock} ${i.unit})`).join(' • ')}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-5 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── STOCK ── */}
      {tab === 'stock' && (
        <div>
          <div className="flex justify-end mb-3 no-print">
            <button onClick={exportStockExcel}
              className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 text-sm font-medium">
              <Download size={14} /> تصدير Excel
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4 mb-5">
            <SummaryCard label="إجمالي المواد"   value={ingredients.length}                   color="blue" />
            <SummaryCard label="مخزون جيد"       value={ingredients.length - lowStock.length} color="green" />
            <SummaryCard label="مخزون منخفض"     value={lowStock.length}                       color="amber" alert />
          </div>
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>{['المادة','الوحدة','الكمية الحالية','الحد الأدنى','سعر التكلفة','القيمة الإجمالية','الحالة'].map(h => (
                  <th key={h} className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ingredients.map(ing => {
                  const isLow = ing.currentStock <= ing.minStockAlert
                  return (
                    <tr key={ing.id} className={`hover:bg-slate-50 ${isLow ? 'bg-amber-50/40' : ''}`}>
                      <td className="px-4 py-3 font-medium text-slate-800">{ing.name}</td>
                      <td className="px-4 py-3 text-slate-500 text-sm">{ing.unit}</td>
                      <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-700">{ing.currentStock}</td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-400">{ing.minStockAlert}</td>
                      <td className="px-4 py-3 font-mono text-sm text-slate-600">{fmt(ing.costPerUnit)} ج</td>
                      <td className="px-4 py-3 font-mono text-sm font-medium text-slate-700">
                        {fmt(ing.currentStock * ing.costPerUnit)} ج
                      </td>
                      <td className="px-4 py-3">
                        {isLow
                          ? <span className="inline-flex items-center gap-1 text-amber-600 text-xs bg-amber-100 px-2 py-0.5 rounded-full"><AlertTriangle size={10} /> تنبيه</span>
                          : <span className="text-green-600 text-xs bg-green-100 px-2 py-0.5 rounded-full">جيد</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {ingredients.length > 0 && (
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-slate-600">إجمالي قيمة المخزون</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">
                      {fmt(ingredients.reduce((s, i) => s + i.currentStock * i.costPerUnit, 0))} ج
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ── CONSUMPTION ── */}
      {tab === 'consumption' && (
        <div>
          <div className="bg-white rounded-xl shadow-sm p-4 mb-3 flex items-center gap-4 flex-wrap no-print">
            <span className="text-sm font-medium text-slate-600">من</span>
            <input type="date" value={dateRange.from}
              onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-sm text-slate-400">إلى</span>
            <input type="date" value={dateRange.to}
              onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="mr-auto">
              <button onClick={exportConsumptionExcel} disabled={consumption.length === 0}
                className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 text-sm font-medium disabled:opacity-40">
                <Download size={14} /> تصدير Excel
              </button>
            </div>
          </div>
          {loadingC ? (
            <div className="text-center py-12 text-slate-400">جاري التحميل...</div>
          ) : consumption.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm text-slate-400 text-sm">لا توجد بيانات في هذه الفترة</div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>{['المادة','الوحدة','استهلاك المبيعات','الهالك','الإجمالي','التكلفة الكلية'].map(h => (
                    <th key={h} className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {consumption.map((row, i) => {
                    const total = row.saleQty + row.wasteQty
                    return (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-800">{row.ingredient.name}</td>
                        <td className="px-4 py-3 text-slate-500 text-sm">{row.ingredient.unit}</td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-700">{fmt(row.saleQty)}</td>
                        <td className="px-4 py-3 font-mono text-sm text-red-400">{fmt(row.wasteQty)}</td>
                        <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800">{fmt(total)}</td>
                        <td className="px-4 py-3 font-mono text-sm text-slate-600">
                          {fmt(total * row.ingredient.costPerUnit)} ج
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={5} className="px-4 py-3 text-sm font-semibold text-slate-600">إجمالي تكلفة الاستهلاك</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">
                      {fmt(consumption.reduce((s, r) => s + (r.saleQty + r.wasteQty) * r.ingredient.costPerUnit, 0))} ج
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── OVERHEAD / COST CENTERS ── */}
      {tab === 'overhead' && (
        <div className="space-y-5">
          {/* summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-orange-50 rounded-xl p-5">
              <p className="text-xs text-slate-500 mb-1">إجمالي التكاليف المباشرة / شهر</p>
              <p className="text-2xl font-bold text-orange-700 font-mono">{fmt(totalDirect)} ج</p>
              {directPerMeal > 0 && <p className="text-xs text-orange-500 mt-1">{fmt(directPerMeal)} ج لكل وجبة</p>}
            </div>
            <div className="bg-blue-50 rounded-xl p-5">
              <p className="text-xs text-slate-500 mb-1">إجمالي التكاليف غير المباشرة / شهر</p>
              <p className="text-2xl font-bold text-blue-700 font-mono">{fmt(totalIndirect)} ج</p>
              {indirectPerMeal > 0 && <p className="text-xs text-blue-500 mt-1">{fmt(indirectPerMeal)} ج لكل وجبة</p>}
            </div>
            <div className="bg-slate-50 rounded-xl p-5">
              <p className="text-xs text-slate-500 mb-1">إجمالي كل التكاليف / شهر</p>
              <p className="text-2xl font-bold text-slate-800 font-mono">{fmt(totalMonthly)} ج</p>
              {expectedMeals > 0 && totalMonthly > 0 && (
                <p className="text-xs text-slate-500 mt-1">{fmt(totalMonthly / expectedMeals)} ج لكل وجبة</p>
              )}
            </div>
          </div>

          {/* list + add button */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">بنود التكاليف</h2>
              <button onClick={openAddOv}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">
                <Plus size={15} /> إضافة بند
              </button>
            </div>
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['البند', 'التصنيف', 'النوع', 'المبلغ الشهري (ج)', 'الحالة', ''].map(h => (
                    <th key={h} className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {overheadEntries.map(e => (
                  <tr key={e.id} className={`hover:bg-slate-50 ${!e.isActive ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {e.name}
                      {e.note && <p className="text-xs text-slate-400 mt-0.5">{e.note}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{CATEGORY_LABELS[e.category] ?? e.category}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        e.type === 'direct' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {e.type === 'direct' ? 'مباشر' : 'غير مباشر'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-semibold text-slate-800">{fmt(e.amount)} ج</td>
                    <td className="px-4 py-3">
                      <button onClick={() => window.api.overhead.toggle(e.id).then(loadOverhead)}
                        className={`text-xs px-2 py-0.5 rounded-full ${e.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                        {e.isActive ? 'نشط' : 'معطّل'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => openEditOv(e)}
                          className="p-1.5 text-blue-400 hover:bg-blue-50 rounded-lg"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleteOvId(e.id)}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {overheadEntries.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">
                    لم تُضَف أي تكاليف بعد — اضغط "إضافة بند" للبدء
                  </td></tr>
                )}
              </tbody>
              {overheadEntries.length > 0 && (
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-sm font-semibold text-slate-600">إجمالي نشط</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">{fmt(totalMonthly)} ج</td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* helper note */}
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
            <p className="font-semibold mb-1">أمثلة على التكاليف المباشرة وغير المباشرة:</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="font-medium text-orange-700 mb-1">مباشرة (ترتبط بالإنتاج مباشرة):</p>
                <ul className="space-y-0.5 text-slate-600">
                  <li>• رواتب طاقم المطبخ (طباخين + مساعدين)</li>
                  <li>• وقود المطبخ (جاز / فحم)</li>
                  <li>• مواد تنظيف المطبخ</li>
                  <li>• مياه التشغيل</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-blue-700 mb-1">غير مباشرة (تُوزَّع على الوجبات):</p>
                <ul className="space-y-0.5 text-slate-600">
                  <li>• إيجار المحل</li>
                  <li>• رواتب (كاشيير، نادل، مدير)</li>
                  <li>• كهرباء + غاز + مياه</li>
                  <li>• صيانة + إهلاك معدات</li>
                  <li>• تسويق + رسوم + تأمين</li>
                </ul>
              </div>
            </div>
          </div>

          {/* modal */}
          {showOvModal && (
            <Modal title={editOv ? 'تعديل بند تكلفة' : 'إضافة بند تكلفة'} onClose={() => setShowOvModal(false)}>
              <form onSubmit={handleSaveOv} className="space-y-4">
                <Field label="اسم البند">
                  <input value={ovForm.name} onChange={e => setOvForm(f=>({...f, name:e.target.value}))}
                    required className={inputCls} placeholder="مثال: إيجار المحل" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="النوع">
                    <select value={ovForm.type} onChange={e => setOvForm(f=>({...f, type:e.target.value as any}))} className={inputCls}>
                      <option value="direct">مباشر</option>
                      <option value="indirect">غير مباشر</option>
                    </select>
                  </Field>
                  <Field label="التصنيف">
                    <select value={ovForm.category} onChange={e => setOvForm(f=>({...f, category:e.target.value}))} className={inputCls}>
                      {Object.entries(CATEGORY_LABELS).map(([k,v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </Field>
                </div>
                <Field label="المبلغ الشهري (ج)">
                  <input type="number" min="0" step="0.01" value={ovForm.amount}
                    onChange={e => setOvForm(f=>({...f, amount:+e.target.value}))}
                    required className={inputCls} />
                </Field>
                <Field label="ملاحظة (اختياري)">
                  <input value={ovForm.note} onChange={e => setOvForm(f=>({...f, note:e.target.value}))} className={inputCls} />
                </Field>
                <SaveCancelButtons saving={savingOv} onCancel={() => setShowOvModal(false)} />
              </form>
            </Modal>
          )}

          {deleteOvId !== null && (
            <DeleteConfirm
              message="هل تريد حذف هذا البند؟"
              onConfirm={handleDeleteOv}
              onCancel={() => setDeleteOvId(null)}
            />
          )}
        </div>
      )}

      {/* ── COSTS ── */}
      {tab === 'costs' && (
        <div className="space-y-4">
          {/* Cost controls panel */}
          <div className="bg-white rounded-xl shadow-sm p-5 no-print">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <TrendingUp size={15} className="text-blue-500" />
              عوامل التكلفة
            </h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">نسبة الهالك %</label>
                <div className="flex items-center gap-1">
                  <input type="number" min="0" max="50" step="0.5"
                    value={wastePercent}
                    onChange={e => setWastePercent(Math.max(0, +e.target.value))}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                  <span className="text-slate-400 text-sm">%</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">فقد الخامات أثناء التحضير</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">تكلفة التغليف للوجبة</label>
                <div className="flex items-center gap-1">
                  <input type="number" min="0" step="0.5"
                    value={packagingCost}
                    onChange={e => setPackagingCost(Math.max(0, +e.target.value))}
                    className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                  <span className="text-slate-400 text-sm">ج</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">علب، أكياس، مناديل</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">عدد الوجبات الشهرية المتوقعة</label>
                <input type="number" min="0" step="10"
                  value={expectedMeals}
                  onChange={e => setExpectedMeals(Math.max(0, +e.target.value))}
                  className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono" />
                <p className="text-xs text-slate-400 mt-1">لحساب نصيب كل وجبة من التكاليف</p>
              </div>
            </div>
            {/* overhead summary from DB */}
            {(totalDirect > 0 || totalIndirect > 0) ? (
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div className="bg-orange-50 rounded-lg px-3 py-2">
                  <p className="text-slate-500">تكاليف مباشرة شهرية</p>
                  <p className="font-bold text-orange-700 font-mono">{fmt(totalDirect)} ج</p>
                  {directPerMeal > 0 && <p className="text-orange-500">{fmt(directPerMeal)} ج / وجبة</p>}
                </div>
                <div className="bg-blue-50 rounded-lg px-3 py-2">
                  <p className="text-slate-500">تكاليف غير مباشرة شهرية</p>
                  <p className="font-bold text-blue-700 font-mono">{fmt(totalIndirect)} ج</p>
                  {indirectPerMeal > 0 && <p className="text-blue-500">{fmt(indirectPerMeal)} ج / وجبة</p>}
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-slate-500">إجمالي التكاليف الشهرية</p>
                  <p className="font-bold text-slate-800 font-mono">{fmt(totalMonthly)} ج</p>
                  {expectedMeals > 0 && <p className="text-slate-500">{fmt((totalDirect+totalIndirect)/expectedMeals)} ج / وجبة</p>}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400 mt-3 bg-slate-50 rounded-lg px-3 py-2">
                لم تُضَف تكاليف بعد — اذهب إلى تبويب <span className="font-semibold text-blue-600">مراكز التكلفة</span> لإضافة التكاليف المباشرة وغير المباشرة
              </p>
            )}
          </div>

          {/* legend */}
          <div className="flex flex-wrap gap-3 text-xs no-print">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-300 inline-block" /> خامات</span>
            {wastePercent > 0   && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block" /> هالك {wastePercent}%</span>}
            {packagingCost > 0  && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-400 inline-block" /> تغليف {fmt(packagingCost)} ج</span>}
            {directPerMeal > 0  && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> مباشرة {fmt(directPerMeal)} ج</span>}
            {indirectPerMeal > 0 && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-400 inline-block" /> غير مباشرة {fmt(indirectPerMeal)} ج</span>}
          </div>

          {/* export */}
          <div className="flex justify-end no-print">
            <button onClick={exportCostsExcel} disabled={productCosts.length === 0}
              className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 text-sm font-medium disabled:opacity-40">
              <Download size={14} /> تصدير Excel
            </button>
          </div>

          {/* main table */}
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 w-6"></th>
                  {['الوجبة','سعر البيع','تكلفة الخامات','التعديلات','إجمالي التكلفة','الربح','هامش الربح','التقييم'].map(h => (
                    <th key={h} className="text-right px-3 py-3 text-xs font-semibold text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {productCosts.map(p => {
                  const wasteAdj    = p.rawCost * (wastePercent / 100)
                  const totalAdj    = wasteAdj + packagingCost + directPerMeal + indirectPerMeal
                  const totalCost   = p.rawCost + totalAdj
                  const profit      = p.price - totalCost
                  const margin      = p.price > 0 ? (profit / p.price) * 100 : 0
                  const hasRecipe   = p.items.length > 0
                  const isExpanded  = expandedIds.has(p.id)

                  return (
                    <>
                      <tr key={p.id} className="hover:bg-slate-50 border-b border-slate-50">
                        <td className="px-4 py-3">
                          {hasRecipe && (
                            <button
                              onClick={() => setExpandedIds(prev => {
                                const n = new Set(prev)
                                n.has(p.id) ? n.delete(p.id) : n.add(p.id)
                                return n
                              })}
                              className="text-slate-400 hover:text-blue-500 transition-colors"
                              title="تفاصيل المكونات"
                            >
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                                <path d="M4 2l6 5-6 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          )}
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-800">
                          {p.name}
                          {p.category && <span className="mr-1.5 text-xs text-slate-400">{p.category}</span>}
                          {!p.isActive && <span className="mr-1.5 text-xs text-slate-300">(غير نشط)</span>}
                        </td>
                        <td className="px-3 py-3 font-mono text-sm text-slate-700">{fmt(p.price)} ج</td>
                        <td className="px-3 py-3 font-mono text-sm text-slate-500">
                          {hasRecipe ? `${fmt(p.rawCost)} ج` : <span className="text-slate-300 text-xs">لا وصفة</span>}
                        </td>
                        <td className="px-3 py-3">
                          {hasRecipe && totalAdj > 0 ? (
                            <div className="space-y-0.5">
                              {wasteAdj > 0      && <div className="text-xs text-amber-600 font-mono">+{fmt(wasteAdj)} هالك</div>}
                              {packagingCost > 0 && <div className="text-xs text-purple-600 font-mono">+{fmt(packagingCost)} تغليف</div>}
                              {directPerMeal > 0 && <div className="text-xs text-orange-600 font-mono">+{fmt(directPerMeal)} مباشرة</div>}
                              {indirectPerMeal>0 && <div className="text-xs text-blue-600 font-mono">+{fmt(indirectPerMeal)} غير مباشرة</div>}
                            </div>
                          ) : hasRecipe ? <span className="text-slate-300 text-xs">—</span> : null}
                        </td>
                        <td className="px-3 py-3 font-mono text-sm font-semibold text-slate-800">
                          {hasRecipe ? `${fmt(totalCost)} ج` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-3 font-mono text-sm font-semibold">
                          {hasRecipe
                            ? <span className={profit >= 0 ? 'text-green-600' : 'text-red-500'}>{fmt(profit)} ج</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-sm font-bold">
                          {hasRecipe
                            ? <span className={margin >= 30 ? 'text-green-600' : margin >= 15 ? 'text-amber-500' : 'text-red-500'}>
                                {margin.toFixed(1)}%
                              </span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {!hasRecipe ? <span className="text-slate-300">بدون وصفة</span>
                            : margin >= 30 ? <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full">ممتاز</span>
                            : margin >= 15 ? <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">مقبول</span>
                            : <span className="text-red-500 bg-red-50 px-2 py-0.5 rounded-full">ضعيف</span>}
                        </td>
                      </tr>
                      {/* Ingredient breakdown */}
                      {isExpanded && (
                        <tr key={`${p.id}-detail`} className="bg-slate-50/70">
                          <td colSpan={9} className="px-8 py-3">
                            <table className="w-full">
                              <thead>
                                <tr className="text-xs text-slate-500">
                                  <th className="text-right pb-1.5 font-medium">المكون</th>
                                  <th className="text-right pb-1.5 font-medium">الكمية</th>
                                  <th className="text-right pb-1.5 font-medium">الوحدة</th>
                                  <th className="text-right pb-1.5 font-medium">سعر الوحدة</th>
                                  <th className="text-right pb-1.5 font-medium">التكلفة</th>
                                  <th className="text-right pb-1.5 font-medium">% من التكلفة</th>
                                </tr>
                              </thead>
                              <tbody>
                                {p.items.map((item, idx) => (
                                  <tr key={idx} className="text-xs border-t border-slate-100">
                                    <td className="py-1.5 font-medium text-slate-700">{item.ingredientName}</td>
                                    <td className="py-1.5 font-mono text-slate-600">{item.quantity}</td>
                                    <td className="py-1.5 text-slate-500">{item.unit}</td>
                                    <td className="py-1.5 font-mono text-slate-600">{fmt(item.costPerUnit)} ج</td>
                                    <td className="py-1.5 font-mono font-semibold text-slate-700">{fmt(item.subtotal)} ج</td>
                                    <td className="py-1.5">
                                      {p.rawCost > 0 && (
                                        <div className="flex items-center gap-2">
                                          <div className="h-1.5 bg-blue-200 rounded-full w-20 overflow-hidden">
                                            <div className="h-full bg-blue-500 rounded-full"
                                              style={{ width: `${Math.min(100, (item.subtotal / p.rawCost) * 100)}%` }} />
                                          </div>
                                          <span className="text-slate-500">{((item.subtotal / p.rawCost) * 100).toFixed(0)}%</span>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                                <tr className="border-t border-slate-200 font-semibold text-xs">
                                  <td colSpan={4} className="py-1.5 text-slate-600">إجمالي تكلفة الخامات</td>
                                  <td className="py-1.5 font-mono text-slate-800">{fmt(p.rawCost)} ج</td>
                                  <td />
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </>
                  )
                })}
                {productCosts.length === 0 && (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-sm">لا توجد وجبات</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* chart */}
          {productCosts.filter(p => p.items.length > 0).length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-700 mb-4">مقارنة سعر البيع بإجمالي التكلفة</h3>
              <ResponsiveContainer width="100%" height={270}>
                <BarChart
                  data={productCosts.filter(p => p.items.length > 0).slice(0, 12).map(p => {
                    const totalCost = p.rawCost * (1 + wastePercent / 100) + packagingCost + directPerMeal + indirectPerMeal
                    return { name: p.name, price: p.price, cost: totalCost }
                  })}
                  margin={{ top: 5, right: 10, left: 10, bottom: 55 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: 'Cairo' }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number, name: string) => [`${(v as number).toFixed(2)} ج`, name === 'price' ? 'سعر البيع' : 'إجمالي التكلفة']}
                    contentStyle={{ fontFamily: 'Cairo', fontSize: 12, direction: 'rtl' }} />
                  <Legend formatter={v => v === 'price' ? 'سعر البيع' : 'إجمالي التكلفة'} wrapperStyle={{ fontFamily: 'Cairo', fontSize: 12 }} />
                  <Bar dataKey="price" fill="#3b82f6" radius={[4,4,0,0]} />
                  <Bar dataKey="cost"  fill="#f87171" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── VARIANCE / جرد ── */}
      {tab === 'variance' && (
        <div>
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-blue-700 text-sm">
            <p className="font-semibold mb-1">كيفية استخدام الجرد</p>
            <p className="text-blue-600 text-xs">
              أدخل الكمية الفعلية لكل مادة (من عدّك الحقيقي في المخزن). النظام سيقارنها بما هو مسجّل ويظهر الفرق.
              اضغط "حفظ الجرد" لتحديث المخزون وتسجيل الفروقات تلقائياً.
            </p>
          </div>

          {/* Summary */}
          {filledCount > 0 && (
            <div className={`rounded-xl p-4 mb-5 flex items-center justify-between ${
              totalVarianceValue < 0 ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
            }`}>
              <div>
                <p className="text-sm font-semibold text-slate-700">
                  إجمالي الفرق المالي: <span className={`font-bold ${totalVarianceValue < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {totalVarianceValue >= 0 ? '+' : ''}{fmt(totalVarianceValue)} ج
                  </span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">تم إدخال {filledCount} مادة من أصل {ingredients.length}</p>
              </div>
              <button onClick={saveVariance} disabled={savingV || filledCount === 0}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
                <Save size={15} />
                {savingV ? 'جاري الحفظ...' : 'حفظ الجرد'}
              </button>
            </div>
          )}

          {savedV && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-5 text-green-700 text-sm">
              تم حفظ الجرد وتحديث المخزون بنجاح ✓
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">المادة</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">الوحدة</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">كمية النظام</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 w-40">الكمية الفعلية (أدخل)</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">الفرق</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">القيمة المالية</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">التقييم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {ingredients.map(ing => {
                  const v    = variance(ing.id, ing.currentStock)
                  const vv   = varianceValue(ing.id, ing)
                  const hasV = v !== null
                  return (
                    <tr key={ing.id} className={`hover:bg-slate-50 ${hasV && v! < 0 ? 'bg-red-50/30' : hasV && v! > 0 ? 'bg-green-50/30' : ''}`}>
                      <td className="px-4 py-2.5 font-medium text-slate-800">{ing.name}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-sm">{ing.unit}</td>
                      <td className="px-4 py-2.5 font-mono text-sm font-semibold text-slate-700">{ing.currentStock}</td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number" step="0.001" min="0"
                          value={actualCounts[ing.id] ?? ''}
                          onChange={e => {
                            setSavedV(false)
                            setActualCounts(prev => ({ ...prev, [ing.id]: e.target.value }))
                          }}
                          placeholder="أدخل الكمية"
                          className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full font-mono bg-white"
                        />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm font-bold">
                        {hasV
                          ? <span className={v === 0 ? 'text-slate-400' : v! < 0 ? 'text-red-600' : 'text-green-600'}>
                              {v! > 0 ? '+' : ''}{v!.toFixed(3)}
                            </span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-sm">
                        {hasV && vv !== null
                          ? <span className={vv === 0 ? 'text-slate-400' : vv < 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>
                              {vv > 0 ? '+' : ''}{fmt(vv)} ج
                            </span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs">
                        {!hasV ? <span className="text-slate-300">لم يُدخل</span>
                          : v === 0 ? <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded-full">مطابق</span>
                          : v! < 0 ? <span className="text-red-600 bg-red-50 px-2 py-0.5 rounded-full font-medium">عجز</span>
                          : <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">فائض</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {filledCount === 0 && (
            <p className="text-center text-slate-400 text-sm mt-6">
              ابدأ بإدخال الكميات الفعلية في العمود الرابع لرؤية الفروقات
            </p>
          )}
        </div>
      )}
      {/* ── INCOME STATEMENT / قائمة الدخل ── */}
      {tab === 'income' && (
        <div className="space-y-4 max-w-3xl">
          {/* Date range + load */}
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 flex-wrap no-print">
            <span className="text-sm font-medium text-slate-600">الفترة من</span>
            <input type="date" value={incomeRange.from}
              onChange={e => setIncomeRange(r => ({ ...r, from: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-sm text-slate-400">إلى</span>
            <input type="date" value={incomeRange.to}
              onChange={e => setIncomeRange(r => ({ ...r, to: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={loadIncome} disabled={loadingIncome}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
              <RefreshCw size={14} className={loadingIncome ? 'animate-spin' : ''} />
              {loadingIncome ? 'جاري التحميل...' : 'عرض القائمة'}
            </button>
            {incomeStmt && (
              <button onClick={() => exportIncomeExcel(incomeStmt)}
                className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 text-sm font-medium mr-auto">
                <Download size={14} /> تصدير Excel
              </button>
            )}
          </div>

          {incomeStmt && (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden text-sm print-page">
              {/* Header */}
              <div className="bg-slate-800 text-white px-6 py-5 text-center">
                <h2 className="text-xl font-bold mb-1">قائمة الدخل</h2>
                <p className="text-slate-300 text-sm">
                  الفترة من {incomeStmt.period.from} إلى {incomeStmt.period.to}
                  &nbsp;·&nbsp; {incomeStmt.period.days} يوم
                </p>
              </div>

              <div className="divide-y divide-slate-100">

                {/* ─ الإيرادات ─ */}
                <IncomeSection title="الإيرادات" color="blue">
                  <IncomeRow label="إيرادات نقطة البيع (POS)"  value={incomeStmt.revenue.pos}    indent />
                  {incomeStmt.revenue.manual > 0 &&
                    <IncomeRow label="مبيعات يدوية"              value={incomeStmt.revenue.manual}  indent />}
                  <IncomeRow label="إجمالي الإيرادات"            value={incomeStmt.revenue.total}   subtotal />
                  {incomeStmt.revenue.discounts > 0 &&
                    <IncomeRow label="(-) خصومات"                value={-incomeStmt.revenue.discounts} indent negative />}
                  {incomeStmt.revenue.commissions > 0 &&
                    <IncomeRow label="(-) عمولات التوصيل"        value={-incomeStmt.revenue.commissions} indent negative />}
                  <IncomeRow label="= صافي الإيرادات"            value={incomeStmt.revenue.net}     total highlight="blue" />
                </IncomeSection>

                {/* ─ COGS ─ */}
                <IncomeSection title="تكلفة البضاعة المباعة (COGS)" color="orange">
                  <IncomeRow label="تكلفة المواد الخام المستهلكة في المبيعات" value={-incomeStmt.cogs} indent negative />
                  {incomeStmt.wasteValue > 0 &&
                    <IncomeRow label="تكلفة الهدر المسجّل" value={-incomeStmt.wasteValue} indent negative />}
                  <div className="flex justify-between items-center px-6 py-3 bg-green-50">
                    <span className="font-bold text-slate-700">= مجمل الربح (Gross Profit)</span>
                    <div className="text-left">
                      <span className={`font-bold text-lg font-mono ${incomeStmt.grossProfit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {fmt(incomeStmt.grossProfit)} ج
                      </span>
                      <span className="text-xs text-slate-400 mr-2">
                        هامش {incomeStmt.grossMargin.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </IncomeSection>

                {/* ─ مصاريف التشغيل — مراكز التكلفة الشهرية ─ */}
                {(incomeStmt.expenses.total > 0) && (
                  <IncomeSection title="مصاريف التشغيل — مراكز التكلفة (شهرية مُقسَّطة)" color="red">
                    {incomeStmt.expenses.direct.length > 0 && (
                      <>
                        <p className="px-6 pt-3 pb-1 text-xs font-semibold text-orange-600 uppercase tracking-wide">
                          مصاريف مباشرة
                        </p>
                        {incomeStmt.expenses.direct.map(e => (
                          <IncomeRow key={e.id}
                            label={`${e.name}${incomeStmt.expenses.days !== 30 ? ` (${incomeStmt.expenses.days}ي ÷ 30)` : ''}`}
                            value={-e.periodAmount} indent negative />
                        ))}
                        <IncomeRow label="إجمالي المباشرة المُقسَّطة" value={-incomeStmt.expenses.totalDirect} subtotal />
                      </>
                    )}
                    {incomeStmt.expenses.indirect.length > 0 && (
                      <>
                        <p className="px-6 pt-3 pb-1 text-xs font-semibold text-blue-600 uppercase tracking-wide">
                          مصاريف غير مباشرة
                        </p>
                        {incomeStmt.expenses.indirect.map(e => (
                          <IncomeRow key={e.id}
                            label={`${e.name}${incomeStmt.expenses.days !== 30 ? ` (${incomeStmt.expenses.days}ي ÷ 30)` : ''}`}
                            value={-e.periodAmount} indent negative />
                        ))}
                        <IncomeRow label="إجمالي غير المباشرة المُقسَّطة" value={-incomeStmt.expenses.totalIndirect} subtotal />
                      </>
                    )}
                    <IncomeRow label="= إجمالي مراكز التكلفة المُقسَّطة" value={-incomeStmt.expenses.total} total highlight="red" />
                  </IncomeSection>
                )}

                {/* ─ مصاريف التشغيل — فواتير المصاريف الفعلية ─ */}
                {(incomeStmt.actualExpenses?.total ?? 0) > 0 && (
                  <IncomeSection title="مصاريف التشغيل — فواتير مصاريف الفترة (فعلية)" color="red">
                    {incomeStmt.actualExpenses.direct.length > 0 && (
                      <>
                        <p className="px-6 pt-3 pb-1 text-xs font-semibold text-orange-600 uppercase tracking-wide">
                          مباشرة
                        </p>
                        {incomeStmt.actualExpenses.direct.map(e => (
                          <IncomeRow key={e.id}
                            label={`${e.description}${e.vendor ? ` — ${e.vendor}` : ''}`}
                            value={-e.amount} indent negative />
                        ))}
                        <IncomeRow label="إجمالي الفواتير المباشرة" value={-incomeStmt.actualExpenses.totalDirect} subtotal />
                      </>
                    )}
                    {incomeStmt.actualExpenses.indirect.length > 0 && (
                      <>
                        <p className="px-6 pt-3 pb-1 text-xs font-semibold text-blue-600 uppercase tracking-wide">
                          غير مباشرة
                        </p>
                        {incomeStmt.actualExpenses.indirect.map(e => (
                          <IncomeRow key={e.id}
                            label={`${e.description}${e.vendor ? ` — ${e.vendor}` : ''}`}
                            value={-e.amount} indent negative />
                        ))}
                        <IncomeRow label="إجمالي الفواتير غير المباشرة" value={-incomeStmt.actualExpenses.totalIndirect} subtotal />
                      </>
                    )}
                    <IncomeRow label="= إجمالي فواتير المصاريف" value={-incomeStmt.actualExpenses.total} total highlight="red" />
                  </IncomeSection>
                )}

                {incomeStmt.expenses.total === 0 && (incomeStmt.actualExpenses?.total ?? 0) === 0 && (
                  <div className="px-6 py-4 text-slate-400 text-xs border-t border-slate-100">
                    لم تُضَف مصاريف — اذهب إلى{' '}
                    <span className="font-semibold text-blue-600">مراكز التكلفة</span> أو{' '}
                    <span className="font-semibold text-blue-600">فواتير المصاريف</span>
                  </div>
                )}

                {/* ─ صافي الربح ─ */}
                <div className={`px-6 py-5 flex justify-between items-center ${
                  incomeStmt.operatingProfit >= 0 ? 'bg-green-50' : 'bg-red-50'
                }`}>
                  <div>
                    <p className="font-bold text-lg text-slate-800">= صافي الربح التشغيلي</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      هامش الربح الصافي: {incomeStmt.netMargin.toFixed(1)}%
                    </p>
                  </div>
                  <p className={`text-2xl font-bold font-mono ${
                    incomeStmt.operatingProfit >= 0 ? 'text-green-700' : 'text-red-600'
                  }`}>
                    {fmt(incomeStmt.operatingProfit)} ج
                  </p>
                </div>

                {/* ملاحظة المصاريف المقسّطة */}
                {incomeStmt.expenses.total > 0 && incomeStmt.period.days !== 30 && (
                  <div className="px-6 py-3 bg-amber-50 text-xs text-amber-700">
                    * المصاريف الشهرية مُقسَّطة على {incomeStmt.period.days} يوم (÷ 30 يوم)
                  </div>
                )}

                {/* معلومات إضافية */}
                {incomeStmt.purchases > 0 && (
                  <div className="px-6 py-3 bg-slate-50 flex justify-between text-xs text-slate-500">
                    <span>مشتريات الفترة (للمعلومية)</span>
                    <span className="font-mono">{fmt(incomeStmt.purchases)} ج</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {!incomeStmt && !loadingIncome && (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm text-slate-400">
              اختر الفترة الزمنية واضغط "عرض القائمة"
            </div>
          )}
        </div>
      )}

      {/* ── TRIAL BALANCE / ميزان المراجعة ── */}
      {tab === 'trialBalance' && (
        <div className="space-y-4">
          {/* فلتر + زر */}
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 flex-wrap no-print">
            <span className="text-sm font-medium text-slate-600">الفترة من</span>
            <input type="date" value={trialRange.from}
              onChange={e => setTrialRange(r => ({ ...r, from: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-sm text-slate-400">إلى</span>
            <input type="date" value={trialRange.to}
              onChange={e => setTrialRange(r => ({ ...r, to: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={loadTrialBalance} disabled={loadingTrial}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50">
              <RefreshCw size={14} className={loadingTrial ? 'animate-spin' : ''} />
              {loadingTrial ? 'جاري التحميل...' : 'عرض الميزان'}
            </button>
            {trialBalance && (
              <button onClick={() => exportTrialBalanceExcel(trialBalance, trialRange)}
                className="flex items-center gap-2 bg-green-50 text-green-700 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-100 text-sm font-medium mr-auto">
                <Download size={14} /> تصدير Excel
              </button>
            )}
          </div>

          {trialBalance && (
            <>
              {/* بطاقات التحقق */}
              <div className="grid grid-cols-2 gap-4">
                <div className={`rounded-xl p-4 ${Math.abs(trialBalance.sumDebitBal - trialBalance.sumCreditBal) < 0.01 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className="text-xs text-slate-500 mb-1">أرصدة مدينة / دائنة</p>
                  <div className="flex justify-between">
                    <span className="font-mono font-bold text-blue-700">{fmt(trialBalance.sumDebitBal)} ج مدين</span>
                    <span className="font-mono font-bold text-green-700">{fmt(trialBalance.sumCreditBal)} ج دائن</span>
                  </div>
                  <p className={`text-xs mt-1 font-medium ${Math.abs(trialBalance.sumDebitBal - trialBalance.sumCreditBal) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(trialBalance.sumDebitBal - trialBalance.sumCreditBal) < 0.01 ? '✓ الميزان متوازن' : '✗ الميزان غير متوازن'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                  <p className="text-xs text-slate-500 mb-1">إجمالي الحركات</p>
                  <div className="flex justify-between">
                    <span className="font-mono text-sm text-blue-600">{fmt(trialBalance.sumDebitTx)} ج مدين</span>
                    <span className="font-mono text-sm text-green-600">{fmt(trialBalance.sumCreditTx)} ج دائن</span>
                  </div>
                  <p className="text-xs mt-1 text-slate-400">{trialBalance.rows.length} حساب بحركة</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm overflow-hidden print-page">
                <div className="bg-slate-800 text-white px-6 py-4 text-center print:block">
                  <h2 className="text-lg font-bold">ميزان المراجعة</h2>
                  <p className="text-slate-300 text-sm">من {trialRange.from} إلى {trialRange.to}</p>
                </div>
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">رقم الحساب</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">اسم الحساب</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500">نوع الحساب</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-blue-500">إجمالي المدين</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-green-500">إجمالي الدائن</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-blue-700">رصيد مدين</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-green-700">رصيد دائن</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {trialBalance.rows.map(row => (
                      <tr key={row.code} className="hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono text-sm text-slate-500">{row.code}</td>
                        <td className="px-4 py-2.5 text-sm font-medium text-slate-800">{row.name}</td>
                        <td className="px-4 py-2.5">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            row.type === 'asset'     ? 'bg-blue-100 text-blue-700'    :
                            row.type === 'liability' ? 'bg-red-100 text-red-700'      :
                            row.type === 'equity'    ? 'bg-purple-100 text-purple-700':
                            row.type === 'revenue'   ? 'bg-green-100 text-green-700'  :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {row.type === 'asset' ? 'أصول' : row.type === 'liability' ? 'خصوم' : row.type === 'equity' ? 'حقوق ملكية' : row.type === 'revenue' ? 'إيرادات' : 'مصاريف'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-sm text-blue-600">
                          {row.totalDebit > 0 ? fmt(row.totalDebit) : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-sm text-green-600">
                          {row.totalCredit > 0 ? fmt(row.totalCredit) : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-sm font-semibold text-blue-700">
                          {row.debitBalance > 0 ? fmt(row.debitBalance) : '—'}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-sm font-semibold text-green-700">
                          {row.creditBalance > 0 ? fmt(row.creditBalance) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-800 text-white">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 text-sm font-bold">الإجمالي</td>
                      <td className="px-4 py-3 font-mono font-bold text-blue-300">{fmt(trialBalance.sumDebitTx)}</td>
                      <td className="px-4 py-3 font-mono font-bold text-green-300">{fmt(trialBalance.sumCreditTx)}</td>
                      <td className="px-4 py-3 font-mono font-bold text-blue-200">{fmt(trialBalance.sumDebitBal)}</td>
                      <td className="px-4 py-3 font-mono font-bold text-green-200">{fmt(trialBalance.sumCreditBal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}

          {!trialBalance && !loadingTrial && (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm text-slate-400">
              اختر الفترة الزمنية واضغط "عرض الميزان"
            </div>
          )}
        </div>
      )}

      {/* ── BALANCE SHEET / الميزانية العمومية ── */}
      {tab === 'balanceSheet' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 flex-wrap no-print">
            <span className="text-sm font-medium text-slate-600">بتاريخ</span>
            <input type="date" value={bsAsOf} onChange={e => setBsAsOf(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={loadBalanceSheet} disabled={loadingBS}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <RefreshCw size={13} className={loadingBS ? 'animate-spin' : ''} /> عرض الميزانية
            </button>
            {balanceSheet && (
              <button onClick={() => exportBalanceSheetExcel(balanceSheet)}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition-colors">
                <Download size={13} /> تصدير Excel
              </button>
            )}
          </div>

          {loadingBS && <div className="bg-white rounded-xl p-12 text-center shadow-sm text-slate-400">جاري التحميل...</div>}

          {balanceSheet && !loadingBS && (() => {
            const bs = balanceSheet
            const balanced = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity + bs.totalRevenue - bs.totalExpenses)) < 0.01
            return (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'إجمالي الأصول',       value: bs.totalAssets,      color: 'bg-blue-600' },
                    { label: 'إجمالي الخصوم',       value: bs.totalLiabilities, color: 'bg-red-500' },
                    { label: 'حقوق الملكية',        value: bs.totalEquity,      color: 'bg-purple-600' },
                    { label: 'توازن الميزانية',     value: null,                color: balanced ? 'bg-green-600' : 'bg-amber-500' },
                  ].map((c, i) => (
                    <div key={i} className={`${c.color} text-white rounded-xl p-4`}>
                      <p className="text-white/70 text-xs mb-1">{c.label}</p>
                      {c.value !== null
                        ? <p className="text-2xl font-bold">{fmt(c.value)}</p>
                        : <p className="text-lg font-bold">{balanced ? 'متوازنة ✓' : 'غير متوازنة !'}</p>
                      }
                    </div>
                  ))}
                </div>

                {/* Assets */}
                <BSSection title="الأصول" total={bs.totalAssets} rows={bs.assets} color="blue" />
                {/* Liabilities */}
                <BSSection title="الخصوم" total={bs.totalLiabilities} rows={bs.liabilities} color="red" />
                {/* Equity */}
                <BSSection title="حقوق الملكية" total={bs.totalEquity} rows={bs.equity} color="purple" />
                {/* Revenue / Expenses summary */}
                {(bs.revenue.length > 0 || bs.expenses.length > 0) && (
                  <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                    <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                      <h3 className="font-semibold text-slate-700">الإيرادات والمصاريف (من القيود)</h3>
                    </div>
                    <div className="p-4 flex gap-6 flex-wrap">
                      <div><p className="text-sm text-slate-500 mb-0.5">إجمالي الإيرادات</p><p className="text-xl font-bold text-green-700">{fmt(bs.totalRevenue)}</p></div>
                      <div><p className="text-sm text-slate-500 mb-0.5">إجمالي المصاريف</p><p className="text-xl font-bold text-red-700">{fmt(bs.totalExpenses)}</p></div>
                      <div><p className="text-sm text-slate-500 mb-0.5">صافي الدخل من القيود</p><p className={`text-xl font-bold ${bs.totalRevenue - bs.totalExpenses >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(bs.totalRevenue - bs.totalExpenses)}</p></div>
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {!balanceSheet && !loadingBS && (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm text-slate-400">
              اختر تاريخاً واضغط "عرض الميزانية"
            </div>
          )}
        </div>
      )}

      {/* ── CASH FLOW / التدفق النقدي ── */}
      {tab === 'cashFlow' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 flex-wrap no-print">
            <span className="text-sm font-medium text-slate-600">من</span>
            <input type="date" value={cfRange.from} onChange={e => setCfRange(r => ({ ...r, from: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-sm text-slate-500">إلى</span>
            <input type="date" value={cfRange.to} onChange={e => setCfRange(r => ({ ...r, to: e.target.value }))}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            <button onClick={loadCashFlow} disabled={loadingCF}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <RefreshCw size={13} className={loadingCF ? 'animate-spin' : ''} /> عرض التدفق
            </button>
            {cashFlow && (
              <button onClick={() => exportCashFlowExcel(cashFlow)}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition-colors">
                <Download size={13} /> تصدير Excel
              </button>
            )}
          </div>

          {loadingCF && <div className="bg-white rounded-xl p-12 text-center shadow-sm text-slate-400">جاري التحميل...</div>}

          {cashFlow && !loadingCF && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-green-600 text-white rounded-xl p-4">
                  <p className="text-white/70 text-xs mb-1">إجمالي التدفق الداخل</p>
                  <p className="text-2xl font-bold">{fmt(cashFlow.totalInflow)}</p>
                </div>
                <div className="bg-red-500 text-white rounded-xl p-4">
                  <p className="text-white/70 text-xs mb-1">إجمالي التدفق الخارج</p>
                  <p className="text-2xl font-bold">{fmt(cashFlow.totalOutflow)}</p>
                </div>
                <div className={`${cashFlow.netCashFlow >= 0 ? 'bg-blue-600' : 'bg-amber-500'} text-white rounded-xl p-4`}>
                  <p className="text-white/70 text-xs mb-1">صافي التدفق النقدي</p>
                  <p className="text-2xl font-bold">{fmt(cashFlow.netCashFlow)}</p>
                </div>
              </div>

              {/* Monthly table */}
              {cashFlow.months.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                  <div className="px-5 py-3 bg-slate-50 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-700">ملخص شهري</h3>
                  </div>
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="text-right px-5 py-2.5 font-medium text-slate-600">الشهر</th>
                        <th className="text-left px-4 py-2.5 font-medium text-green-700">التدفق الداخل</th>
                        <th className="text-left px-4 py-2.5 font-medium text-red-700">التدفق الخارج</th>
                        <th className="text-left px-4 py-2.5 font-medium text-slate-700">الصافي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {cashFlow.months.map((m: any) => (
                        <tr key={m.month} className="hover:bg-slate-50">
                          <td className="px-5 py-2.5 font-medium text-slate-700">{m.month}</td>
                          <td className="px-4 py-2.5 font-mono text-green-700">{fmt(m.inflow)}</td>
                          <td className="px-4 py-2.5 font-mono text-red-700">{fmt(m.outflow)}</td>
                          <td className={`px-4 py-2.5 font-mono font-semibold ${m.net >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(m.net)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-800 text-white">
                      <tr>
                        <td className="px-5 py-3 font-bold text-sm">الإجمالي</td>
                        <td className="px-4 py-3 font-mono font-bold text-green-300">{fmt(cashFlow.totalInflow)}</td>
                        <td className="px-4 py-3 font-mono font-bold text-red-300">{fmt(cashFlow.totalOutflow)}</td>
                        <td className={`px-4 py-3 font-mono font-bold ${cashFlow.netCashFlow >= 0 ? 'text-blue-300' : 'text-amber-300'}`}>{fmt(cashFlow.netCashFlow)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {cashFlow.months.length === 0 && (
                <div className="bg-white rounded-xl p-12 text-center shadow-sm text-slate-400">
                  لا يوجد حركات بنكية في هذه الفترة
                </div>
              )}
            </div>
          )}

          {!cashFlow && !loadingCF && (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm text-slate-400">
              اختر الفترة الزمنية واضغط "عرض التدفق"
            </div>
          )}
        </div>
      )}

      {/* ── SUPPLIER DEBT / مشتريات الموردين ── */}
      {tab === 'supplierDebt' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-center gap-3 flex-wrap no-print">
            <button onClick={loadSupplierDebt} disabled={loadingSD}
              className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <RefreshCw size={13} className={loadingSD ? 'animate-spin' : ''} /> تحديث
            </button>
            {supplierDebt && (
              <button onClick={() => exportSupplierDebtExcel(supplierDebt)}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 transition-colors">
                <Download size={13} /> تصدير Excel
              </button>
            )}
          </div>

          {loadingSD && <div className="bg-white rounded-xl p-12 text-center shadow-sm text-slate-400">جاري التحميل...</div>}

          {supplierDebt && !loadingSD && (
            <div className="space-y-4">
              <div className="bg-slate-800 text-white rounded-xl p-4 flex items-center justify-between">
                <span className="text-slate-300 text-sm">إجمالي المشتريات من الموردين</span>
                <span className="text-2xl font-bold">{fmt(supplierDebt.grandTotal)}</span>
              </div>

              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-right px-5 py-3 font-medium text-slate-600">المورد</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-600">عدد الفواتير</th>
                      <th className="text-left px-4 py-3 font-medium text-slate-600">إجمالي المشتريات</th>
                      <th className="text-center px-4 py-3 font-medium text-slate-600">النسبة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {supplierDebt.suppliers.map((s: any) => (
                      <tr key={s.supplierId ?? 'unknown'} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-800">{s.supplierName}</td>
                        <td className="px-4 py-3 text-center text-slate-600">{s.invoiceCount}</td>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-800">{fmt(s.totalAmount)}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                              <div className="bg-blue-500 rounded-full h-1.5" style={{ width: `${supplierDebt.grandTotal ? (s.totalAmount / supplierDebt.grandTotal * 100) : 0}%` }} />
                            </div>
                            <span className="text-xs text-slate-500 w-12 text-left">
                              {supplierDebt.grandTotal ? (s.totalAmount / supplierDebt.grandTotal * 100).toFixed(1) : 0}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-800 text-white">
                    <tr>
                      <td className="px-5 py-3 font-bold">الإجمالي</td>
                      <td className="px-4 py-3 text-center font-bold">{supplierDebt.suppliers.reduce((s: number, r: any) => s + r.invoiceCount, 0)}</td>
                      <td className="px-4 py-3 font-mono font-bold">{fmt(supplierDebt.grandTotal)}</td>
                      <td className="px-4 py-3 text-center font-bold">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {!supplierDebt && !loadingSD && (
            <div className="bg-white rounded-xl p-12 text-center shadow-sm text-slate-400">
              اضغط "تحديث" لعرض بيانات الموردين
            </div>
          )}
        </div>
      )}

    </div>
  )
}

function BSSection({ title, total, rows, color }: { title: string; total: number; rows: any[]; color: 'blue'|'red'|'purple' }) {
  const colors = {
    blue:   { header: 'bg-blue-600',   text: 'text-blue-700' },
    red:    { header: 'bg-red-500',    text: 'text-red-700' },
    purple: { header: 'bg-purple-600', text: 'text-purple-700' },
  }
  const c = colors[color]
  if (rows.length === 0) return null
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <div className={`${c.header} text-white px-5 py-3 flex items-center justify-between`}>
        <h3 className="font-semibold">{title}</h3>
        <span className="font-bold font-mono">{rows.reduce((s: number, r: any) => s + r.balance, 0).toFixed(2)}</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-100">
          <tr>
            <th className="text-right px-5 py-2 font-medium text-slate-500 text-xs">كود</th>
            <th className="text-right px-4 py-2 font-medium text-slate-500 text-xs">الحساب</th>
            <th className="text-left px-4 py-2 font-medium text-slate-500 text-xs">الرصيد</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {rows.map((r: any) => (
            <tr key={r.code} className="hover:bg-slate-50">
              <td className="px-5 py-2.5 text-slate-400 text-xs font-mono">{r.code}</td>
              <td className="px-4 py-2.5 text-slate-700">{r.name}</td>
              <td className={`px-4 py-2.5 font-mono font-semibold ${c.text}`}>{r.balance.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── مساعدات قائمة الدخل ────────────────────────────────────────────────────
function IncomeSection({ title, color, children }: {
  title: string; color: 'blue' | 'orange' | 'red'; children: React.ReactNode
}) {
  const colors = {
    blue:   'text-blue-700 bg-blue-50 border-blue-100',
    orange: 'text-orange-700 bg-orange-50 border-orange-100',
    red:    'text-red-700 bg-red-50 border-red-100',
  }
  return (
    <div>
      <div className={`px-6 py-2 font-semibold text-sm border-b ${colors[color]}`}>{title}</div>
      {children}
    </div>
  )
}

function IncomeRow({ label, value, indent, negative, subtotal, total, highlight }: {
  label: string; value: number
  indent?: boolean; negative?: boolean; subtotal?: boolean; total?: boolean
  highlight?: 'blue' | 'red'
}) {
  const isNeg = value < 0
  const bg = total
    ? highlight === 'blue' ? 'bg-blue-600 text-white' : highlight === 'red' ? 'bg-red-50' : 'bg-slate-100'
    : subtotal ? 'bg-slate-50' : ''
  const textColor = total && highlight === 'blue'
    ? 'text-white'
    : isNeg ? 'text-red-600' : 'text-slate-800'

  return (
    <div className={`flex justify-between items-center px-6 py-2 ${bg} ${subtotal || total ? 'border-t border-slate-100' : ''}`}>
      <span className={`${indent ? 'pr-4' : ''} ${subtotal ? 'font-semibold text-slate-700' : ''} ${total ? 'font-bold ' + (highlight === 'blue' ? 'text-white' : 'text-slate-800') : 'text-slate-600'}`}>
        {label}
      </span>
      <span className={`font-mono font-semibold ${textColor} ${total ? 'text-base' : ''}`}>
        {value < 0 ? `(${fmt(Math.abs(value))})` : fmt(value)} ج
      </span>
    </div>
  )
}

function exportIncomeExcel(stmt: IncomeStatement) {
  const rows: (string | number)[][] = [
    ['قائمة الدخل', '', ''],
    [`الفترة: من ${stmt.period.from} إلى ${stmt.period.to} (${stmt.period.days} يوم)`, '', ''],
    ['', '', ''],
    ['الإيرادات', '', ''],
    ['  إيرادات POS', '', stmt.revenue.pos],
    ['  مبيعات يدوية', '', stmt.revenue.manual],
    ['  إجمالي الإيرادات', '', stmt.revenue.total],
    ['  (-) خصومات', '', -stmt.revenue.discounts],
    ['  (-) عمولات توصيل', '', -stmt.revenue.commissions],
    ['= صافي الإيرادات', '', stmt.revenue.net],
    ['', '', ''],
    ['تكلفة البضاعة المباعة (COGS)', '', ''],
    ['  تكلفة المواد المستهلكة', '', -stmt.cogs],
    ['  تكلفة الهدر', '', -stmt.wasteValue],
    ['= مجمل الربح', `هامش ${stmt.grossMargin.toFixed(1)}%`, stmt.grossProfit],
    ['', '', ''],
    ['مصاريف التشغيل — مباشرة', '', ''],
    ...stmt.expenses.direct.map(e => [`  ${e.name}`, `شهري: ${e.monthlyAmount}`, -e.periodAmount]),
    ['  إجمالي المباشرة', '', -stmt.expenses.totalDirect],
    ['', '', ''],
    ['مصاريف التشغيل — غير مباشرة', '', ''],
    ...stmt.expenses.indirect.map(e => [`  ${e.name}`, `شهري: ${e.monthlyAmount}`, -e.periodAmount]),
    ['  إجمالي غير المباشرة', '', -stmt.expenses.totalIndirect],
    ['= إجمالي المصاريف', '', -stmt.expenses.total],
    ['', '', ''],
    ['= صافي الربح التشغيلي', `هامش ${stmt.netMargin.toFixed(1)}%`, stmt.operatingProfit],
  ]
  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [{ wch: 38 }, { wch: 18 }, { wch: 16 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'قائمة الدخل')
  XLSX.writeFile(wb, `income-statement-${stmt.period.from}-${stmt.period.to}.xlsx`)
}

function exportTrialBalanceExcel(tb: TrialBalance, range: { from: string; to: string }) {
  const headers = ['رقم الحساب', 'اسم الحساب', 'نوع الحساب', 'إجمالي المدين', 'إجمالي الدائن', 'رصيد مدين', 'رصيد دائن']
  const typeLabel = (t: string) => t === 'asset' ? 'أصول' : t === 'liability' ? 'خصوم' : t === 'equity' ? 'حقوق ملكية' : t === 'revenue' ? 'إيرادات' : 'مصاريف'
  const rows = tb.rows.map(r => [
    r.code, r.name, typeLabel(r.type),
    r.totalDebit  > 0 ? r.totalDebit  : '',
    r.totalCredit > 0 ? r.totalCredit : '',
    r.debitBalance  > 0 ? r.debitBalance  : '',
    r.creditBalance > 0 ? r.creditBalance : '',
  ])
  rows.push(['الإجمالي', '', '', tb.sumDebitTx, tb.sumCreditTx, tb.sumDebitBal, tb.sumCreditBal])
  const ws = XLSX.utils.aoa_to_sheet([
    [`ميزان المراجعة — من ${range.from} إلى ${range.to}`],
    [],
    headers,
    ...rows,
  ])
  ws['!cols'] = [12, 30, 14, 16, 16, 16, 16].map(wch => ({ wch }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'ميزان المراجعة')
  XLSX.writeFile(wb, `trial-balance-${range.from}-${range.to}.xlsx`)
}

function SummaryCard({ label, value, color, alert }: {
  label: string; value: number; color: 'blue' | 'green' | 'amber'; alert?: boolean
}) {
  const colors = { blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700', amber: 'bg-amber-50 text-amber-700' }
  return (
    <div className={`rounded-xl p-5 ${colors[color]} ${alert && value > 0 ? 'ring-2 ring-amber-400' : ''}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm mt-1 opacity-80">{label}</p>
    </div>
  )
}
