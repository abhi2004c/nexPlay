import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/auth/password-reset/', { method: 'POST', body: { email } })
      setSent(true)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div className="authwrap single">
      <form className="authcard" onSubmit={submit}>
        <h1>Forgot your password?</h1>
        {sent ? (
          <>
            <p>If <strong>{email}</strong> has a NexPlay account, a reset link is on its way. It works for a few days and only once.</p>
            <p className="muted small">Nothing arrived? Check spam, or make sure you typed the email you signed up with. Accounts created with Google don't have a password — use “Continue with Google”.</p>
            <Link className="btn big" to="/login">Back to log in</Link>
          </>
        ) : (
          <>
            <p className="muted">Enter your account email and we'll send you a link to choose a new password.</p>
            <label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn big" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
            <p className="switch"><Link to="/login">Back to log in</Link></p>
          </>
        )}
      </form>
    </div>
  )
}

export function ResetPassword() {
  const { uid, token } = useParams()
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api('/auth/password-reset/confirm/', { method: 'POST', body: { uid, token, password } })
      setDone(true)
      setTimeout(() => nav('/login'), 2500)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div className="authwrap single">
      <form className="authcard" onSubmit={submit}>
        <h1>Choose a new password</h1>
        {done ? (
          <>
            <p>Password changed. Taking you to log in…</p>
            <Link className="btn big" to="/login">Log in now</Link>
          </>
        ) : (
          <>
            <label>New password<input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoFocus /></label>
            <p className="muted small">At least 8 characters, not too common and not all numbers.</p>
            {error && <p className="error" role="alert">{error} {error.includes('expired') && <Link to="/forgot">Request a new link</Link>}</p>}
            <button className="btn big" disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
          </>
        )}
      </form>
    </div>
  )
}
