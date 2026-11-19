import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import TitleCard from '../components/TitleCard.jsx'

const STATUSES = {
  planned: 'Wishlist',
  in_progress: 'Watching / playing',
  completed: 'Completed',
  dropped: 'Dropped',
}

// The user's watchlist as a grid of tiles (same cards as the rest of the site), filterable by status.
export default function Watchlist() {
  const { user } = useAuth()
  const [items, setItems] = useState(null)
  const [filter, setFilter] = useState('all')
  const [error, setError] = useState('')

  useEffect(() => { document.title = 'Watchlist — NexPlay' }, [])

  const load = useCallback(async () => {
    try {
      let url = '/watchlist/'
      const all = []
      while (url) { // follow pagination so long lists are complete
        const d = await api(url)
        all.push(...d.results)
        url = d.next ? d.next.replace(/^.*\/api/, '') : null
      }
      setItems(all)
      setError('')
    } catch (e) { setError(e.message) }
  }, [])
  useEffect(() => { if (user) load() }, [user, load])

  if (!user) return <p>Please <Link to="/login">log in</Link> to see your watchlist.</p>

  const setStatus = (id, status) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
    api(`/watchlist/${id}/`, { method: 'PATCH', body: { status } }).catch(load)
  }
  const remove = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
    api(`/watchlist/${id}/`, { method: 'DELETE' }).catch(load)
  }

  const counts = (items || []).reduce((c, i) => ({ ...c, [i.status]: (c[i.status] || 0) + 1 }), {})
  const shown = (items || []).filter((i) => filter === 'all' || i.status === filter)

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>My watchlist</h1>
          <p className="muted">{items ? `${items.length} saved title${items.length === 1 ? '' : 's'}` : 'Loading…'}</p>
        </div>
      </div>

      {items && items.length > 0 && (
        <div className="pills" role="group" aria-label="Status">
          <button className={filter === 'all' ? 'on' : ''} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All ({items.length})
          </button>
          {Object.entries(STATUSES).map(([v, l]) => (
            <button key={v} className={filter === v ? 'on' : ''} aria-pressed={filter === v} onClick={() => setFilter(v)}>
              {l} ({counts[v] || 0})
            </button>
          ))}
        </div>
      )}

      {error && <p className="error">Could not load your watchlist: {error}</p>}
      {items && items.length === 0 && (
        <p className="muted">Empty. Add movies and games with the “+ Watchlist” button, then they show up here. <Link to="/">Browse titles</Link></p>
      )}
      {items && items.length > 0 && shown.length === 0 && <p className="muted">Nothing with that status yet.</p>}

      <div className="grid">
        {items === null && !error && [...Array(6)].map((_, i) => <div key={i} className="card skeleton" />)}
        {shown.map((i) => (
          <TitleCard key={i.id} t={i.title} hideWatch>
            <div className="wl-controls">
              <select aria-label={`Status of ${i.title_name}`} value={i.status} onChange={(e) => setStatus(i.id, e.target.value)}>
                {Object.entries(STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button className="ghost" onClick={() => remove(i.id)} aria-label={`Remove ${i.title_name}`}>Remove</button>
            </div>
          </TitleCard>
        ))}
      </div>
    </>
  )
}
