import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import TitleCard from '../components/TitleCard.jsx'
import Hero from '../components/Hero.jsx'
import Rail from '../components/Rail.jsx'
import { useAuth } from '../auth.jsx'

const FEATURED = 5

function SkeletonRail() {
  return (
    <section className="rail" aria-hidden="true">
      <div className="railhead"><h2 className="skeleton skeleton-line" /></div>
      <div className="scroll">{[...Array(7)].map((_, i) => <div key={i} className="card skeleton" />)}</div>
    </section>
  )
}

// The home page: movies AND games together, with picks for both and a grid of everything.
export default function Home() {
  const { user } = useAuth()
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000)) // a new selection on every visit
  const [mixed, setMixed] = useState(undefined) // undefined = loading, null = failed
  const [movies, setMovies] = useState(undefined)
  const [games, setGames] = useState(undefined)
  const [all, setAll] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [allLoading, setAllLoading] = useState(true)
  const [slow, setSlow] = useState(false)

  useEffect(() => {
    api('/recommendations/').then(setMixed).catch(() => setMixed(null))
    api('/recommendations/?media_type=movie').then(setMovies).catch(() => setMovies(null))
    api('/recommendations/?media_type=game').then(setGames).catch(() => setGames(null))
  }, [user])

  useEffect(() => {
    let stale = false
    setAllLoading(true)
    api(`/titles/?ordering=random&seed=${seed}&page=${page}`)
      .then((d) => {
        if (stale) return
        setAll((prev) => (page === 1 ? d.results : [...prev, ...d.results]))
        setHasMore(Boolean(d.next))
      })
      .catch(() => {})
      .finally(() => { if (!stale) setAllLoading(false) })
    return () => { stale = true }
  }, [seed, page])

  // the free server sleeps when idle: after a few seconds of waiting, say so
  const loading = mixed === undefined && movies === undefined && games === undefined
  useEffect(() => {
    if (!loading) { setSlow(false); return }
    const id = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(id)
  }, [loading])

  const picks = mixed?.results ?? []
  const featured = picks.filter((t) => t.poster_url).slice(0, FEATURED)
  const rest = picks.filter((t) => !featured.includes(t))
  const failed = mixed === null && movies === null && games === null

  const typeRail = (data, noun, to) => {
    if (data === undefined) return <SkeletonRail />
    if (!data?.results?.length) return null
    return (
      <Rail
        title={data.personalized ? `${noun} for you` : `${noun} to discover`}
        to={to}
        toLabel={`See all ${noun.toLowerCase()}`}
      >
        {data.results.map((t) => <TitleCard key={t.id} t={t} />)}
      </Rail>
    )
  }

  return (
    <>
      {mixed === undefined && <div className="hero hero-skeleton skeleton" aria-hidden="true" />}
      <Hero titles={featured} />

      {slow && loading && (
        <p className="muted">
          Waking up the server — it sleeps when nobody has visited for a while, so the first load can take up to a minute.
        </p>
      )}
      {failed && <p className="error">Could not reach the API. Please try again in a moment.</p>}

      {rest.length > 0 && (
        <Rail
          title={mixed.personalized ? 'Recommended for you' : 'More to explore'}
          hint={mixed.personalized ? undefined : 'Rate a few titles or add some to your watchlist to get picks based on your taste.'}
        >
          {rest.map((t) => <TitleCard key={t.id} t={t} />)}
        </Rail>
      )}

      {typeRail(movies, 'Movies', '/movies')}
      {typeRail(games, 'Games', '/games')}

      <section className="allsection">
        <div className="railhead">
          <div>
            <h2>Everything on NexPlay</h2>
            <p className="muted small">Movies and games together. Use the search box above to find a specific title.</p>
          </div>
          <div className="railbtns">
            <Link className="seeall" to="/movies">Movies →</Link>
            <Link className="seeall" to="/games">Games →</Link>
          </div>
        </div>
        <div className="grid">
          {allLoading && all.length === 0 && [...Array(10)].map((_, i) => <div key={i} className="card skeleton" />)}
          {all.map((t) => <TitleCard key={t.id} t={t} />)}
        </div>
        {hasMore && (
          <p style={{ textAlign: 'center' }}>
            <button className="ghost" disabled={allLoading} onClick={() => setPage(page + 1)}>
              {allLoading ? 'Loading…' : 'Load more'}
            </button>
          </p>
        )}
      </section>
    </>
  )
}
