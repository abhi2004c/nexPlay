import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'

function Note({ ok, children }) {
  return children ? <p className={ok ? 'okmsg' : 'error'} role={ok ? 'status' : 'alert'}>{children}</p> : null
}

function UsernameForm({ user }) {
  const { refreshUser } = useAuth()
  const [name, setName] = useState(user.username)
  const [msg, setMsg] = useState({ ok: false, text: '' })
  async function save(e) {
    e.preventDefault()
    try {
      await api('/auth/me/', { method: 'PATCH', body: { username: name.trim() } })
      await refreshUser()
      setMsg({ ok: true, text: 'Username changed.' })
    } catch (err) { setMsg({ ok: false, text: err.message }) }
  }
  return (
    <form className="panel settings" onSubmit={save}>
      <h2>Username</h2>
      <label>Your public name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={150} required />
      </label>
      <p className="muted small">Friends find you by this name. Old links to your profile stop working when you change it.</p>
      <Note ok={msg.ok}>{msg.text}</Note>
      <button className="btn" disabled={name.trim() === user.username}>Change username</button>
    </form>
  )
}

function PasswordForm({ user }) {
  const { refreshUser } = useAuth()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [msg, setMsg] = useState({ ok: false, text: '' })
  async function save(e) {
    e.preventDefault()
    try {
      await api('/auth/change-password/', { method: 'POST', body: { current_password: cur, new_password: next } })
      setCur(''); setNext('')
      await refreshUser()
      setMsg({ ok: true, text: 'Password changed.' })
    } catch (err) { setMsg({ ok: false, text: err.message }) }
  }
  return (
    <form className="panel settings" onSubmit={save}>
      <h2>{user.has_password ? 'Change password' : 'Set a password'}</h2>
      {!user.has_password && <p className="muted small">You signed up with Google. A password lets you also log in with your username.</p>}
      {user.has_password && (
        <label>Current password
          <input type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} required />
        </label>
      )}
      <label>New password
        <input type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} />
      </label>
      <p className="muted small">At least 8 characters, not too common and not all numbers.</p>
      <Note ok={msg.ok}>{msg.text}</Note>
      <button className="btn">{user.has_password ? 'Change password' : 'Set password'}</button>
    </form>
  )
}

function DeleteForm({ user }) {
  const { logout } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  async function remove(e) {
    e.preventDefault()
    try {
      await api('/auth/delete-account/', { method: 'POST', body: user.has_password ? { password: value } : { confirm: value } })
      logout()
      nav('/')
    } catch (err) { setError(err.message) }
  }
  return (
    <section className="panel settings danger-zone">
      <h2>Delete account</h2>
      <p className="muted small">Permanently removes your account, reviews, votes, lists, friends and messages. This cannot be undone.</p>
      {!open ? (
        <button className="danger" onClick={() => setOpen(true)}>Delete my account…</button>
      ) : (
        <form onSubmit={remove} className="settings">
          <label>{user.has_password ? 'Enter your password to confirm' : `Type your username (${user.username}) to confirm`}
            <input type={user.has_password ? 'password' : 'text'} value={value} onChange={(e) => setValue(e.target.value)} required autoFocus />
          </label>
          <Note>{error}</Note>
          <div className="row">
            <button className="danger">Yes, delete everything</button>
            <button type="button" className="ghost" onClick={() => { setOpen(false); setValue(''); setError('') }}>Keep my account</button>
          </div>
        </form>
      )}
    </section>
  )
}

export default function Settings() {
  const { user } = useAuth()
  if (!user) return <p>Please <Link to="/login">log in</Link> to change your settings.</p>
  return (
    <>
      <div className="pagehead"><div><h1>Account settings</h1><p className="muted">{user.email || 'No email on this account'}</p></div></div>
      <UsernameForm user={user} />
      <PasswordForm user={user} />
      <p className="muted small">Your bio and who can see your lists are on <Link to={`/u/${user.username}`}>your profile</Link>.</p>
      <DeleteForm user={user} />
    </>
  )
}
