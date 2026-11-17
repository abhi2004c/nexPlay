import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'

const STATUSES = {
  planned: 'Plan to watch/play',
  in_progress: 'In progress',
  completed: 'Completed',
  dropped: 'Dropped',
}

export default function Watchlist() {
  const { user } = useAuth()
  const [items, setItems] = useState([])

  const load = useCallback(() => api('/watchlist/').then((d) => setItems(d.results)), [])
  useEffect(() => { if (user) load() }, [user, load])

  if (!user) return <p>Please <Link to="/login">log in</Link> to see your watchlist.</p>

  const setStatus = (id, status) =>
    api(`/watchlist/${id}/`, { method: 'PATCH', body: { status } }).then(load)

  return (
    <div className="panel">
      <h2>My watchlist</h2>
      {items.length === 0 && <p className="muted">Empty. Add titles from their pages.</p>}
      {items.map((i) => (
        <div className="row" key={i.id}>
          <Link to={`/title/${i.title_slug}`}>{i.title_name}</Link>
          <div className="grow" />
          <select value={i.status} onChange={(e) => setStatus(i.id, e.target.value)}>
            {Object.entries(STATUSES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <button className="ghost" onClick={() => api(`/watchlist/${i.id}/`, { method: 'DELETE' }).then(load)}>
            Remove
          </button>
        </div>
      ))}
    </div>
  )
}
