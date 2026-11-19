import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import Avatar from '../components/Avatar.jsx'

function Note({ ok, children }) {
  return children ? <p className={ok ? 'okmsg' : 'error'} role={ok ? 'status' : 'alert'}>{children}</p> : null
}

const SIZE = 256 // pictures are cropped to a square and shrunk to this many pixels before upload

// Centre-crop to a square, shrink and re-encode as JPEG in the browser, so uploads are tiny (~20-40 KB).
function resizeToJpeg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = SIZE
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#fff' // transparent PNGs get a white background in a JPEG
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, SIZE, SIZE)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That file is not an image we can read.')) }
    img.src = url
  })
}

function PhotoForm({ user }) {
  const { refreshUser } = useAuth()
  const input = useRef(null)
  const [preview, setPreview] = useState(null) // data URL of the resized picture, before saving
  const [msg, setMsg] = useState({ ok: false, text: '' })
  const [busy, setBusy] = useState(false)

  async function pick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) return setMsg({ ok: false, text: 'Please choose an image file.' })
    try { setPreview(await resizeToJpeg(file)); setMsg({ ok: false, text: '' }) } catch (err) { setMsg({ ok: false, text: err.message }) }
  }
  async function save() {
    setBusy(true)
    try {
      await api('/auth/avatar/', { method: 'POST', body: { data: preview } })
      await refreshUser()
      setPreview(null)
      setMsg({ ok: true, text: 'Profile picture updated.' })
    } catch (err) { setMsg({ ok: false, text: err.message }) } finally { setBusy(false) }
  }
  async function remove() {
    setBusy(true)
    try {
      await api('/auth/avatar/', { method: 'DELETE' })
      await refreshUser()
      setMsg({ ok: true, text: 'Picture removed.' })
    } catch (err) { setMsg({ ok: false, text: err.message }) } finally { setBusy(false) }
  }

  return (
    <section className="panel settings">
      <h2>Profile picture</h2>
      <div className="photorow">
        {preview ? <span className="avatar" style={{ width: 96, height: 96 }}><img src={preview} alt="New picture preview" /></span>
          : <Avatar name={user.username} url={user.avatar_url} size={96} />}
        <div className="photoactions">
          <input ref={input} type="file" accept="image/*" onChange={pick} hidden />
          {preview ? (
            <>
              <button className="btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save picture'}</button>
              <button className="ghost" onClick={() => setPreview(null)} disabled={busy}>Cancel</button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => input.current.click()}>Choose a photo</button>
              {user.avatar_url && <button className="ghost" onClick={remove} disabled={busy}>Remove</button>}
            </>
          )}
        </div>
      </div>
      <p className="muted small">Any image works. It is cropped to a square from the centre and shrunk before it is uploaded. Everyone can see it.</p>
      <Note ok={msg.ok}>{msg.text}</Note>
    </section>
  )
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
      <PhotoForm user={user} />
      <UsernameForm user={user} />
      <PasswordForm user={user} />
      <p className="muted small">Your bio and who can see your lists are on <Link to={`/u/${user.username}`}>your profile</Link>.</p>
      <DeleteForm user={user} />
    </>
  )
}
