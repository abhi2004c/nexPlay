import { useEffect, useState } from 'react'
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

export default function Home() {
  const [seed] = useState(() => Math.floor(Math.random() * 1_000_000)) // a new selection on every visit
  const [recs, setRecs] = useState(undefined) // undefined = loading, null = failed
  const [movies, setMovies] = useState(undefined)
  const [games, setGames] = useState(undefined)
  const [slow, setSlow] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    api('/recommendations/').then(setRecs).catch(() => setRecs(null))
  }, [user])

  useEffect(() => {
    const q = (type) => `/titles/?media_type=${type}&ordering=random&seed=${seed}&page=1`
    api(q('movie')).then((d) => setMovies(d.results)).catch(() => setMovies(null))
    api(q('game')).then((d) => setGames(d.results)).catch(() => setGames(null))
  }, [seed])

  // the free server sleeps when idle: after a few seconds of waiting, say so
  const loading = recs === undefined && movies === undefined && games === undefined
  useEffect(() => {
    if (!loading) { setSlow(false); return }
    const id = setTimeout(() => setSlow(true), 4000)
    return () => clearTimeout(id)
  }, [loading])

  const picks = recs?.results ?? []
  const featured = picks.filter((t) => t.poster_url).slice(0, FEATURED)
  const rest = picks.filter((t) => !featured.includes(t))
  const failed = recs === null && movies === null && games === null

  return (
    <>
      {recs === undefined && <div className="hero hero-skeleton skeleton" aria-hidden="true" />}
      <Hero titles={featured} />

      {slow && loading && (
        <p className="muted">
          Waking up the server — it sleeps when nobody has visited for a while, so the first load can take up to a minute.
        </p>
      )}
      {failed && <p className="error">Could not reach the API. Please try again in a moment.</p>}

      {rest.length > 0 && (
        <Rail
          title={recs.personalized ? 'Recommended for you' : 'More to explore'}
          hint={recs.personalized ? undefined : 'Rate a few titles or add some to your watchlist to get picks based on your taste.'}
        >
          {rest.map((t) => <TitleCard key={t.id} t={t} />)}
        </Rail>
      )}

      {movies === undefined ? <SkeletonRail /> : movies?.length > 0 && (
        <Rail title="Movies" to="/movies" toLabel="See all movies">
          {movies.map((t) => <TitleCard key={t.id} t={t} />)}
        </Rail>
      )}

      {games === undefined ? <SkeletonRail /> : games?.length > 0 && (
        <Rail title="Games" to="/games" toLabel="See all games">
          {games.map((t) => <TitleCard key={t.id} t={t} />)}
        </Rail>
      )}
    </>
  )
}
