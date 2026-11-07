import { useState, useEffect } from 'react'
import {
  Save, HardDrive, CheckCircle, RefreshCw,
  FolderOpen, Settings2, Clock, ToggleLeft, ToggleRight,
} from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'

// ─── قسم الإعدادات العامة ──────────────────────────────────────────────────
function GeneralSettings() {
  const { settings, setSetting } = useSettings()
  const [form, setForm] = useState({
    restaurantName: settings.restaurantName,
    currency:       settings.currency,
    taxRate:        settings.taxRate,
    loyaltyPointsPerCurrency: settings.loyaltyPointsPerCurrency ?? '0',
  })
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)

  // مزامنة إذا تغيرت الإعدادات من الخارج
  useEffect(() => {
    setForm({
      restaurantName: settings.restaurantName,
      currency:       settings.currency,
      taxRate:        settings.taxRate,
      loyaltyPointsPerCurrency: settings.loyaltyPointsPerCurrency ?? '0',
    })
  }, [settings.restaurantName, settings.currency, settings.taxRate, settings.loyaltyPointsPerCurrency])

  function setField(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    await setSetting('restaurantName', form.restaurantName)
    await setSetting('currency',       form.currency)
    await setSetting('taxRate',        form.taxRate)
    await setSetting('loyaltyPointsPerCurrency', form.loyaltyPointsPerCurrency)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-5">
        <Settings2 size={18} className="text-slate-500" />
        <h2 className="font-semibold text-slate-700 text-lg">الإعدادات العامة</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">اسم المطعم</label>
          <input
            value={form.restaurantName}
            onChange={e => setField('restaurantName', e.target.value)}
            placeholder="اسم المطعم"
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">رمز العملة</label>
            <input
              value={form.currency}
              onChange={e => setField('currency', e.target.value)}
              placeholder="ج.م"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-slate-400 text-xs mt-1">يظهر بجانب الأسعار في التقارير</p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">نسبة الضريبة (%)</label>
            <input
              value={form.taxRate}
              onChange={e => setField('taxRate', e.target.value.replace(/[^0-9.]/g, ''))}
              placeholder="0"
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-slate-400 text-xs mt-1">الضريبة الافتراضية للفواتير</p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 block mb-1.5">نقاط الولاء (اختياري)</label>
          <input
            value={form.loyaltyPointsPerCurrency}
            onChange={e => setField('loyaltyPointsPerCurrency', e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-slate-400 text-xs mt-1">
            كل كم {form.currency || 'وحدة عملة'} من فاتورة نقطة البيع = نقطة ولاء واحدة تُضاف تلقائياً للعميل. اتركها 0 لإيقاف التراكم التلقائي (يبقى التعديل اليدوي متاحاً من صفحة العملاء).
          </p>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-6 flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium text-sm"
      >
        {saved
          ? <><CheckCircle size={15} /> تم الحفظ</>
          : <><Save size={15} /> {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</>
        }
      </button>
    </section>
  )
}

// ─── قسم النسخ الاحتياطي اليدوي ────────────────────────────────────────────
function ManualBackup() {
  const [loading,         setLoading]         = useState(false)
  const [restoreLoading,  setRestoreLoading]  = useState(false)
  const [msg,             setMsg]             = useState('')

  async function backup() {
    setLoading(true)
    setMsg('')
    const p = await window.api.backup.create()
    setLoading(false)
    if (p) setMsg(`تم الحفظ في: ${p}`)
    else    setMsg('تم الإلغاء')
  }

  async function restore() {
    if (!confirm('سيتم استبدال قاعدة البيانات الحالية بملف النسخة الاحتياطية. هل أنت متأكد؟')) return
    setRestoreLoading(true)
    setMsg('')
    const p = await window.api.backup.restore()
    setRestoreLoading(false)
    if (p) setMsg(`تمت الاستعادة من: ${p} — أعد تشغيل البرنامج`)
    else    setMsg('تم الإلغاء')
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-2">
        <HardDrive size={18} className="text-slate-500" />
        <h2 className="font-semibold text-slate-700 text-lg">النسخ الاحتياطي</h2>
      </div>
      <p className="text-slate-500 text-sm mb-5">
        احفظ نسخة كاملة من قاعدة البيانات أو استعد نسخة سابقة
      </p>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={backup}
          disabled={loading}
          className="flex items-center gap-2 bg-slate-700 text-white px-6 py-2.5 rounded-xl hover:bg-slate-800 disabled:opacity-50 transition-colors font-medium text-sm"
        >
          <HardDrive size={15} />
          {loading ? 'جاري الحفظ...' : 'إنشاء نسخة احتياطية'}
        </button>

        <button
          onClick={restore}
          disabled={restoreLoading}
          className="flex items-center gap-2 bg-amber-600 text-white px-6 py-2.5 rounded-xl hover:bg-amber-700 disabled:opacity-50 transition-colors font-medium text-sm"
        >
          <RefreshCw size={15} />
          {restoreLoading ? 'جاري الاستعادة...' : 'استعادة من نسخة احتياطية'}
        </button>
      </div>

      {msg && (
        <p className={`mt-3 text-sm flex items-center gap-1.5 ${msg.startsWith('تم الحفظ') || msg.startsWith('تمت') ? 'text-green-600' : 'text-slate-400'}`}>
          {(msg.startsWith('تم الحفظ') || msg.startsWith('تمت')) && <CheckCircle size={14} />}
          {msg}
        </p>
      )}
    </section>
  )
}

// ─── قسم النسخ الاحتياطي التلقائي ─────────────────────────────────────────
function AutoBackup() {
  const { settings, setSetting } = useSettings()

  const enabled  = settings.autoBackupEnabled  === 'true'
  const interval = settings.autoBackupInterval || 'daily'
  const path     = settings.autoBackupPath     || ''
  const lastRun  = settings.autoBackupLastRun  || ''

  async function toggleEnabled() {
    await setSetting('autoBackupEnabled', enabled ? 'false' : 'true')
  }

  async function changeInterval(v: string) {
    await setSetting('autoBackupInterval', v)
  }

  async function selectFolder() {
    const p = await window.api.backup.selectFolder()
    if (p) await setSetting('autoBackupPath', p)
  }

  return (
    <section className="bg-white rounded-2xl shadow-sm p-6">
      <div className="flex items-center gap-2 mb-2">
        <RefreshCw size={18} className="text-slate-500" />
        <h2 className="font-semibold text-slate-700 text-lg">النسخ الاحتياطي التلقائي</h2>
      </div>
      <p className="text-slate-500 text-sm mb-5">
        يحفظ نسخة تلقائياً في مجلد محدد حسب الجدول الذي تختاره — كل إعداد يُحفظ فوراً
      </p>

      {/* تفعيل / إيقاف */}
      <div
        onClick={toggleEnabled}
        className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors mb-4 select-none"
      >
        <div>
          <div className="text-sm font-medium text-slate-800">تفعيل النسخ التلقائي</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {enabled ? 'مفعّل — سينسخ تلقائياً عند تشغيل البرنامج' : 'غير مفعّل'}
          </div>
        </div>
        {enabled
          ? <ToggleRight size={28} className="text-blue-600" />
          : <ToggleLeft  size={28} className="text-slate-400" />
        }
      </div>

      {enabled && (
        <div className="space-y-4">
          {/* التكرار */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
              <Clock size={14} className="text-slate-400" /> التكرار
            </label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'daily',  label: 'يومي',    sub: 'كل 24 ساعة' },
                { value: 'weekly', label: 'أسبوعي',  sub: 'كل 7 أيام'  },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => changeInterval(opt.value)}
                  className={`p-3 rounded-xl border-2 text-right transition-all ${
                    interval === opt.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className={`font-semibold text-sm ${interval === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>
                    {opt.label}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{opt.sub}</div>
                </button>
              ))}
            </div>
          </div>

          {/* مجلد الحفظ */}
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-slate-700 mb-1.5">
              <FolderOpen size={14} className="text-slate-400" /> مجلد الحفظ
            </label>
            <div className="flex gap-2">
              <div className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm bg-slate-50 text-slate-600 truncate">
                {path || <span className="text-slate-400">لم يتم اختيار مجلد بعد</span>}
              </div>
              <button
                onClick={selectFolder}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 text-sm font-medium transition-colors whitespace-nowrap"
              >
                <FolderOpen size={14} /> تصفح
              </button>
            </div>
          </div>

          {/* آخر نسخة */}
          {lastRun && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl">
              <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
              <p className="text-xs text-green-700">
                آخر نسخة: {new Date(lastRun).toLocaleString('ar-EG')}
              </p>
            </div>
          )}

          {/* تحذير إذا لم يتم اختيار مجلد */}
          {!path && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
              اختر مجلد الحفظ لتفعيل النسخ التلقائي
            </p>
          )}
        </div>
      )}
    </section>
  )
}

// ─── الصفحة الرئيسية ────────────────────────────────────────────────────────
export default function Settings() {
  return (
    <div className="p-6 max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-slate-800">الإعدادات</h1>
      <GeneralSettings />
      <ManualBackup />
      <AutoBackup />
    </div>
  )
}
