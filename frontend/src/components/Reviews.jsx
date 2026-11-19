import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'

const ORDERS = [
  ['newest', 'Newest'],
  ['helpful', 'Most helpful'],
  ['rating_desc', 'Highest rated'],
  ['rating_asc', 'Lowest rated'],
]

const when = (iso) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })

function ReviewForm({ initial, submitLabel, onSubmit, onCancel }) {
  const [rating, setRating] = useState(initial?.rating ?? 8)
  const [body, setBody] = useState(initial?.body ?? '')
  const [spoilers, setSpoilers] = useState(initial?.contains_spoilers ?? false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      await onSubmit({ rating: Number(rating), body, contains_spoilers: spoilers })
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <label>
        Rating{' '}
        <select value={rating} onChange={(e) => setRating(e.target.value)}>
          {[...Array(10)].map((_, i) => <option key={i + 1}>{i + 1}</option>)}
        </select>{' '}
        / 10
      </label>
      <textarea placeholder="Write your review…" value={body} onChange={(e) => setBody(e.target.value)} />
      <label className="check">
        <input type="checkbox" checked={spoilers} onChange={(e) => setSpoilers(e.target.checked)} /> This review contains spoilers
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>{' '}
      {onCancel && <button type="button" className="ghost" onClick={onCancel}>Cancel</button>}
    </form>
  )
}

// A review marked as containing spoilers stays blurred until the reader chooses to show it.
function ReviewBody({ r }) {
  const [shown, setShown] = useState(false)
  if (!r.contains_spoilers || shown) return <p>{r.body || <span className="muted">No written review.</span>}</p>
  return (
    <button type="button" className="spoiler" onClick={() => setShown(true)}>
      <span className="spoilertag">⚠ Spoilers</span> Click to show this review
    </button>
  )
}

const REASONS = [['spoiler', 'Spoilers that are not marked'], ['abuse', 'Abusive or hateful'], ['spam', 'Spam or advertising'], ['other', 'Something else']]

function ReportButton({ r }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('spoiler')
  const [msg, setMsg] = useState('')
  async function send() {
    try {
      const d = await api(`/reviews/${r.id}/report/`, { method: 'POST', body: { reason } })
      setMsg(d.detail)
    } catch (e) { setMsg(e.message) }
    setOpen(false)
  }
  if (msg) return <span className="muted small">{msg}</span>
  if (!open) return <button className="ghost small reportbtn" onClick={() => setOpen(true)}>Report</button>
  return (
    <span className="reportform">
      <select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
        {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <button className="danger" onClick={send}>Send report</button>
      <button className="ghost" onClick={() => setOpen(false)}>Cancel</button>
    </span>
  )
}

function VoteButtons({ r, user, onVote }) {
  const disabled = !user || r.is_mine
  const why = !user ? 'Log in to vote' : r.is_mine ? 'You cannot vote on your own review' : ''
  return (
    <span className="votes">
      <button
        className={r.my_vote === 1 ? 'helpful on' : 'helpful'}
        disabled={disabled}
        title={why || (r.my_vote === 1 ? 'Remove your helpful vote' : 'Helpful')}
        aria-pressed={r.my_vote === 1}
        onClick={() => onVote(r, 1)}
      >
        👍 Helpful{r.helpful_count > 0 ? ` · ${r.helpful_count}` : ''}
      </button>
      <button
        className={r.my_vote === -1 ? 'helpful off' : 'helpful'}
        disabled={disabled}
        title={why || (r.my_vote === -1 ? 'Remove your not-helpful vote' : 'Not helpful')}
        aria-pressed={r.my_vote === -1}
        onClick={() => onVote(r, -1)}
      >
        👎{r.unhelpful_count > 0 ? ` · ${r.unhelpful_count}` : ''}
      </button>
    </span>
  )
}

export default function Reviews({ slug, onChange }) {
  const { user } = useAuth()
  const [mine, setMine] = useState(undefined) // undefined = loading, null = none
  const [items, setItems] = useState([])
  const [ordering, setOrdering] = useState('newest')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')

  const loadMine = useCallback(async () => {
    if (!user) return setMine(null)
    const d = await api(`/reviews/?title=${slug}&user=${encodeURIComponent(user.username)}`)
    setMine(d.results[0] ?? null)
  }, [slug, user])

  const loadList = useCallback(async (pg, order) => {
    const d = await api(`/reviews/?title=${slug}&ordering=${order}&page=${pg}`)
    setItems((prev) => (pg === 1 ? d.results : [...prev, ...d.results]))
    setHasMore(Boolean(d.next))
  }, [slug])

  useEffect(() => { loadMine().catch((e) => setError(e.message)) }, [loadMine])
  useEffect(() => { loadList(page, ordering).catch((e) => setError(e.message)) }, [loadList, page, ordering])

  const refreshAll = async () => {
    setPage(1)
    await Promise.all([loadMine(), loadList(1, ordering)])
    onChange?.()
  }

  const create = async (data) => {
    await api('/reviews/', { method: 'POST', body: { title_slug: slug, ...data } })
    await refreshAll()
  }
  const save = async (data) => {
    await api(`/reviews/${mine.id}/`, { method: 'PATCH', body: data })
    setEditing(false)
    await refreshAll()
  }
  const remove = async () => {
    try {
      await api(`/reviews/${mine.id}/`, { method: 'DELETE' })
      setConfirmDelete(false)
      await refreshAll()
    } catch (e) {
      setError(e.message)
    }
  }
  const vote = async (r, value) => {
    try {
      const v = await api(`/reviews/${r.id}/vote/`, { method: 'POST', body: { value } })
      setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...v } : x)))
    } catch (e) {
      setError(e.message)
    }
  }

  const others = items.filter((r) => !r.is_mine)

  return (
    <section className="panel">
      <h2>Reviews</h2>
      {error && <p className="error">{error}</p>}

      {!user && <p><Link to="/login">Log in</Link> to review.</p>}

      {user && mine === null && <ReviewForm submitLabel="Post review" onSubmit={create} />}

      {user && mine && (
        <div className="review mine">
          <div className="steamhead">
            <strong>Your review</strong> <span className="score">★ {mine.rating}</span>
            <span className="muted small">· {when(mine.updated_at)}{mine.helpful_count ? ` · 👍 ${mine.helpful_count}` : ''}{mine.unhelpful_count ? ` · 👎 ${mine.unhelpful_count}` : ''}</span>
          </div>
          {editing ? (
            <ReviewForm initial={mine} submitLabel="Save changes" onSubmit={save} onCancel={() => setEditing(false)} />
          ) : (
            <>
              {mine.contains_spoilers && <p className="muted small">Marked as containing spoilers: others see it hidden until they click.</p>}
              <p>{mine.body || <span className="muted">No written review.</span>}</p>
              <p className="actions">
                <button className="ghost" onClick={() => { setEditing(true); setConfirmDelete(false) }}>Edit</button>
                {confirmDelete ? (
                  <>
                    <span className="muted">Delete your review?</span>
                    <button className="danger" onClick={remove}>Yes, delete</button>
                    <button className="ghost" onClick={() => setConfirmDelete(false)}>Keep it</button>
                  </>
                ) : (
                  <button className="ghost" onClick={() => setConfirmDelete(true)}>Delete</button>
                )}
              </p>
              <p className="muted small">You can post one review per title.</p>
            </>
          )}
        </div>
      )}

      {(others.length > 0 || hasMore || page > 1) && (
        <div className="sortrow">
          <span className="muted">Sort by</span>
          <select value={ordering} onChange={(e) => { setOrdering(e.target.value); setPage(1) }}>
            {ORDERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      )}

      {others.map((r) => (
        <div className="review" key={r.id}>
          <strong><Link to={`/u/${r.username}`}>{r.username}</Link></strong> <span className="score">★ {r.rating}</span>
          <span className="muted small"> · {when(r.created_at)}</span>
          <ReviewBody r={r} />
          <div className="reviewfoot">
            <VoteButtons r={r} user={user} onVote={vote} />
            {user && <ReportButton r={r} />}
          </div>
        </div>
      ))}
      {items.length === 0 && !mine && <p className="muted">No reviews yet. Be the first.</p>}
      {hasMore && <p style={{ textAlign: 'center' }}><button className="ghost" onClick={() => setPage(page + 1)}>Load more reviews</button></p>}
    </section>
  )
}
