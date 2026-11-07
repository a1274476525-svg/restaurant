import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, ShieldCheck, ShieldOff, CheckSquare, Square, Lock } from 'lucide-react'
import type { Role } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { ALL_PAGES, PAGE_GROUPS } from '../constants/permissions'

// ─── Permission Picker ───────────────────────────────────────────
function PermissionPicker({
  selected, onChange,
}: { selected: string[]; onChange: (p: string[]) => void }) {
  function toggle(key: string) {
    onChange(
      selected.includes(key)
        ? selected.filter(k => k !== key)
        : [...selected, key]
    )
  }

  function toggleGroup(group: string) {
    const keys = ALL_PAGES.filter(p => p.group === group).map(p => p.key)
    const allOn = keys.every(k => selected.includes(k))
    if (allOn) onChange(selected.filter(k => !keys.includes(k)))
    else onChange([...new Set([...selected, ...keys])])
  }

  function selectAll()   { onChange(ALL_PAGES.map(p => p.key)) }
  function selectNone()  { onChange([]) }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 text-xs">
        <button onClick={selectAll}  className="text-blue-600 hover:underline">تحديد الكل</button>
        <button onClick={selectNone} className="text-slate-400 hover:underline">إلغاء الكل</button>
      </div>

      {PAGE_GROUPS.map(group => {
        const pages   = ALL_PAGES.filter(p => p.group === group)
        const checked = pages.filter(p => selected.includes(p.key)).length
        return (
          <div key={group}>
            <button onClick={() => toggleGroup(group)}
              className="flex items-center gap-2 w-full text-right mb-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{group}</span>
              <span className="text-xs text-slate-400">({checked}/{pages.length})</span>
            </button>
            <div className="grid grid-cols-2 gap-1.5">
              {pages.map(page => {
                const on = selected.includes(page.key)
                return (
                  <button key={page.key} onClick={() => toggle(page.key)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-right ${
                      on
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-slate-50 text-slate-600 border border-transparent hover:bg-slate-100'
                    }`}>
                    {on
                      ? <CheckSquare size={14} className="text-blue-500 flex-shrink-0" />
                      : <Square size={14} className="text-slate-300 flex-shrink-0" />
                    }
                    {page.label}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Role Modal ──────────────────────────────────────────────────
function RoleModal({
  initial, onSave, onClose,
}: { initial?: Role; onSave: () => void; onClose: () => void }) {
  const isEdit   = !!initial
  const isSys    = !!initial?.isSystem

  const [name,        setName]        = useState(initial?.name ?? '')
  const [fullAccess,  setFullAccess]  = useState(initial?.fullAccess ?? false)
  const [permissions, setPermissions] = useState<string[]>(initial?.permissions ?? [])
  const [error,  setError]  = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!name.trim()) return setError('اسم الوظيفة مطلوب')
    if (!fullAccess && permissions.length === 0) return setError('اختر صفحة واحدة على الأقل')
    setSaving(true)
    try {
      const payload = { name: name.trim(), fullAccess, permissions }
      isEdit
        ? await window.api.roles.update({ id: initial!.id, ...payload })
        : await window.api.roles.create(payload)
      onSave()
    } catch (e: any) { setError(e.message || 'حدث خطأ') }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 overflow-y-auto py-6"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl my-auto">
        <h2 className="text-lg font-bold text-slate-800 mb-5">
          {isEdit ? 'تعديل الوظيفة' : 'وظيفة جديدة'}
        </h2>

        {error && <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-2 mb-4">{error}</div>}

        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-slate-700 block mb-1.5">اسم الوظيفة</label>
            {isSys ? (
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg text-slate-500 text-sm">
                <Lock size={13} /> {name} <span className="text-xs">(لا يمكن تغيير اسم هذه الوظيفة)</span>
              </div>
            ) : (
              <input value={name} onChange={e => { setName(e.target.value); setError('') }}
                placeholder="مثال: مشرف المخزن، موظف المبيعات..."
                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
            )}
          </div>

          {/* Full Access toggle */}
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
            <div>
              <div className="text-sm font-medium text-slate-800">صلاحية كاملة</div>
              <div className="text-xs text-slate-500 mt-0.5">الوصول لجميع الصفحات دون قيود</div>
            </div>
            <button
              onClick={() => !isSys && setFullAccess(v => !v)}
              disabled={isSys}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                fullAccess ? 'bg-blue-600' : 'bg-slate-300'
              } ${isSys ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                fullAccess ? 'right-1' : 'left-1'
              }`} />
            </button>
          </div>

          {/* Permissions */}
          {!fullAccess && (
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-3">الصفحات المسموحة</label>
              <div className="border border-slate-200 rounded-xl p-4 max-h-80 overflow-y-auto">
                <PermissionPicker selected={permissions} onChange={setPermissions} />
              </div>
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

// ─── Main Page ───────────────────────────────────────────────────
export default function RolesPage() {
  const { user } = useAuth()
  const [roles,   setRoles]   = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [modal,   setModal]   = useState<{ role?: Role } | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteErr, setDeleteErr] = useState('')

  async function load() {
    setLoading(true)
    setRoles(await window.api.roles.getAll())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function confirmDelete() {
    if (!deleteId) return
    setDeleteErr('')
    try {
      await window.api.roles.delete(deleteId)
      setDeleteId(null)
      load()
    } catch (e: any) { setDeleteErr(e.message || 'حدث خطأ') }
  }

  if (!user?.roleData?.fullAccess) {
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
        <h1 className="text-2xl font-bold text-slate-800">إدارة الوظائف</h1>
        <button onClick={() => setModal({})}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors font-medium">
          <Plus size={16} /> وظيفة جديدة
        </button>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-16">جاري التحميل...</div>
      ) : (
        <div className="grid gap-4">
          {roles.map(role => (
            <div key={role.id} className="bg-white rounded-2xl shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    role.fullAccess ? 'bg-red-100' : 'bg-blue-100'
                  }`}>
                    {role.fullAccess
                      ? <ShieldCheck size={20} className="text-red-600" />
                      : <ShieldOff size={20} className="text-blue-600" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-slate-800">{role.name}</h3>
                      {role.isSystem && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Lock size={10} /> النظام
                        </span>
                      )}
                      {role.fullAccess
                        ? <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">صلاحية كاملة</span>
                        : <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">{role.permissions.length} صفحة</span>
                      }
                    </div>

                    {!role.fullAccess && role.permissions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {role.permissions.map(perm => {
                          const page = ALL_PAGES.find(p => p.key === perm)
                          return page ? (
                            <span key={perm} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                              {page.label}
                            </span>
                          ) : null
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setModal({ role })}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => { setDeleteId(role.id); setDeleteErr('') }}
                    disabled={role.isSystem}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {roles.length === 0 && (
            <div className="text-center text-slate-400 py-16 bg-white rounded-2xl">
              لا توجد وظائف — أنشئ وظيفة جديدة
            </div>
          )}
        </div>
      )}

      {modal && (
        <RoleModal
          initial={modal.role}
          onSave={() => { setModal(null); load() }}
          onClose={() => setModal(null)}
        />
      )}

      {deleteId !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl text-center">
            <h3 className="font-bold text-slate-800 text-lg mb-2">حذف الوظيفة؟</h3>
            <p className="text-slate-500 text-sm mb-4">سيتأثر المستخدمون المعيّنون لها</p>
            {deleteErr && <p className="text-red-500 text-sm mb-4 bg-red-50 rounded-lg px-3 py-2">{deleteErr}</p>}
            <div className="flex gap-3">
              <button onClick={confirmDelete}
                className="flex-1 bg-red-600 text-white rounded-xl py-2.5 font-semibold hover:bg-red-700">
                حذف
              </button>
              <button onClick={() => { setDeleteId(null); setDeleteErr('') }}
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
