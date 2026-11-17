import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'

export default function ExternalSearch({ query, type }) {
  const { user } = useAuth()
  const nav = useNavigate()
  const [status, setStatus] = useState('idle') // idle | loading | done
  const [results, setResults] = useState([])
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(null)

  // a new search term or filter resets the panel
  useEffect(() => { setStatus('idle'); setResults([]); setError('') }, [query, type])

  async function run() {
    setStatus('loading'); setError('')
    try {
      const d = await api(`/external/search/?q=${encodeURIComponent(query)}&type=${type || 'all'}`)
      setResults(d.results)
      setStatus('done')
    } catch (e) {
      setError(e.message)
      setStatus('idle')
    }
  }

  async function add(r) {
    setAdding(r.external_id); setError('')
    try {
      const d = await api('/external/import/', { method: 'POST', body: { media_type: r.media_type, external_id: r.external_id } })
      nav(`/title/${d.slug}`)
    } catch (e) {
      setError(e.message)
      setAdding(null)
    }
  }

  return (
    <section className="panel external">
      <h2>Can’t find it?</h2>
      {!user ? (
        <p className="muted"><Link to="/login">Log in</Link> to search online and add “{query}” to NexPlay.</p>
      ) : (
        <>
          {status === 'idle' && (
            <p>
              <button className="btn" onClick={run}>Search online for “{query}”</button>{' '}
              <span className="muted small">Looks up {type === 'movie' ? 'movies' : type === 'game' ? 'games' : 'games and movies'} on RAWG / TMDB.</span>
            </p>
          )}
          {status === 'loading' && <p className="muted">Searching…</p>}
          {error && <p className="error">{error}</p>}
          {status === 'done' && results.length === 0 && <p className="muted">No matches found online either.</p>}
          {results.map((r) => (
            <div className="row" key={`${r.media_type}-${r.external_id}`}>
              <div className="thumbsm">{r.poster ? <img src={r.poster} alt="" loading="lazy" /> : <span>{r.name[0]}</span>}</div>
              <div>
                <strong>{r.name}</strong>
                <div className="muted small">{r.media_type === 'movie' ? 'Movie' : 'Game'}{r.year ? ` · ${r.year}` : ''}</div>
              </div>
              <div className="grow" />
              {r.existing_slug ? (
                <Link className="btn" to={`/title/${r.existing_slug}`}>Open</Link>
              ) : (
                <button className="btn" disabled={adding !== null} onClick={() => add(r)}>
                  {adding === r.external_id ? 'Adding…' : 'Add & open'}
                </button>
              )}
            </div>
          ))}
          {status === 'done' && <p className="muted small">Adding a title makes it available to everyone on NexPlay. Limit: 20 additions per day.</p>}
        </>
      )}
    </section>
  )
}
