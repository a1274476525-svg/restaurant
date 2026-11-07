import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import type { User } from '../types'

const AUTO_LOCK_MS = 20 * 60 * 1000 // 20 دقيقة بدون نشاط

interface AuthCtx {
  user:      User | null
  isLocked:  boolean
  login:     (userId: number, pin: string) => Promise<boolean>
  logout:    () => void
  lock:      () => void
  unlock:    (pin: string) => Promise<boolean>
  canAccess: (path: string) => boolean
}

const Ctx = createContext<AuthCtx>({
  user: null,
  isLocked: false,
  login:     async () => false,
  logout:    () => {},
  lock:      () => {},
  unlock:    async () => false,
  canAccess: () => true,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('_cu') || 'null')
      if (saved && (!('roleData' in saved) || saved.roleData === null)) {
        sessionStorage.removeItem('_cu')
        return null
      }
      return saved
    } catch { return null }
  })
  const [isLocked, setIsLocked] = useState(false)

  // قفل تلقائي بعد 20 دقيقة عدم نشاط
  useEffect(() => {
    if (!user || isLocked) return
    let timer = setTimeout(() => setIsLocked(true), AUTO_LOCK_MS)
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setIsLocked(true), AUTO_LOCK_MS)
    }
    const events: (keyof WindowEventMap)[] = ['mousedown', 'keydown', 'touchstart', 'scroll']
    events.forEach(e => window.addEventListener(e, reset, { passive: true }))
    return () => {
      clearTimeout(timer)
      events.forEach(e => window.removeEventListener(e, reset))
    }
  }, [user?.id, isLocked])

  async function login(userId: number, pin: string) {
    const result = await window.api.auth.login(userId, pin)
    if (result) {
      setUser(result)
      setIsLocked(false)
      sessionStorage.setItem('_cu', JSON.stringify(result))
    }
    return !!result
  }

  function logout() {
    setUser(null)
    setIsLocked(false)
    sessionStorage.removeItem('_cu')
  }

  function lock() { setIsLocked(true) }

  async function unlock(pin: string) {
    if (!user) return false
    const result = await window.api.auth.login(user.id, pin)
    if (result) {
      setUser(result)
      sessionStorage.setItem('_cu', JSON.stringify(result))
      setIsLocked(false)
    }
    return !!result
  }

  function canAccess(path: string) {
    if (!user) return false
    if (path === '/') return true
    const rd = user.roleData
    if (!rd) return false
    if (rd.fullAccess) return true
    return rd.permissions.some(p => path === p || path.startsWith(p + '/'))
  }

  return (
    <Ctx.Provider value={{ user, isLocked, login, logout, lock, unlock, canAccess }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
