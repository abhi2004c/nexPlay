import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function AuthPage() {
  const { login, register } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault()
    try {
      if (mode === 'login') await login(f.username, f.password)
      else await register(f.username, f.email, f.password)
      nav('/')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <form className="panel narrow" onSubmit={submit}>
      <h2>{mode === 'login' ? 'Log in' : 'Create account'}</h2>
      <input placeholder="Username" value={f.username} onChange={set('username')} required />
      {mode === 'register' && (
        <input type="email" placeholder="Email" value={f.email} onChange={set('email')} />
      )}
      <input type="password" placeholder="Password" value={f.password} onChange={set('password')} required />
      {error && <p className="error">{error}</p>}
      <button className="btn">{mode === 'login' ? 'Log in' : 'Sign up'}</button>
      <button
        type="button"
        className="ghost"
        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}
      >
        {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Log in'}
      </button>
    </form>
  )
}
