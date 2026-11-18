import { useEffect, useState } from 'react'
import { api } from '../api'
import TitleCard from '../components/TitleCard.jsx'
import { useAuth } from '../auth.jsx'
import ExternalSearch from '../components/ExternalSearch.jsx'

export default function Home() {
  const [type, setType] = useState('')
  const [search, setSearch] = useState('')
  const [ordering, setOrdering] = useState('random') // shuffled by default: different on every visit
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000)) // new per page load, fixed while paging
  const [titles, setTitles] = useState([])
  const [error, setError] = useState('')
  const [recs, setRecs] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [slow, setSlow] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    api('/recommendations/').then(setRecs).catch(() => setRecs(null))
  }, [user])

  useEffect(() => {
    const q = new URLSearchParams({ ordering, page })
    if (ordering === 'random') q.set('seed', seed)
    if (type) q.set('media_type', type)
    if (search) q.set('search', search)
    // wait for the user to stop typing, but don't delay plain clicks and the first load
    const id = setTimeout(() => {
      setLoading(true)
      api(`/titles/?${q}`)
        .then((d) => {
          setTitles((prev) => (page === 1 ? d.results : [...prev, ...d.results]))
          setHasMore(Boolean(d.next))
          setError('')
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false))
    }, search ? 250 : 0)
    return () => clearTimeout(id)
  }, [type, search, ordering, page, seed])

  // the free server sleeps when idle: after a few seconds of waiting, say so
  useEffect(() => {
    if (!loading) { setSlow(false); return }
    const id = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(id)
  }, [loading])

  const change = (setter) => (value) => { setter(value); setPage(1) }

  return (
    <>
      {recs?.results?.length > 0 && (
        <section className="rail">
          <h2>{recs.personalized ? 'Recommended for you' : 'Discover something new'}</h2>
          {!recs.personalized && (
            <p className="muted">Rate a few titles or add some to your watchlist to get personalized picks.</p>
          )}
          <div className="scroll">{recs.results.map((t) => <TitleCard key={t.id} t={t} />)}</div>
        </section>
      )}
      <h2>Browse</h2>
      <div className="filters">
        {[['', 'All'], ['movie', 'Movies'], ['game', 'Games']].map(([v, l]) => (
          <button key={v} className={type === v ? 'btn' : 'ghost'} onClick={() => change(setType)(v)}>{l}</button>
        ))}
        <input placeholder="Search titles…" value={search} onChange={(e) => change(setSearch)(e.target.value)} />
        <select value={ordering} onChange={(e) => change(setOrdering)(e.target.value)}>
          <option value="random">Shuffled</option>
          <option value="-release_date">Newest</option>
          <option value="-avg_rating">Top rated</option>
          <option value="name">A–Z</option>
        </select>
      </div>
      {error && <p className="error">Could not reach the API: {error}</p>}
      {loading && titles.length === 0 && !error && (
        <>
          {slow && (
            <p className="muted">
              Waking up the server — it sleeps when nobody has visited for a while, so the first load can take up to a minute.
            </p>
          )}
          <div className="grid">{[...Array(8)].map((_, i) => <div key={i} className="card skeleton" />)}</div>
        </>
      )}
      <div className="grid">{titles.map((t) => <TitleCard key={t.id} t={t} />)}</div>
      {!loading && !error && titles.length === 0 && <p className="muted">Nothing found.</p>}
      {search.trim().length >= 2 && <ExternalSearch query={search.trim()} type={type} />}
      {hasMore && (
        <p style={{ textAlign: 'center' }}>
          <button className="ghost" onClick={() => setPage(page + 1)}>Load more</button>
        </p>
      )}
    </>
  )
}
