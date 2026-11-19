import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import GoogleButton from '../components/GoogleButton.jsx'

const HAS_GOOGLE = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID)

export default function AuthPage() {
  const { login, register, googleLogin } = useAuth()
  const nav = useNavigate()
  const [mode, setMode] = useState('login')
  const [f, setF] = useState({ username: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  useEffect(() => { document.title = `${mode === 'login' ? 'Log in' : 'Sign up'} — NexPlay` }, [mode])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (mode === 'login') await login(f.username, f.password)
      else await register(f.username, f.email, f.password)
      nav('/')
    } catch (err) {
      setError(err.message === 'No active account found with the given credentials' ? 'Wrong username or password.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  const onGoogle = useCallback(async (credential) => {
    try { await googleLogin(credential); nav('/') } catch (err) { setError(err.message) }
  }, [googleLogin, nav])

  const signup = mode === 'register'
  return (
    <div className="authwrap">
      <aside className="authside" aria-hidden="true">
        <div className="authside-inner">
          <h2>Nex<span>Play</span></h2>
          <p>Rate and review movies and games, keep your wishlist, and see what your friends are watching and playing.</p>
          <ul>
            <li>Trailers, scores and where to watch or buy</li>
            <li>Recommendations that learn your taste</li>
            <li>Share lists and chat with friends</li>
          </ul>
        </div>
      </aside>

      <form className="authcard" onSubmit={submit}>
        <h1>{signup ? 'Create your account' : 'Welcome back'}</h1>
        <p className="muted">{signup ? 'Join to rate, review and build your lists.' : 'Log in to your lists, reviews and friends.'}</p>

        <GoogleButton onCredential={onGoogle} onError={setError} />
        {HAS_GOOGLE && <div className="or"><span>or with your username</span></div>}

        <label>
          Username
          <input autoComplete="username" value={f.username} onChange={set('username')} required autoFocus />
        </label>
        {signup && (
          <label>
            Email <small className="muted">(used to reset your password)</small>
            <input type="email" autoComplete="email" value={f.email} onChange={set('email')} required />
          </label>
        )}
        <label>
          <span className="labelrow">
            Password
            {!signup && <Link to="/forgot" className="small">Forgot password?</Link>}
          </span>
          <span className="pwfield">
            <input type={show ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'}
              value={f.password} onChange={set('password')} required minLength={signup ? 8 : undefined} />
            <button type="button" className="ghost" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button>
          </span>
        </label>
        {signup && <p className="muted small">At least 8 characters, not too common and not all numbers.</p>}

        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn big" disabled={busy}>{busy ? 'Please wait…' : signup ? 'Create account' : 'Log in'}</button>

        <p className="switch">
          {signup ? 'Already have an account? ' : 'New to NexPlay? '}
          <button type="button" className="link" onClick={() => { setMode(signup ? 'login' : 'register'); setError('') }}>
            {signup ? 'Log in' : 'Create an account'}
          </button>
        </p>
      </form>
    </div>
  )
}
