import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import Avatar from '../components/Avatar.jsx'

const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

function SharedTitle({ t }) {
  return (
    <Link to={`/title/${t.slug}`} className="shared">
      {t.poster_url ? <img src={t.poster_url} alt="" /> : <span className="noimg">{t.name[0]}</span>}
      <span>
        <strong>{t.name}</strong>
        <small className="muted">{t.media_type === 'movie' ? 'Movie' : 'Game'}{t.release_date ? ` · ${t.release_date.slice(0, 4)}` : ''}</small>
      </span>
    </Link>
  )
}

// Search box that lets you attach a movie or game to your next message.
function TitlePicker({ onPick, onClose }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return }
    let stale = false
    const id = setTimeout(() => {
      api(`/titles/?search=${encodeURIComponent(q.trim())}&ordering=-avg_rating`).then((d) => { if (!stale) setResults(d.results.slice(0, 6)) }).catch(() => {})
    }, 250)
    return () => { stale = true; clearTimeout(id) }
  }, [q])
  return (
    <div className="picker">
      <div className="pickerhead">
        <input autoFocus type="search" placeholder="Search a movie or game to share…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="ghost" onClick={onClose}>Cancel</button>
      </div>
      {results.map((t) => (
        <button type="button" key={t.id} className="pickitem" onClick={() => onPick(t)}>
          {t.poster_url ? <img src={t.poster_url} alt="" /> : <span className="noimg">{t.name[0]}</span>}
          <span><strong>{t.name}</strong> <small className="muted">{t.media_type === 'movie' ? 'Movie' : 'Game'}{t.release_date ? ` · ${t.release_date.slice(0, 4)}` : ''}</small></span>
        </button>
      ))}
      {q.trim().length >= 2 && results.length === 0 && <p className="muted small">No match on NexPlay yet.</p>}
    </div>
  )
}

function Chat({ username, onActivity }) {
  const [msgs, setMsgs] = useState([])
  const [friend, setFriend] = useState(null)
  const [error, setError] = useState('')
  const [text, setText] = useState('')
  const [title, setTitle] = useState(null)
  const [picking, setPicking] = useState(false)
  const [sending, setSending] = useState(false)
  const lastId = useRef(0)
  const log = useRef(null)

  // `wait`: ask the server to hold the request until something new arrives (instant delivery)
  const poll = useCallback(async (first, wait, stale) => {
    try {
      const d = await api(`/messages/with/${encodeURIComponent(username)}/${first ? '' : `?after=${lastId.current}${wait ? '&wait=1' : ''}`}`)
      if (stale?.()) return
      setFriend(d.friend)
      setError('')
      if (first) setMsgs(d.messages)
      else if (d.messages.length) setMsgs((prev) => [...prev, ...d.messages.filter((m) => !prev.some((p) => p.id === m.id))])
      if (d.messages.length) { lastId.current = Math.max(lastId.current, ...d.messages.map((m) => m.id)); onActivity() }
    } catch (e) { if (!stale?.()) setError(e.message) }
  }, [username, onActivity])

  useEffect(() => {
    let alive = true
    const stale = () => !alive
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
    lastId.current = 0
    setMsgs([]); setFriend(null); setTitle(null); setText('')
    ;(async () => {
      await poll(true, false, stale)
      while (alive) {
        if (document.hidden) { await sleep(1500); continue }
        const started = Date.now()
        await poll(false, true, stale) // waits on the server until a message arrives (or ~20s)
        // answered quickly with nothing new (server busy, or an error): pause so we never hammer it
        if (alive && Date.now() - started < 1500) await sleep(2000)
      }
    })()
    const onVisible = () => { if (!document.hidden) poll(false, false, stale) }
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible) }
  }, [poll])

  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }) }, [msgs.length])

  async function send(e) {
    e.preventDefault()
    if (!text.trim() && !title) return
    setSending(true)
    try {
      const m = await api(`/messages/with/${encodeURIComponent(username)}/`, { method: 'POST', body: { body: text, title_slug: title?.slug } })
      lastId.current = Math.max(lastId.current, m.id)
      setMsgs((prev) => [...prev, m])
      setText(''); setTitle(null); setPicking(false)
      onActivity()
    } catch (err) { setError(err.message) } finally { setSending(false) }
  }

  if (error && !friend) return <div className="chatpane"><p className="error">{error}</p></div>

  return (
    <div className="chatpane">
      <div className="chathead">
        <Link to={`/u/${username}`} className="fwho"><Avatar name={username} url={friend?.avatar_url} /> <strong>{username}</strong></Link>
      </div>
      <div className="chatlog" ref={log} aria-live="polite">
        {msgs.length === 0 && <p className="muted center">Say hi, or share a movie or game to ask if they've seen it.</p>}
        {msgs.map((m) => (
          <div key={m.id} className={`bubble ${m.mine ? 'mine' : ''}`}>
            {m.title && <SharedTitle t={m.title} />}
            {m.body && <p>{m.body}</p>}
            <small>{time(m.created_at)}</small>
          </div>
        ))}
      </div>
      {error && <p className="error small">{error}</p>}
      {picking && <TitlePicker onPick={(t) => { setTitle(t); setPicking(false) }} onClose={() => setPicking(false)} />}
      {title && (
        <div className="attached">
          <SharedTitle t={title} />
          <button type="button" className="ghost" onClick={() => setTitle(null)} aria-label="Remove attachment">✕</button>
        </div>
      )}
      <form className="composer" onSubmit={send}>
        <button type="button" className="ghost" onClick={() => setPicking(!picking)} title="Share a movie or game">＋ Title</button>
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000}
          placeholder={title ? 'Add a note (optional)…' : 'Message…'} aria-label="Message" />
        <button className="btn" disabled={sending || (!text.trim() && !title)}>Send</button>
      </form>
    </div>
  )
}

export default function Messages() {
  const { user } = useAuth()
  const { username } = useParams()
  const nav = useNavigate()
  const [convs, setConvs] = useState(null)

  const load = useCallback(() => api('/messages/').then(setConvs).catch(() => setConvs([])), [])
  useEffect(() => {
    document.title = 'Messages — NexPlay'
    if (!user) return
    load()
    const id = setInterval(() => { if (!document.hidden) load() }, 6000)
    return () => clearInterval(id)
  }, [user, load])

  if (!user) return <p>Please <Link to="/login">log in</Link> to chat with friends.</p>

  return (
    <div className={`messages ${username ? 'open' : ''}`}>
      <aside className="convlist">
        <h2>Messages</h2>
        {convs && convs.length === 0 && <p className="muted small">You have no friends yet. <Link to="/friends">Add some</Link> to start chatting.</p>}
        {convs?.map((c) => (
          <button key={c.username} className={`conv ${c.username.toLowerCase() === username?.toLowerCase() ? 'on' : ''}`} onClick={() => nav(`/messages/${c.username}`)}>
            <Avatar name={c.username} url={c.avatar_url} />
            <span className="cinfo"><strong>{c.username}</strong><small className="muted">{c.preview || 'No messages yet'}</small></span>
            {c.unread > 0 && <span className="badge">{c.unread}</span>}
          </button>
        ))}
      </aside>
      <section className="chatcol">
        {username ? (
          <>
            <button className="ghost backbtn" onClick={() => nav('/messages')}>← All chats</button>
            <Chat username={username} onActivity={load} />
          </>
        ) : (
          <div className="chatpane empty"><p className="muted">Pick a friend to start chatting.</p></div>
        )}
      </section>
    </div>
  )
}
