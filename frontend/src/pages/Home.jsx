import { useEffect, useState } from 'react'
import { api } from '../api'
import TitleCard from '../components/TitleCard.jsx'
import Hero from '../components/Hero.jsx'
import Rail from '../components/Rail.jsx'
import { useAuth } from '../auth.jsx'
import ExternalSearch from '../components/ExternalSearch.jsx'

const TYPES = [['', 'All'], ['movie', 'Movies'], ['game', 'Games']]
const FEATURED = 5

export default function Home() {
  const [type, setType] = useState('')
  const [genre, setGenre] = useState('')
  const [search, setSearch] = useState('')
  const [ordering, setOrdering] = useState('random') // shuffled by default: different on every visit
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000)) // new per page load, fixed while paging
  const [titles, setTitles] = useState([])
  const [error, setError] = useState('')
  const [recs, setRecs] = useState(undefined) // undefined = loading, null = failed
  const [genres, setGenres] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [slow, setSlow] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    api('/recommendations/').then(setRecs).catch(() => setRecs(null))
  }, [user])

  useEffect(() => {
    api('/genres/').then((g) => setGenres(g.slice(0, 24))).catch(() => {})
  }, [])

  useEffect(() => {
    const q = new URLSearchParams({ ordering, page })
    if (ordering === 'random') q.set('seed', seed)
    if (type) q.set('media_type', type)
    if (genre) q.set('genre', genre)
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
  }, [type, genre, search, ordering, page, seed])

  // the free server sleeps when idle: after a few seconds of waiting, say so
  useEffect(() => {
    if (!loading) { setSlow(false); return }
    const id = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(id)
  }, [loading])

  const change = (setter) => (value) => { setter(value); setPage(1) }

  const picks = recs?.results ?? []
  const featured = picks.filter((t) => t.poster_url).slice(0, FEATURED)
  const rail = picks.filter((t) => !featured.includes(t))
  const filtering = Boolean(type || genre || search)

  return (
    <>
      {recs === undefined && <div className="hero hero-skeleton skeleton" aria-hidden="true" />}
      {!filtering && <Hero titles={featured} />}

      {rail.length > 0 && !filtering && (
        <Rail
          title={recs.personalized ? 'Recommended for you' : 'More to explore'}
          hint={recs.personalized ? undefined : 'Rate a few titles or add some to your watchlist to get picks based on your taste.'}
        >
          {rail.map((t) => <TitleCard key={t.id} t={t} />)}
        </Rail>
      )}

      <div className="filterbar">
        <div className="filterrow">
          <div className="segmented" role="group" aria-label="Type">
            {TYPES.map(([v, l]) => (
              <button key={v} className={type === v ? 'on' : ''} aria-pressed={type === v} onClick={() => change(setType)(v)}>{l}</button>
            ))}
          </div>
          <input
            type="search"
            placeholder="Search movies and games…"
            aria-label="Search titles"
            value={search}
            onChange={(e) => change(setSearch)(e.target.value)}
          />
          <select aria-label="Sort" value={ordering} onChange={(e) => change(setOrdering)(e.target.value)}>
            <option value="random">Shuffled</option>
            <option value="-release_date">Newest</option>
            <option value="-avg_rating">Top rated (NexPlay)</option>
            <option value="name">A–Z</option>
          </select>
        </div>
        {genres.length > 0 && (
          <div className="pills" role="group" aria-label="Genre">
            <button className={genre === '' ? 'on' : ''} aria-pressed={genre === ''} onClick={() => change(setGenre)('')}>All genres</button>
            {genres.map((g) => (
              <button key={g.id} className={genre === g.name ? 'on' : ''} aria-pressed={genre === g.name} onClick={() => change(setGenre)(genre === g.name ? '' : g.name)}>
                {g.name}
              </button>
            ))}
          </div>
        )}
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
      {!loading && !error && titles.length === 0 && (
        <p className="muted">
          Nothing found{genre ? ` in ${genre}` : ''}.{' '}
          {filtering && <button className="ghost" onClick={() => { setType(''); setGenre(''); setSearch(''); setPage(1) }}>Clear filters</button>}
        </p>
      )}
      {search.trim().length >= 2 && <ExternalSearch query={search.trim()} type={type} />}
      {hasMore && (
        <p style={{ textAlign: 'center' }}>
          <button className="ghost" disabled={loading} onClick={() => setPage(page + 1)}>{loading ? 'Loading…' : 'Load more'}</button>
        </p>
      )}
    </>
  )
}
