export const inputCls =
  'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

export function Modal({
  title, children, onClose, maxWidth = 'max-w-md',
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
  maxWidth?: string
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className={`bg-white rounded-xl w-full ${maxWidth} p-6 shadow-xl`}>
        <h2 className="text-lg font-bold text-slate-800 mb-5">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function DeleteConfirm({
  onConfirm, onCancel, message = 'هل أنت متأكد؟ لا يمكن التراجع عن هذا الإجراء.',
}: {
  onConfirm: () => void
  onCancel: () => void
  message?: string
}) {
  return (
    <Modal title="تأكيد الحذف" onClose={onCancel}>
      <p className="text-slate-500 text-sm mb-6">{message}</p>
      <div className="flex gap-3">
        <button onClick={onConfirm}
          className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 text-sm font-medium">
          حذف
        </button>
        <button onClick={onCancel}
          className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium">
          إلغاء
        </button>
      </div>
    </Modal>
  )
}

export function SaveCancelButtons({
  saving, onCancel,
}: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="submit" disabled={saving}
        className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium">
        {saving ? 'جاري الحفظ...' : 'حفظ'}
      </button>
      <button type="button" onClick={onCancel}
        className="flex-1 bg-slate-100 text-slate-700 py-2 rounded-lg hover:bg-slate-200 text-sm font-medium">
        إلغاء
      </button>
    </div>
  )
}
