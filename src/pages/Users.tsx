import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, ToggleLeft, ToggleRight, ShieldCheck } from 'lucide-react'
import type { User, Role } from '../types'
import { useAuth } from '../contexts/AuthContext'

interface FormData { name: string; pin: string; confirmPin: string; role: string }
const emptyForm: FormData = { name: '', pin: '', confirmPin: '', role: '' }

function UserModal({
  initial, roles, onSave, onClose, isEdit,
}: {
  initial?: User; roles: Role[]; onSave: () => void; onClose: () => void; isEdit?: boolean
}) {
  const [form, setForm] = useState<FormData>(
    initial
      ? { name: initial.name, pin: '', confirmPin: '', role: initial.role }
      : { ...emptyForm, role: roles[0]?.name ?? '' }
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function set(k: keyof FormData, v: string) { setForm(f => ({ ...f, [k]: v })); setError('') }

  async function save() {
    if (!form.name.trim()) return setError('الاسم مطلوب')
    if (!form.role)        return setError('اختر الوظيفة')
    if (!isEdit || form.pin) {
      if (!/^\d{4}$/.test(form.pin))   return setError('رقم الدخول يجب أن يكون 4 أرقام')
      if (form.pin !== form.confirmPin) return setError('رقما الدخول غير متطابقين')
    }
    setSaving(true)
    const payload: any = { name: form.name.trim(), role: form.role }
    if (form.pin) payload.pin = form.pin
    if (isEdit && initial) payload.id = initial.id
    try {
      isEdit ? await window.api.auth.update(payload) : await window.api.auth.create(payload)
      onSave()
    } catch (e: any) { setError(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <h2 className="text-lg font-bold text-slate-800 mb-5">
          {isEdit ? 'تعديل المستخدم' : 'مستخدم جديد'}
        </h2>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">الاسم</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="اسم المستخدم"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">الوظيفة</label>
            <select value={form.role} onChange={e => set('role', e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">اختر وظيفة...</option>
              {roles.map(r => (
                <option key={r.id} value={r.name}>
                  {r.name}{r.fullAccess ? ' (صلاحية كاملة)' : ` (${r.permissions.length} صفحة)`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1">
              رقم الدخول (4 أرقام)
              {isEdit && <span className="text-slate-400 font-normal"> — اتركه فارغاً للاحتفاظ بالحالي</span>}
            </label>
            <input value={form.pin}
              onChange={e => set('pin', e.target.value.replace(/\D/g,'').slice(0,4))}
              type="password" maxLength={4} placeholder="• • • •"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-xl" />
          </div>

          {(!isEdit || form.pin) && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">تأكيد رقم الدخول</label>
              <input value={form.confirmPin}
                onChange={e => set('confirmPin', e.target.value.replace(/\D/g,'').slice(0,4))}
                type="password" maxLength={4} placeholder="• • • •"
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 tracking-widest text-center text-xl" />
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={save} disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button onClick={onClose}
            className="flex-1 border border-slate-300 text-slate-700 rounded-xl py-2.5 font-semibold hover:bg-slate-50 transition-colors">
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}

export default function UsersPage() {
  const { user: currentUser } = useAuth()
  const [users, setUsers]   = useState<User[]>([])
  const [roles, setRoles]   = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal]   = useState<{ mode: 'create' | 'edit'; user?: User } | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  async function load() {
    setLoading(true)
    const [u, r] = await Promise.all([window.api.auth.getAll(), window.api.roles.getAll()])
    setUsers(u)
    setRoles(r)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleActive(u: User) {
    if (u.id === currentUser?.id) return
    await window.api.auth.update({ id: u.id, isActive: !u.isActive })
    load()
  }

  async function confirmDelete() {
    if (!deleteId) return
    await window.api.auth.delete(deleteId)
    setDeleteId(null)
    load()
  }

  if (!currentUser?.roleData?.fullAccess) {
    return (
      <div className="p-8 flex flex-col items-center justify-center h-full gap-4">
        <ShieldCheck size={48} className="text-slate-300" />
        <p className="text-slate-500 text-lg">هذه الصفحة لمدير النظام فقط</p>
      </div>
    )
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-slate-800">المستخدمون</h1>
        <button onClick={() => setModal({ mode: 'create' })}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors font-medium">
          <Plus size={16} /> مستخدم جديد
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-16">جاري التحميل...</div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3 text-right font-semibold">المستخدم</th>
                <th className="px-5 py-3 text-right font-semibold">الوظيفة</th>
                <th className="px-5 py-3 text-right font-semibold">الحالة</th>
                <th className="px-5 py-3 text-right font-semibold">تاريخ الإنشاء</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${!u.isActive ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {u.name[0]}
                      </div>
                      <div>
                        <div className="font-medium text-slate-800">{u.name}</div>
                        {u.id === currentUser?.id && <span className="text-xs text-blue-500">أنت</span>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-700">{u.role || '—'}</span>
                      {u.roleData?.fullAccess && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">كاملة</span>
                      )}
                      {u.roleData && !u.roleData.fullAccess && (
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                          {u.roleData.permissions.length} صفحة
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <button onClick={() => toggleActive(u)} disabled={u.id === currentUser?.id}
                      className={`flex items-center gap-1.5 text-sm transition-colors ${
                        u.isActive ? 'text-green-600 hover:text-green-700' : 'text-slate-400 hover:text-slate-600'
                      } disabled:cursor-not-allowed`}>
                      {u.isActive ? <><ToggleRight size={18}/> نشط</> : <><ToggleLeft size={18}/> موقوف</>}
                    </button>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {new Date(u.createdAt).toLocaleDateString('ar-EG')}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setModal({ mode: 'edit', user: u })}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => setDeleteId(u.id)} disabled={u.id === currentUser?.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr><td colSpan={5} className="text-center text-slate-400 py-12">لا يوجد مستخدمون</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <UserModal
          initial={modal.user}
          roles={roles}
          isEdit={modal.mode === 'edit'}
          onSave={() => { setModal(null); load() }}
          onClose={() => setModal(null)}
        />
      )}

      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl text-center">
            <h3 className="font-bold text-slate-800 text-lg mb-2">حذف المستخدم؟</h3>
            <p className="text-slate-500 text-sm mb-6">هذا الإجراء لا يمكن التراجع عنه</p>
            <div className="flex gap-3">
              <button onClick={confirmDelete}
                className="flex-1 bg-red-600 text-white rounded-xl py-2.5 font-semibold hover:bg-red-700">
                حذف
              </button>
              <button onClick={() => setDeleteId(null)}
                className="flex-1 border border-slate-300 text-slate-700 rounded-xl py-2.5 font-semibold hover:bg-slate-50">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
