import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, ArrowUpDown, Landmark, Wallet, HandCoins,
         ArrowUpCircle, ArrowDownCircle, X } from 'lucide-react'
import type { BankAccount, BankTransaction, ChartOfAccount } from '../types'
import { inputCls, Modal, Field, DeleteConfirm, SaveCancelButtons } from '../components/ui'

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  bank:    { label: 'حساب بنكي',  icon: Landmark,  color: 'bg-blue-50 border-blue-200 text-blue-700' },
  custody: { label: 'عهدة نقدية', icon: HandCoins, color: 'bg-amber-50 border-amber-200 text-amber-700' },
  cash:    { label: 'صندوق نقدي', icon: Wallet,    color: 'bg-green-50 border-green-200 text-green-700' },
}

const fmt = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const EMPTY_ACCOUNT = { name: '', type: 'bank' as BankAccount['type'], bankName: '', accountNumber: '', balance: 0, currency: 'EGP', linkedAccountCode: '', notes: '' }
const EMPTY_TX      = { date: today(), type: 'credit' as 'credit' | 'debit', amount: 0, description: '', contraAccountCode: '', reference: '', notes: '' }

export default function Banks() {
  const [accounts,  setAccounts]  = useState<BankAccount[]>([])
  const [coaList,   setCoaList]   = useState<ChartOfAccount[]>([])
  const [loading,   setLoading]   = useState(true)
  const [selected, setSelected]   = useState<BankAccount | null>(null)
  const [txList,   setTxList]     = useState<BankTransaction[]>([])
  const [txLoading, setTxLoading] = useState(false)

  const [showAccModal, setShowAccModal] = useState(false)
  const [editingAcc, setEditingAcc]     = useState<BankAccount | null>(null)
  const [accForm, setAccForm]           = useState({ ...EMPTY_ACCOUNT })
  const [savingAcc, setSavingAcc]       = useState(false)
  const [deleteAccId, setDeleteAccId]   = useState<number | null>(null)

  const [showTxModal, setShowTxModal] = useState(false)
  const [txForm, setTxForm]           = useState({ ...EMPTY_TX })
  const [savingTx, setSavingTx]       = useState(false)
  const [deleteTxId, setDeleteTxId]   = useState<number | null>(null)

  async function loadAccounts() {
    setLoading(true)
    const data = await window.api.banks.getAll()
    setAccounts(data)
    if (selected) {
      const refreshed = data.find(a => a.id === selected.id)
      if (refreshed) setSelected(refreshed)
    }
    setLoading(false)
  }

  async function loadTx(acc: BankAccount) {
    setSelected(acc)
    setTxLoading(true)
    const data = await window.api.banks.getTransactions(acc.id)
    setTxList(data)
    setTxLoading(false)
  }

  useEffect(() => {
    loadAccounts()
    window.api.accounts.getAll().then(all => setCoaList(all.filter(a => a.subType !== 'header' && a.isActive)))
  }, [])

  // ── حسابات ──
  function openAddAcc() {
    setEditingAcc(null)
    setAccForm({ ...EMPTY_ACCOUNT })
    setShowAccModal(true)
  }
  function openEditAcc(a: BankAccount) {
    setEditingAcc(a)
    setAccForm({ name: a.name, type: a.type, bankName: a.bankName ?? '', accountNumber: a.accountNumber ?? '', balance: a.balance, currency: a.currency, linkedAccountCode: a.linkedAccountCode ?? '', notes: a.notes ?? '' })
    setShowAccModal(true)
  }
  async function saveAcc(ev: React.FormEvent) {
    ev.preventDefault()
    setSavingAcc(true)
    try {
      if (editingAcc) await window.api.banks.update({ id: editingAcc.id, ...accForm })
      else            await window.api.banks.create(accForm)
      setShowAccModal(false)
      loadAccounts()
    } finally { setSavingAcc(false) }
  }
  async function delAcc() {
    if (!deleteAccId) return
    await window.api.banks.delete(deleteAccId)
    if (selected?.id === deleteAccId) { setSelected(null); setTxList([]) }
    setDeleteAccId(null)
    loadAccounts()
  }

  // ── حركات ──
  function openAddTx() {
    setTxForm({ ...EMPTY_TX, date: today() })
    setShowTxModal(true)
  }
  async function saveTx(ev: React.FormEvent) {
    ev.preventDefault()
    if (!selected) return
    setSavingTx(true)
    try {
      await window.api.banks.addTransaction({ bankAccountId: selected.id, ...txForm })
      setShowTxModal(false)
      await loadAccounts()
      await loadTx({ ...selected })
    } finally { setSavingTx(false) }
  }
  async function delTx() {
    if (!deleteTxId) return
    await window.api.banks.deleteTransaction(deleteTxId)
    setDeleteTxId(null)
    await loadAccounts()
    if (selected) await loadTx(selected)
  }

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">البنوك والعهد</h1>
          <p className="text-slate-400 text-sm mt-0.5">إدارة الحسابات البنكية والعهد النقدية وحركاتها</p>
        </div>
        <button onClick={openAddAcc}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 font-medium text-sm">
          <Plus size={16} /> إضافة حساب
        </button>
      </div>

      {/* إجمالي الأرصدة */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 col-span-1">
          <p className="text-xs text-slate-400 mb-1">إجمالي الأرصدة</p>
          <p className="text-2xl font-bold text-slate-800 font-mono">{fmt(totalBalance)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{accounts.length} حساب</p>
        </div>
        {(['bank', 'custody', 'cash'] as const).map(t => {
          const sum = accounts.filter(a => a.type === t).reduce((s, a) => s + a.balance, 0)
          const meta = TYPE_META[t]
          const Icon = meta.icon
          return (
            <div key={t} className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} className="text-slate-400" />
                <p className="text-xs text-slate-400">{meta.label}</p>
              </div>
              <p className="text-xl font-bold text-slate-700 font-mono">{fmt(sum)}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* قائمة الحسابات */}
        <div className="col-span-4 space-y-2">
          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">جاري التحميل...</div>
          ) : accounts.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <Landmark size={36} className="text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">لا يوجد حسابات</p>
              <button onClick={openAddAcc} className="mt-2 text-blue-600 text-sm hover:underline">إضافة أول حساب</button>
            </div>
          ) : accounts.map(a => {
            const meta = TYPE_META[a.type]
            const Icon = meta.icon
            const isActive = selected?.id === a.id
            return (
              <div key={a.id}
                onClick={() => loadTx(a)}
                className={`bg-white rounded-xl p-4 cursor-pointer transition-all border-2 ${
                  isActive ? 'border-blue-500 shadow-md' : 'border-transparent shadow-sm hover:shadow-md'
                }`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg border ${meta.color}`}>
                      <Icon size={15} />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 text-sm">{a.name}</p>
                      <p className="text-xs text-slate-400">{meta.label}{a.bankName ? ` — ${a.bankName}` : ''}</p>
                      {a.accountNumber && <p className="text-xs text-slate-400 font-mono">{a.accountNumber}</p>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={e => { e.stopPropagation(); openEditAcc(a) }}
                      className="p-1.5 text-blue-400 hover:bg-blue-50 rounded-lg">
                      <Edit2 size={12} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setDeleteAccId(a.id) }}
                      className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">الرصيد</span>
                  <span className={`font-mono font-bold text-sm ${a.balance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                    {fmt(a.balance)} {a.currency}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* حركات الحساب المختار */}
        <div className="col-span-8">
          {!selected ? (
            <div className="bg-white rounded-xl h-full flex items-center justify-center text-slate-400">
              <div className="text-center">
                <ArrowUpDown size={32} className="mx-auto mb-2 text-slate-200" />
                <p className="text-sm">اختر حساباً لعرض حركاته</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-800">{selected.name}</h2>
                  <p className="text-sm text-slate-400">
                    الرصيد الحالي: <span className={`font-mono font-bold ${selected.balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {fmt(selected.balance)} {selected.currency}
                    </span>
                  </p>
                </div>
                <button onClick={openAddTx}
                  className="flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded-xl hover:bg-blue-700 text-sm font-medium">
                  <Plus size={14} /> إضافة حركة
                </button>
              </div>

              {txLoading ? (
                <div className="text-center py-10 text-slate-400 text-sm">جاري التحميل...</div>
              ) : txList.length === 0 ? (
                <div className="text-center py-14">
                  <ArrowUpDown size={32} className="text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">لا توجد حركات على هذا الحساب</p>
                  <button onClick={openAddTx} className="mt-2 text-blue-600 text-sm hover:underline">إضافة أول حركة</button>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      {['التاريخ', 'البيان', 'المرجع', 'دائن ↑', 'مدين ↓', ''].map(h => (
                        <th key={h} className="text-right px-4 py-3 text-xs font-semibold text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {txList.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                          {new Date(tx.date).toISOString().slice(0, 10)}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-800">{tx.description}</td>
                        <td className="px-4 py-3 text-xs text-slate-400">{tx.reference ?? '—'}</td>
                        <td className="px-4 py-3 font-mono text-sm">
                          {tx.type === 'credit' ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <ArrowUpCircle size={13} /> {fmt(tx.amount)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-sm">
                          {tx.type === 'debit' ? (
                            <span className="text-red-500 flex items-center gap-1">
                              <ArrowDownCircle size={13} /> {fmt(tx.amount)}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => setDeleteTxId(tx.id)}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                            <X size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal حساب */}
      {showAccModal && (
        <Modal title={editingAcc ? 'تعديل حساب' : 'إضافة حساب جديد'} onClose={() => setShowAccModal(false)}>
          <form onSubmit={saveAcc} className="space-y-4">
            <Field label="اسم الحساب">
              <input required value={accForm.name}
                onChange={e => setAccForm(f => ({ ...f, name: e.target.value }))}
                placeholder="مثال: حساب البنك الأهلي" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="نوع الحساب">
                <select value={accForm.type}
                  onChange={e => setAccForm(f => ({ ...f, type: e.target.value as any }))}
                  className={inputCls}>
                  <option value="bank">حساب بنكي</option>
                  <option value="custody">عهدة نقدية</option>
                  <option value="cash">صندوق نقدي</option>
                </select>
              </Field>
              <Field label="العملة">
                <select value={accForm.currency}
                  onChange={e => setAccForm(f => ({ ...f, currency: e.target.value }))}
                  className={inputCls}>
                  <option value="EGP">جنيه مصري (EGP)</option>
                  <option value="USD">دولار (USD)</option>
                  <option value="SAR">ريال سعودي (SAR)</option>
                  <option value="AED">درهم (AED)</option>
                </select>
              </Field>
            </div>
            {accForm.type === 'bank' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="اسم البنك">
                  <input value={accForm.bankName}
                    onChange={e => setAccForm(f => ({ ...f, bankName: e.target.value }))}
                    placeholder="مثال: البنك الأهلي" className={inputCls} />
                </Field>
                <Field label="رقم الحساب / IBAN">
                  <input value={accForm.accountNumber}
                    onChange={e => setAccForm(f => ({ ...f, accountNumber: e.target.value }))}
                    className={inputCls} />
                </Field>
              </div>
            )}
            {!editingAcc && (
              <Field label="الرصيد الافتتاحي">
                <input type="number" step="0.01" value={accForm.balance || ''}
                  onChange={e => setAccForm(f => ({ ...f, balance: +e.target.value }))}
                  placeholder="0.00" className={inputCls} />
              </Field>
            )}
            <Field label="الحساب في دليل الحسابات (اختياري)">
              <select value={accForm.linkedAccountCode}
                onChange={e => setAccForm(f => ({ ...f, linkedAccountCode: e.target.value }))}
                className={inputCls}>
                <option value="">— بدون ربط —</option>
                {coaList.map(a => (
                  <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                ))}
              </select>
            </Field>
            <Field label="ملاحظات (اختياري)">
              <input value={accForm.notes}
                onChange={e => setAccForm(f => ({ ...f, notes: e.target.value }))}
                className={inputCls} />
            </Field>
            <SaveCancelButtons saving={savingAcc} onCancel={() => setShowAccModal(false)} />
          </form>
        </Modal>
      )}

      {/* Modal حركة */}
      {showTxModal && (
        <Modal title="إضافة حركة مالية" onClose={() => setShowTxModal(false)}>
          <form onSubmit={saveTx} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="التاريخ">
                <input type="date" required value={txForm.date}
                  onChange={e => setTxForm(f => ({ ...f, date: e.target.value }))}
                  className={inputCls} />
              </Field>
              <Field label="نوع الحركة">
                <select value={txForm.type}
                  onChange={e => setTxForm(f => ({ ...f, type: e.target.value as any }))}
                  className={inputCls}>
                  <option value="credit">إيداع / دائن ↑</option>
                  <option value="debit">سحب / مدين ↓</option>
                </select>
              </Field>
            </div>
            <Field label="المبلغ">
              <input type="number" required min="0.01" step="0.01" value={txForm.amount || ''}
                onChange={e => setTxForm(f => ({ ...f, amount: +e.target.value }))}
                placeholder="0.00" className={inputCls} />
            </Field>
            <Field label="البيان / الوصف">
              <input required value={txForm.description}
                onChange={e => setTxForm(f => ({ ...f, description: e.target.value }))}
                placeholder="مثال: إيداع مبيعات اليوم" className={inputCls} />
            </Field>
            <Field label="الحساب المقابل (للقيد المزدوج — اختياري)">
              <select value={txForm.contraAccountCode}
                onChange={e => setTxForm(f => ({ ...f, contraAccountCode: e.target.value }))}
                className={inputCls}>
                <option value="">— بدون قيد مزدوج —</option>
                {coaList.map(a => (
                  <option key={a.code} value={a.code}>{a.code} — {a.name}</option>
                ))}
              </select>
            </Field>
            <Field label="رقم المرجع (اختياري)">
              <input value={txForm.reference}
                onChange={e => setTxForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="رقم الشيك أو الحوالة..." className={inputCls} />
            </Field>
            <Field label="ملاحظات (اختياري)">
              <input value={txForm.notes}
                onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))}
                className={inputCls} />
            </Field>
            <SaveCancelButtons saving={savingTx} onCancel={() => setShowTxModal(false)} />
          </form>
        </Modal>
      )}

      {deleteAccId !== null && (
        <DeleteConfirm message="حذف الحساب سيحذف جميع حركاته. هل أنت متأكد؟" onConfirm={delAcc} onCancel={() => setDeleteAccId(null)} />
      )}
      {deleteTxId !== null && (
        <DeleteConfirm message="هل تريد حذف هذه الحركة؟ سيتم عكس أثرها على الرصيد." onConfirm={delTx} onCancel={() => setDeleteTxId(null)} />
      )}
    </div>
  )
}
