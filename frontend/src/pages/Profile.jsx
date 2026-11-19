import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import Avatar from '../components/Avatar.jsx'
import TitleCard from '../components/TitleCard.jsx'

// "Wishlist" = things you want to watch/play; "Completed" = finished. Stored status -> label.
const SECTIONS = [
  ['in_progress', 'Watching / playing now'],
  ['planned', 'Wishlist'],
  ['completed', 'Completed'],
  ['dropped', 'Dropped'],
]
const VISIBILITY = [
  ['private', 'Only me'],
  ['friends', 'My friends'],
  ['public', 'Everyone (even without an account)'],
]

function Settings({ profile, onSaved }) {
  const { refreshUser } = useAuth()
  const [bio, setBio] = useState(profile.bio || '')
  const [vis, setVis] = useState(profile.list_visibility)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    setError('')
    try {
      await api('/auth/me/', { method: 'PATCH', body: { bio, list_visibility: vis } })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      refreshUser()
      onSaved()
    } catch (err) { setError(err.message) }
  }

  return (
    <form className="panel settings" onSubmit={save}>
      <h2>Your profile</h2>
      <label>About you
        <textarea rows={2} maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A line about your taste in movies and games" />
      </label>
      <label>Who can see my lists (wishlist, playing, completed)
        <select value={vis} onChange={(e) => setVis(e.target.value)}>
          {VISIBILITY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <p className="muted small">Your reviews and username are always public. Only the lists follow this setting.</p>
      {error && <p className="error">{error}</p>}
      <button className="btn">{saved ? 'Saved ✓' : 'Save'}</button>
    </form>
  )
}

function FriendAction({ p, reload }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const act = (fn) => async () => { try { await fn(); reload() } catch (e) { alert(e.message) } }
  if (p.relation === 'self') return null
  if (!user) return <Link className="btn" to="/login">Log in to add friend</Link>
  if (p.relation === 'friends') {
    return (
      <>
        <button className="btn" onClick={() => nav(`/messages/${p.username}`)}>Message</button>
        <button className="ghost" onClick={act(() => api(`/friends/${p.request_id}/`, { method: 'DELETE' }))}>Unfriend</button>
      </>
    )
  }
  if (p.relation === 'request_sent') {
    return <button className="ghost" onClick={act(() => api(`/friends/${p.request_id}/`, { method: 'DELETE' }))}>Request sent · Cancel</button>
  }
  if (p.relation === 'request_received') {
    return (
      <>
        <button className="btn" onClick={act(() => api(`/friends/${p.request_id}/accept/`, { method: 'POST' }))}>Accept request</button>
        <button className="ghost" onClick={act(() => api(`/friends/${p.request_id}/`, { method: 'DELETE' }))}>Decline</button>
      </>
    )
  }
  return <button className="btn" onClick={act(() => api('/friends/request/', { method: 'POST', body: { username: p.username } }))}>Add friend</button>
}

export default function Profile() {
  const { username } = useParams()
  const { user } = useAuth()
  const [p, setP] = useState(null)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api(`/users/${encodeURIComponent(username)}/`).then((d) => { setP(d); setError('') }).catch((e) => setError(e.message))
  }, [username])
  useEffect(() => { setP(null); load() }, [load, user])
  useEffect(() => { document.title = `${username} — NexPlay` }, [username])

  if (error) return <p className="error">{error === 'Not found.' ? 'No such user.' : error}</p>
  if (!p) return <p className="muted">Loading…</p>

  return (
    <>
      <header className="phead">
        <Avatar name={p.username} url={p.avatar_url} size={84} />
        <div className="pinfo">
          <h1>{p.username}</h1>
          {p.bio && <p>{p.bio}</p>}
          <p className="muted small">
            Joined {new Date(p.joined).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} · {p.friend_count} friend{p.friend_count === 1 ? '' : 's'}
          </p>
        </div>
        <div className="pactions"><FriendAction p={p} reload={load} /></div>
      </header>

      {p.relation === 'self' && <Settings profile={p} onSaved={load} />}

      {p.list_visible ? (
        SECTIONS.map(([status, label]) => {
          const items = p.list.filter((i) => i.status === status)
          if (items.length === 0) return null
          return (
            <section key={status} className="allsection">
              <div className="railhead"><h2>{label} <span className="muted small">{items.length}</span></h2></div>
              <div className="grid">{items.map((i) => <TitleCard key={i.title.id} t={i.title} hideWatch />)}</div>
            </section>
          )
        })
      ) : (
        <div className="panel lock">
          <strong>🔒 This list is private.</strong>
          {p.list_visibility === 'friends' && <p className="muted">Only {p.username}'s friends can see it.</p>}
        </div>
      )}
      {p.list_visible && p.list.length === 0 && (
        <p className="muted">{p.relation === 'self' ? <>Nothing saved yet. Use “+ Watchlist” on any title.</> : 'Nothing saved yet.'}</p>
      )}

      <section className="allsection">
        <div className="railhead"><h2>Recent reviews</h2></div>
        {p.reviews.length === 0 && <p className="muted">No reviews yet.</p>}
        <div className="plreviews">
          {p.reviews.map((r) => (
            <Link key={r.id} to={`/title/${r.title_slug}`} className="plreview">
              {r.poster_url ? <img src={r.poster_url} alt="" loading="lazy" /> : <span className="noimg">{r.title_name[0]}</span>}
              <div>
                <strong>{r.title_name}</strong> <span className="score">★ {r.rating}</span>
                <p>{r.body.length > 220 ? `${r.body.slice(0, 220)}…` : r.body}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
