import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import TitleCard from '../components/TitleCard.jsx'
import Rail from '../components/Rail.jsx'
import Hero from '../components/Hero.jsx'
import ExternalSearch from '../components/ExternalSearch.jsx'

const COPY = {
  movie: { title: 'Movies', noun: 'movies', blurb: 'Posters, trailers, TMDB ratings and where to watch in your country.' },
  game: { title: 'Games', noun: 'games', blurb: 'Steam and Metacritic scores, trailers, screenshots and where to buy.' },
  '': { title: 'All titles', noun: 'titles', blurb: 'Movies and games together.' },
}
const VIEW_KEY = 'nexplay_view'

function savedView() {
  const fromUrl = new URLSearchParams(window.location.search).get('view') // /games?view=wide
  if (fromUrl === 'wide' || fromUrl === 'poster') return fromUrl
  try { return localStorage.getItem(VIEW_KEY) === 'wide' ? 'wide' : 'poster' } catch { return 'poster' }
}

// The Movies page, the Games page, and the all-titles search page (type ''): one layout.
// The search text comes from the top bar and lives in the URL as ?q=
export default function Browse({ type }) {
  const copy = COPY[type]
  const [params] = useSearchParams()
  const search = params.get('q') || ''
  const { user } = useAuth()
  const [genre, setGenre] = useState('')
  const [ordering, setOrdering] = useState('random') // shuffled by default: different on every visit
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000)) // new per page load, fixed while paging
  const [view, setView] = useState(savedView) // 'poster' (portrait) or 'wide' (landscape)
  const [titles, setTitles] = useState([])
  const [total, setTotal] = useState(null)
  const [genres, setGenres] = useState([])
  const [recs, setRecs] = useState(undefined) // undefined = loading, null = failed
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState('')
  const [showAllGenres, setShowAllGenres] = useState(false)

  useEffect(() => {
    document.title = `${search ? `“${search}”` : copy.title} — NexPlay`
  }, [copy.title, search])

  useEffect(() => {
    api(`/genres/${type ? `?media_type=${type}` : ''}`).then((g) => setGenres(g.slice(0, 24))).catch(() => {})
  }, [type])

  useEffect(() => {
    if (!type) return
    api(`/recommendations/?media_type=${type}`).then(setRecs).catch(() => setRecs(null))
  }, [type, user])

  useEffect(() => { setPage(1) }, [search]) // a new search starts again from the first page

  useEffect(() => {
    const q = new URLSearchParams({ ordering, page })
    if (type) q.set('media_type', type)
    if (ordering === 'random') q.set('seed', seed)
    if (genre) q.set('genre', genre)
    if (search) q.set('search', search)
    let stale = false // ignore answers to a request that has been replaced by a newer one
    setLoading(true)
    api(`/titles/?${q}`)
      .then((d) => {
        if (stale) return
        setTitles((prev) => (page === 1 ? d.results : [...prev, ...d.results]))
        setHasMore(Boolean(d.next))
        setTotal(d.count)
        setError('')
      })
      .catch((e) => { if (!stale) setError(e.message) })
      .finally(() => { if (!stale) setLoading(false) })
    return () => { stale = true }
  }, [type, genre, search, ordering, page, seed])

  // the free server sleeps when idle: after a few seconds of waiting, say so
  useEffect(() => {
    if (!loading) { setSlow(false); return }
    const id = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(id)
  }, [loading])

  const change = (setter) => (value) => { setter(value); setPage(1) }
  const chooseView = (v) => {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* not saved, still works */ }
  }
  const filtering = Boolean(genre || search)
  const recList = recs?.results ?? []
  const featured = type && !filtering ? recList.filter((t) => t.poster_url).slice(0, 5) : []
  const railItems = recList.filter((t) => !featured.includes(t))
  const SHOWN_GENRES = 8
  const visibleGenres = showAllGenres
    ? genres
    : genres.filter((g, i) => i < SHOWN_GENRES || g.name === genre) // a chosen genre always stays visible
  const gridClass = `grid ${view === 'wide' ? 'wide' : ''}`

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{search ? <>Results for “{search}”</> : copy.title}</h1>
          <p className="muted">
            {total != null
              ? `${total.toLocaleString()} ${copy.noun}${filtering ? ' found' : ''}${!type && search ? ', movies and games' : ''}`
              : copy.blurb}
          </p>
        </div>
      </div>

      {type && !filtering && recs === undefined && <div className="hero hero-skeleton skeleton" aria-hidden="true" />}
      <Hero titles={featured} />

      {type && !filtering && railItems.length > 0 && (
        <Rail
          title={recs.personalized ? `Recommended ${copy.noun} for you` : `Discover ${copy.noun}`}
          hint={recs.personalized ? undefined : `Rate a few titles or add some to your watchlist to get ${copy.noun} picked for your taste.`}
        >
          {railItems.map((t) => <TitleCard key={t.id} t={t} />)}
        </Rail>
      )}

      <div className="filterbar">
        <div className="filterrow">
          <select aria-label="Sort" value={ordering} onChange={(e) => change(setOrdering)(e.target.value)}>
            <option value="random">Shuffled</option>
            <option value="-release_date">Newest</option>
            <option value="-avg_rating">Top rated (NexPlay)</option>
            <option value="name">A–Z</option>
          </select>
          <div className="segmented" role="group" aria-label="Card style">
            <button className={view === 'poster' ? 'on' : ''} aria-pressed={view === 'poster'} onClick={() => chooseView('poster')}>Posters</button>
            <button className={view === 'wide' ? 'on' : ''} aria-pressed={view === 'wide'} onClick={() => chooseView('wide')}>Landscape</button>
          </div>
        </div>
        {genres.length > 0 && (
          <div className="pills" role="group" aria-label="Genre">
            <button className={genre === '' ? 'on' : ''} aria-pressed={genre === ''} onClick={() => change(setGenre)('')}>All genres</button>
            {visibleGenres.map((g) => (
              <button key={g.id} className={genre === g.name ? 'on' : ''} aria-pressed={genre === g.name} onClick={() => change(setGenre)(genre === g.name ? '' : g.name)}>
                {g.name}
              </button>
            ))}
            {genres.length > SHOWN_GENRES && (
              <button className="more" onClick={() => setShowAllGenres(!showAllGenres)}>
                {showAllGenres ? 'Fewer genres' : `More genres (${genres.length - SHOWN_GENRES})`}
              </button>
            )}
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
          <div className={gridClass}>{[...Array(8)].map((_, i) => <div key={i} className="card skeleton" />)}</div>
        </>
      )}
      <div className={gridClass}>
        {titles.map((t) => <TitleCard key={t.id} t={t} wide={view === 'wide'} />)}
      </div>
      {!loading && !error && titles.length === 0 && (
        <p className="muted">
          Nothing found{search ? ` for “${search}”` : ''}{genre ? ` in ${genre}` : ''}.{' '}
          {genre && <button className="ghost" onClick={() => { setGenre(''); setPage(1) }}>Clear genre</button>}
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
