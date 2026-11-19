import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'

const Ctx = createContext(null)
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)

  useEffect(() => {
    if (localStorage.getItem('token')) {
      api('/auth/me/').then(setUser).catch(() => localStorage.removeItem('token'))
    }
  }, [])

  async function login(username, password) {
    const t = await api('/auth/token/', { method: 'POST', body: { username, password } })
    localStorage.setItem('token', t.access)
    setUser(await api('/auth/me/'))
  }

  async function register(username, email, password) {
    await api('/auth/register/', { method: 'POST', body: { username, email, password } })
    await login(username, password)
  }

  async function googleLogin(credential) {
    const t = await api('/auth/google/', { method: 'POST', body: { credential } })
    localStorage.setItem('token', t.access)
    setUser(await api('/auth/me/'))
  }

  const refreshUser = () => api('/auth/me/').then(setUser)

  function logout() {
    localStorage.removeItem('token')
    setUser(null)
  }

  return <Ctx.Provider value={{ user, login, register, logout, googleLogin, refreshUser }}>{children}</Ctx.Provider>
}
