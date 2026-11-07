import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'

interface SimpleUser { id: number; name: string; role: string }

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sz = size === 'lg' ? 'w-16 h-16 text-2xl' : size === 'sm' ? 'w-8 h-8 text-sm' : 'w-12 h-12 text-lg'
  return (
    <div className={`${sz} bg-blue-600 rounded-full flex items-center justify-center font-bold text-white flex-shrink-0`}>
      {name[0]}
    </div>
  )
}

function FirstSetup({ onCreated }: { onCreated: () => void }) {
  const [name, setName]       = useState('')
  const [pin, setPin]         = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError]     = useState('')
  const [saving, setSaving]   = useState(false)

  async function create() {
    if (!name.trim())           return setError('الاسم مطلوب')
    if (!/^\d{4}$/.test(pin))   return setError('رقم الدخول يجب أن يكون 4 أرقام')
    if (pin !== confirm)        return setError('رقما الدخول غير متطابقين')
    setSaving(true)
    try {
      await window.api.auth.create({ name: name.trim(), pin, role: 'مدير النظام' })
      onCreated()
    } catch (e: any) { setError(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Enter') create()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [name, pin, confirm, saving])

  return (
    <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm">
      <h2 className="text-white font-bold text-xl mb-1">إعداد المدير الأول</h2>
      <p className="text-slate-400 text-sm mb-6">أنشئ حساب مدير النظام للبدء</p>

      {error && <p className="text-red-400 bg-red-900/30 rounded-lg px-3 py-2 text-sm mb-4">{error}</p>}

      <div className="space-y-4">
        <div>
          <label className="text-slate-400 text-sm block mb-1">الاسم</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="اسم المدير"
            autoFocus
            className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-slate-400 text-sm block mb-1">رقم الدخول (4 أرقام)</label>
          <input value={pin} onChange={e => setPin(e.target.value.replace(/\D/g,'').slice(0,4))}
            type="password" maxLength={4} placeholder="• • • •"
            className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-xl" />
        </div>
        <div>
          <label className="text-slate-400 text-sm block mb-1">تأكيد رقم الدخول</label>
          <input value={confirm} onChange={e => setConfirm(e.target.value.replace(/\D/g,'').slice(0,4))}
            type="password" maxLength={4} placeholder="• • • •"
            className="w-full bg-slate-700 text-white rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-xl" />
        </div>
        <button onClick={create} disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 font-semibold transition-colors disabled:opacity-50">
          {saving ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
        </button>
      </div>
    </div>
  )
}

export function PinPadUI({
  userName, userRole, onBack, backLabel = 'تغيير المستخدم',
  onSubmitPin,
}: {
  userName: string
  userRole?: string
  onBack: () => void
  backLabel?: string
  onSubmitPin: (pin: string) => Promise<boolean>
}) {
  const [pin, setPin]       = useState('')
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake]   = useState(false)

  // refs to avoid stale closures in keyboard handler
  const pinRef     = useRef(pin)
  const loadingRef = useRef(loading)
  useEffect(() => { pinRef.current = pin },         [pin])
  useEffect(() => { loadingRef.current = loading }, [loading])

  async function submit(p: string) {
    if (p.length < 4 || loadingRef.current) return
    setLoading(true)
    const ok = await onSubmitPin(p)
    setLoading(false)
    if (!ok) {
      setError('رقم الدخول غير صحيح')
      setPin('')
      setShake(true)
    }
  }

  function press(d: string) {
    if (pinRef.current.length >= 4 || loadingRef.current) return
    const next = pinRef.current + d
    setPin(next)
    setError('')
    if (next.length === 4) submit(next)
  }

  function backspace() {
    setPin(p => p.slice(0, -1))
    setError('')
  }

  // دعم لوحة المفاتيح: أرقام + Backspace + Enter
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (loadingRef.current) return
      if (e.key >= '0' && e.key <= '9') {
        press(e.key)
      } else if (e.key === 'Backspace') {
        backspace()
      } else if (e.key === 'Enter') {
        const p = pinRef.current
        if (p.length === 4) submit(p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // استخدام refs فقط داخل الـ handler

  const keys = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="bg-slate-800 rounded-2xl p-8 w-full max-w-sm">
      <button onClick={onBack} className="text-slate-400 hover:text-white text-sm mb-6 flex items-center gap-2 transition-colors">
        ← {backLabel}
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-2xl font-bold text-white flex-shrink-0">
          {userName[0]}
        </div>
        <div>
          <div className="text-white font-semibold text-lg">{userName}</div>
          {userRole && <div className="text-slate-400 text-sm">{userRole}</div>}
        </div>
      </div>

      {/* نقاط الـ PIN مع تأثير الاهتزاز */}
      <div
        className={`flex justify-center gap-4 mb-2 ${shake ? 'shake' : ''}`}
        onAnimationEnd={() => setShake(false)}
      >
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
            i < pin.length
              ? error
                ? 'bg-red-500 border-red-500 scale-110'
                : 'bg-blue-500 border-blue-500 scale-110'
              : 'border-slate-500'
          }`} />
        ))}
      </div>

      <div className="h-6 text-center mb-2">
        {error
          ? <p className="text-red-400 text-sm">{error}</p>
          : <p className="text-slate-600 text-xs">أرقام لوحة المفاتيح • Backspace • Enter</p>
        }
      </div>

      <div className="grid grid-cols-3 gap-3 mt-2">
        {keys.map((k, i) => (
          <button key={i}
            onClick={() => k === '⌫' ? backspace() : k ? press(k) : undefined}
            disabled={!k || loading}
            className={`h-14 rounded-xl text-xl font-semibold transition-all active:scale-95 select-none ${
              !k ? 'opacity-0 pointer-events-none' :
              k === '⌫' ? 'bg-slate-600 text-slate-300 hover:bg-slate-500 active:bg-slate-400' :
              'bg-slate-700 text-white hover:bg-slate-600 active:bg-slate-500'
            }`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

function UserList({ users, onSelect }: { users: SimpleUser[]; onSelect: (u: SimpleUser) => void }) {
  const [focused, setFocused] = useState(0)

  // تنقل لوحة المفاتيح في قائمة المستخدمين
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocused(i => (i + 1) % users.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocused(i => (i - 1 + users.length) % users.length)
      } else if (e.key === 'Enter') {
        onSelect(users[focused])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [focused, users, onSelect])

  return (
    <div className="w-full max-w-sm space-y-2">
      {users.map((u, i) => (
        <button key={u.id} onClick={() => onSelect(u)}
          className={`w-full rounded-xl p-4 flex items-center gap-4 transition-all text-white text-right ${
            i === focused
              ? 'bg-slate-700 ring-2 ring-blue-500 shadow-lg'
              : 'bg-slate-800 hover:bg-slate-700'
          }`}
        >
          <Avatar name={u.name} />
          <div>
            <div className="font-semibold">{u.name}</div>
            {u.role && <div className="text-slate-400 text-sm">{u.role}</div>}
          </div>
        </button>
      ))}
      <p className="text-slate-600 text-xs text-center pt-2">
        ↑ ↓ للتنقل &nbsp;•&nbsp; Enter للاختيار
      </p>
    </div>
  )
}

export default function Login() {
  const [users, setUsers]       = useState<SimpleUser[]>([])
  const [selected, setSelected] = useState<SimpleUser | null>(null)
  const [loading, setLoading]   = useState(true)
  const [setup, setSetup]       = useState(false)
  const { login }               = useAuth()
  const { settings }            = useSettings()

  async function loadUsers() {
    setLoading(true)
    const list = await window.api.auth.listUsers()
    setUsers(list)
    setLoading(false)
    if (list.length === 0) {
      setSetup(true)
    } else {
      // استعادة آخر مستخدم مختار
      try {
        const lastId = parseInt(localStorage.getItem('_lastUserId') || '0')
        if (lastId) {
          const found = list.find(u => u.id === lastId)
          if (found) setSelected(found)
        }
      } catch {}
    }
  }

  useEffect(() => { loadUsers() }, [])

  function selectUser(u: SimpleUser) {
    setSelected(u)
    localStorage.setItem('_lastUserId', String(u.id))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-slate-400">جاري التحميل...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white">{settings.restaurantName}</h1>
        <p className="text-slate-400 mt-2 text-sm">
          {setup ? 'مرحباً! قم بإعداد النظام أولاً' : 'اختر اسمك وأدخل رقم الدخول'}
        </p>
      </div>

      {setup ? (
        <FirstSetup onCreated={() => { setSetup(false); loadUsers() }} />
      ) : selected ? (
        <PinPadUI
          userName={selected.name}
          userRole={selected.role}
          onBack={() => setSelected(null)}
          onSubmitPin={pin => login(selected.id, pin)}
        />
      ) : (
        <UserList users={users} onSelect={selectUser} />
      )}
    </div>
  )
}
