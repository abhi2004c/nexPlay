import { useEffect, useState } from 'react'
import { api } from '../api'
import TitleCard from '../components/TitleCard.jsx'
import ExternalSearch from '../components/ExternalSearch.jsx'

const COPY = {
  movie: { title: 'Movies', noun: 'movies', blurb: 'Posters, trailers, TMDB ratings and where to watch in your country.' },
  game: { title: 'Games', noun: 'games', blurb: 'Steam and Metacritic scores, trailers, screenshots and where to buy.' },
}
const VIEW_KEY = 'nexplay_view'

function savedView() {
  const fromUrl = new URLSearchParams(window.location.search).get('view') // /games?view=wide
  if (fromUrl === 'wide' || fromUrl === 'poster') return fromUrl
  try { return localStorage.getItem(VIEW_KEY) === 'wide' ? 'wide' : 'poster' } catch { return 'poster' }
}

// The Movies page and the Games page: same layout, filtered to one kind of title.
export default function Browse({ type }) {
  const copy = COPY[type]
  const [genre, setGenre] = useState('')
  const [search, setSearch] = useState('')
  const [ordering, setOrdering] = useState('random') // shuffled by default: different on every visit
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000)) // new per page load, fixed while paging
  const [view, setView] = useState(savedView) // 'poster' (portrait) or 'wide' (landscape)
  const [titles, setTitles] = useState([])
  const [total, setTotal] = useState(null)
  const [genres, setGenres] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [slow, setSlow] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { document.title = `${copy.title} — NexPlay` }, [copy.title])

  useEffect(() => {
    api(`/genres/?media_type=${type}`).then((g) => setGenres(g.slice(0, 24))).catch(() => {})
  }, [type])

  useEffect(() => {
    const q = new URLSearchParams({ media_type: type, ordering, page })
    if (ordering === 'random') q.set('seed', seed)
    if (genre) q.set('genre', genre)
    if (search) q.set('search', search)
    const id = setTimeout(() => { // wait for the user to stop typing, but don't delay plain clicks
      setLoading(true)
      api(`/titles/?${q}`)
        .then((d) => {
          setTitles((prev) => (page === 1 ? d.results : [...prev, ...d.results]))
          setHasMore(Boolean(d.next))
          setTotal(d.count)
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
  const chooseView = (v) => {
    setView(v)
    try { localStorage.setItem(VIEW_KEY, v) } catch { /* not saved, still works */ }
  }
  const filtering = Boolean(genre || search)

  return (
    <>
      <div className="pagehead">
        <div>
          <h1>{copy.title}</h1>
          <p className="muted">
            {total != null ? `${total.toLocaleString()} ${copy.noun}${filtering ? ' match' : ''}` : copy.blurb}
          </p>
        </div>
      </div>

      <div className="filterbar">
        <div className="filterrow">
          <input
            type="search"
            placeholder={`Search ${copy.noun}…`}
            aria-label={`Search ${copy.noun}`}
            value={search}
            onChange={(e) => change(setSearch)(e.target.value)}
          />
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
          <div className={`grid ${view === 'wide' ? 'wide' : ''}`}>{[...Array(8)].map((_, i) => <div key={i} className="card skeleton" />)}</div>
        </>
      )}
      <div className={`grid ${view === 'wide' ? 'wide' : ''}`}>
        {titles.map((t) => <TitleCard key={t.id} t={t} wide={view === 'wide'} />)}
      </div>
      {!loading && !error && titles.length === 0 && (
        <p className="muted">
          Nothing found{genre ? ` in ${genre}` : ''}.{' '}
          {filtering && <button className="ghost" onClick={() => { setGenre(''); setSearch(''); setPage(1) }}>Clear filters</button>}
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
