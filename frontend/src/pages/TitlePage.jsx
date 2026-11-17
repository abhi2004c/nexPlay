import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import TitleCard from '../components/TitleCard.jsx'
import Deals from '../components/Deals.jsx'

export default function TitlePage() {
  const { slug } = useParams()
  const { user } = useAuth()
  const [t, setT] = useState(null)
  const [reviews, setReviews] = useState([])
  const [threads, setThreads] = useState([])
  const [rating, setRating] = useState(8)
  const [body, setBody] = useState('')
  const [subject, setSubject] = useState('')
  const [tbody, setTbody] = useState('')
  const [msg, setMsg] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [similar, setSimilar] = useState([])

  const load = useCallback(async () => {
    const [title, r, th, an, sim] = await Promise.all([
      api(`/titles/${slug}/`),
      api(`/reviews/?title=${slug}`),
      api(`/threads/?title=${slug}`),
      api(`/titles/${slug}/analysis/`),
      api(`/titles/${slug}/similar/`),
    ])
    setAnalysis(an)
    setSimilar(sim)
    setT(title)
    setReviews(r.results)
    setThreads(th.results)
  }, [slug])
  useEffect(() => { load().catch((e) => setMsg(e.message)) }, [load])

  const run = (fn, ok) => async (e) => {
    e?.preventDefault()
    try {
      await fn()
      setMsg(ok || '')
      await load()
    } catch (err) {
      setMsg(err.message)
    }
  }

  if (!t) return <p className="muted">{msg || 'Loading…'}</p>

  return (
    <>
      <div className="detail">
        <div className={`poster big ${t.media_type}`}>
          {t.poster_url ? <img src={t.poster_url} alt="" /> : <span>{t.name[0]}</span>}
        </div>
        <div>
          <h1>{t.name}</h1>
          <p className="muted">
            {t.media_type === 'movie' ? 'Movie' : 'Game'} · {t.release_date?.slice(0, 4)} · {t.creator}
            {t.runtime_minutes ? ` · ${t.runtime_minutes} min` : ''}
            {t.platforms ? ` · ${t.platforms}` : ''}
          </p>
          <p>{t.genres.map((g) => <span className="tag" key={g}>{g}</span>)}</p>
          <p>{t.description}</p>
          <p className="score">
            ★ {t.rating_count ? t.avg_rating : '–'} <span className="muted">({t.rating_count} reviews)</span>
          </p>
          {user && (
            <button
              className="btn"
              onClick={run(() => api('/watchlist/', { method: 'POST', body: { title_slug: slug } }), 'Added to watchlist')}
            >
              + Watchlist
            </button>
          )}
          {msg && <p className="muted">{msg}</p>}
        </div>
      </div>

      {t.media_type === 'game' && <Deals slug={slug} />}

      {analysis && (
        <section className="panel">
          <h2>Review analysis</h2>
          <p>{analysis.summary}</p>
          {analysis.positive + analysis.neutral + analysis.negative > 0 && (
            <div className="sentbar">
              {['positive', 'neutral', 'negative'].map((k) => (
                <span key={k} className={k} style={{ flex: analysis[k] }} title={`${k}: ${analysis[k]}`} />
              ))}
            </div>
          )}
          <p>{analysis.keywords.map((k) => <span className="tag" key={k}>{k}</span>)}</p>
        </section>
      )}

      <section className="panel">
        <h2>Reviews</h2>
        {user ? (
          <form
            onSubmit={run(
              () => api('/reviews/', { method: 'POST', body: { title_slug: slug, rating: Number(rating), body } }),
              'Review posted',
            )}
          >
            <label>
              Rating{' '}
              <select value={rating} onChange={(e) => setRating(e.target.value)}>
                {[...Array(10)].map((_, i) => <option key={i + 1}>{i + 1}</option>)}
              </select>{' '}
              / 10
            </label>
            <textarea placeholder="Write your review…" value={body} onChange={(e) => setBody(e.target.value)} />
            <button className="btn">Post review</button>
          </form>
        ) : (
          <p><Link to="/login">Log in</Link> to review.</p>
        )}
        {reviews.map((r) => (
          <div className="review" key={r.id}>
            <strong>{r.username}</strong> <span className="score">★ {r.rating}</span>
            <p>{r.body}</p>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2>Discussion</h2>
        {user && (
          <form
            onSubmit={run(() =>
              api('/threads/', { method: 'POST', body: { title_slug: slug, subject, body: tbody } }).then(() => {
                setSubject('')
                setTbody('')
              }),
            )}
          >
            <input placeholder="Thread subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
            <textarea placeholder="Start a conversation…" value={tbody} onChange={(e) => setTbody(e.target.value)} required />
            <button className="btn">Start thread</button>
          </form>
        )}
        {threads.map((th) => <Thread key={th.id} th={th} user={user} />)}
        {threads.length === 0 && <p className="muted">No threads yet.</p>}
      </section>

      {similar.length > 0 && (
        <section className="rail">
          <h2>More like this</h2>
          <div className="scroll">{similar.map((s) => <TitleCard key={s.id} t={s} />)}</div>
        </section>
      )}
    </>
  )
}

function Thread({ th, user }) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const load = () => api(`/comments/?thread=${th.id}`).then((d) => setComments(d.results))
  const toggle = () => {
    if (!open) load()
    setOpen(!open)
  }
  const reply = (e) => {
    e.preventDefault()
    api('/comments/', { method: 'POST', body: { thread: th.id, body: text } }).then(() => {
      setText('')
      load()
    })
  }

  return (
    <div className="review">
      <strong onClick={toggle} style={{ cursor: 'pointer' }}>{th.subject}</strong>
      <span className="muted"> by {th.author} · {th.comment_count} replies</span>
      <p>{th.body}</p>
      {open && (
        <>
          {comments.map((c) => <p className="comment" key={c.id}><b>{c.author}:</b> {c.body}</p>)}
          {user && (
            <form className="inline" onSubmit={reply}>
              <input placeholder="Reply…" value={text} onChange={(e) => setText(e.target.value)} required />
              <button className="btn">Reply</button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
