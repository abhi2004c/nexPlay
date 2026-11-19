export const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export const getToken = () => localStorage.getItem('token')

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    let msg = await res.text()
    try {
      const j = JSON.parse(msg)
      msg = j.detail || Object.values(j).flat().join(' ')
    } catch {
      /* keep raw text */
    }
    throw new Error(msg)
  }
  return res.status === 204 ? null : res.json()
}
