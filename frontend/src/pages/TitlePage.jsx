import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import TitleCard from '../components/TitleCard.jsx'
import Deals from '../components/Deals.jsx'
import Media from '../components/Media.jsx'
import MovieTrailer, { TmdbReviews } from '../components/MovieInfo.jsx'
import SteamReviews from '../components/SteamReviews.jsx'
import SteamIcon from '../components/SteamIcon.jsx'
import WatchProviders from '../components/WatchProviders.jsx'
import { steamLabel, steamTone } from '../steam.js'
import { cleanDescription } from '../text.js'
import Reviews from '../components/Reviews.jsx'

export default function TitlePage() {
  const { slug } = useParams()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = ['overview', 'reviews', 'discussion'].includes(params.get('tab')) ? params.get('tab') : 'overview'
  const setTab = (id) => setParams(id === 'overview' ? {} : { tab: id }, { replace: true })
  const [t, setT] = useState(null)
  const [threads, setThreads] = useState([])
  const [subject, setSubject] = useState('')
  const [tbody, setTbody] = useState('')
  const [msg, setMsg] = useState('')
  const [analysis, setAnalysis] = useState(null)
  const [similar, setSimilar] = useState([])
  const [info, setInfo] = useState(null) // movie-only extras: IMDb/TMDB rating and trailer

  // Each part loads and renders on its own, so the title shows as soon as it arrives.
  const current = useRef(slug)
  const load = useCallback(() => {
    const ifCurrent = (fn) => (d) => { if (current.current === slug) fn(d) }
    return Promise.all([
      api(`/titles/${slug}/`).then(ifCurrent(setT)),
      api(`/threads/?title=${slug}`).then(ifCurrent((r) => setThreads(r.results))),
      api(`/titles/${slug}/analysis/`).then(ifCurrent(setAnalysis)),
      api(`/titles/${slug}/similar/`).then(ifCurrent(setSimilar)),
    ])
  }, [slug])

  useEffect(() => {
    current.current = slug
    // clear the previous title right away instead of showing it while the new one loads
    setT(null); setThreads([]); setAnalysis(null); setSimilar([]); setInfo(null); setMsg('')
    window.scrollTo(0, 0)
    load().catch((e) => setMsg(e.message))
  }, [slug, load])

  // movies: IMDb rating + trailer, fetched separately so the page never waits for them
  const isMovie = t?.media_type === 'movie'
  useEffect(() => {
    if (!isMovie) return
    api(`/titles/${slug}/movie-info/`)
      .then((d) => { if (current.current === slug) setInfo(d) })
      .catch(() => {})
  }, [isMovie, slug])

  const run = (fn, ok) => async (e) => {
    e?.preventDefault()
    try {
      await fn()
      setMsg(ok || '')
      await load()
    } catch (err) {
      setMsg(err.message)
    }
  }

  if (!t) return <p className="muted">{msg || 'Loading…'}</p>

  const bg = t.backdrop_url || t.poster_url
  const tabs = [
    ['overview', 'Overview'],
    ['reviews', `Reviews${t.rating_count ? ` · ${t.rating_count}` : ''}`],
    ['discussion', `Discussion${threads.length ? ` · ${threads.length}` : ''}`],
  ]

  return (
    <>
      <header className="thero">
        {bg && <div className="thero-bg" style={{ backgroundImage: `url(${bg})` }} aria-hidden="true" />}
        <div className="thero-body">
          <div className={`poster big ${t.media_type}`}>
            {t.poster_url ? <img src={t.poster_url} alt="" /> : <span>{t.name[0]}</span>}
          </div>
          <div className="thero-info">
            <p className="kicker">{t.media_type === 'movie' ? 'Movie' : 'Game'}</p>
            <h1>{t.name}</h1>
            <p className="muted">
              {[t.release_date?.slice(0, 4), t.creator, t.runtime_minutes ? `${t.runtime_minutes} min` : '', t.platforms].filter(Boolean).join(' · ')}
            </p>
            <p>{t.genres.map((g) => <span className="tag" key={g}>{g}</span>)}</p>
            <div className="ratingrow">
          {t.media_type === 'movie' && info?.imdb?.score != null && (
                <p className="score">
                  <a className="srctag imdb" href={info.imdb.url} target="_blank" rel="noreferrer">IMDb</a>
                  ★ {info.imdb.score}/10 {info.imdb.votes && <span className="muted">{info.imdb.votes} votes</span>}
                </p>
              )}
              {t.media_type === 'movie' && info?.tmdb?.score != null && (
                <p className="score" title="Average rating from TMDB members">
                  <a className="srctag tmdb" href={info.tmdb.url} target="_blank" rel="noreferrer">TMDB</a>
                  ★ {info.tmdb.score}/10 <span className="muted">{info.tmdb.votes.toLocaleString()} votes</span>
                </p>
              )}
              {t.media_type === 'game' && t.external_rating != null && (() => {
                const pct = Math.round(t.external_rating * 10)
                return (
                  <a className="steamrating" href={`https://store.steampowered.com/app/${t.steam_app_id}#app_reviews_hash`} target="_blank" rel="noreferrer" title="Open the reviews on Steam">
                    <SteamIcon size={30} />
                    <span>
                      <strong className={steamTone(pct)}>{steamLabel(pct, t.external_votes) || `${pct}% positive`}</strong>
                      <span className="muted small">{pct}% of {t.external_votes.toLocaleString()} Steam reviews are positive (all languages)</span>
                    </span>
                    <b className={`pct ${steamTone(pct)}`}>{pct}%</b>
                  </a>
                )
              })()}
              {t.rating_count > 0 ? (
                <p className="score">
                  <span className="srctag nex">NexPlay</span>
                  ★ {t.avg_rating} <span className="muted">{t.rating_count} review{t.rating_count === 1 ? '' : 's'}</span>
                </p>
              ) : (
                <p className="muted">No NexPlay reviews yet. Be the first to review it.</p>
              )}
              {t.metacritic != null && (
                <p>
                  <a className="metabadge" href={t.metacritic_url || undefined} target="_blank" rel="noreferrer" title="Metacritic score">
                    <b className={t.metacritic >= 75 ? 'good' : t.metacritic >= 50 ? 'mid' : 'bad'}>{t.metacritic}</b> Metacritic
                  </a>
                </p>
              )}
            </div>
            <div className="thero-actions">
              {user ? (
                <button className="btn" onClick={run(() => api('/watchlist/', { method: 'POST', body: { title_slug: slug } }), 'Added to your watchlist')}>
                  + Watchlist
                </button>
              ) : (
                <Link className="btn" to="/login">Log in to review &amp; save</Link>
              )}
              <button className="ghost" onClick={() => setTab('reviews')}>Write a review</button>
            </div>
            {msg && <p className="muted" role="status">{msg}</p>}
          </div>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Sections">
        {tabs.map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <section className="panel about">
            <h2>About</h2>
            <p style={{ whiteSpace: 'pre-line' }}>{cleanDescription(t.description) || 'No description yet.'}</p>
          </section>
          {t.media_type === 'movie' && <MovieTrailer info={info} />}
          {t.media_type === 'movie' && <WatchProviders slug={slug} />}
          {t.media_type === 'game' && <Media slug={slug} />}
          {t.media_type === 'game' && <Deals slug={slug} />}
      {analysis && (
          <section className="panel">
            <h2>Review analysis</h2>
            <p>{analysis.summary}</p>
            {analysis.positive + analysis.neutral + analysis.negative > 0 && (
              <div className="sentbar">
                {['positive', 'neutral', 'negative'].map((k) => (
                  <span key={k} className={k} style={{ flex: analysis[k] }} title={`${k}: ${analysis[k]}`} />
                ))}
              </div>
            )}
            <p>{analysis.keywords.map((k) => <span className="tag" key={k}>{k}</span>)}</p>
          </section>
        )}

        </>
      )}

      {tab === 'reviews' && (
        <>
          <Reviews slug={slug} onChange={() => load().catch(() => {})} />
          {t.media_type === 'game' && t.steam_app_id && <SteamReviews slug={slug} />}
          {t.media_type === 'movie' && <TmdbReviews info={info} />}
        </>
      )}

      {tab === 'discussion' && (
      <section className="panel">
          <h2>Discussion</h2>
          {user && (
            <form
              onSubmit={run(() =>
                api('/threads/', { method: 'POST', body: { title_slug: slug, subject, body: tbody } }).then(() => {
                  setSubject('')
                  setTbody('')
                }),
              )}
            >
              <input placeholder="Thread subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
              <textarea placeholder="Start a conversation…" value={tbody} onChange={(e) => setTbody(e.target.value)} required />
              <button className="btn">Start thread</button>
            </form>
          )}
          {threads.map((th) => <Thread key={th.id} th={th} user={user} />)}
          {threads.length === 0 && <p className="muted">No threads yet.</p>}
        </section>
      )}

      {similar.length > 0 && (
        <section className="rail">
          <h2>More like this</h2>
          <div className="scroll">{similar.map((s) => <TitleCard key={s.id} t={s} />)}</div>
        </section>
      )}
    </>
  )
}

function Thread({ th, user }) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')
  const load = () => api(`/comments/?thread=${th.id}`).then((d) => setComments(d.results))
  const toggle = () => {
    if (!open) load()
    setOpen(!open)
  }
  const reply = (e) => {
    e.preventDefault()
    api('/comments/', { method: 'POST', body: { thread: th.id, body: text } }).then(() => {
      setText('')
      load()
    })
  }

  return (
    <div className="review">
      <strong onClick={toggle} style={{ cursor: 'pointer' }}>{th.subject}</strong>
      <span className="muted"> by {th.author} · {th.comment_count} replies</span>
      <p>{th.body}</p>
      {open && (
        <>
          {comments.map((c) => <p className="comment" key={c.id}><b>{c.author}:</b> {c.body}</p>)}
          {user && (
            <form className="inline" onSubmit={reply}>
              <input placeholder="Reply…" value={text} onChange={(e) => setText(e.target.value)} required />
              <button className="btn">Reply</button>
            </form>
          )}
        </>
      )}
    </div>
  )
}
