import { useEffect, useRef, useState } from 'react'
import { api } from '../api'

function Trailer({ t, steamUrl }) {
  const ref = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!playing || !ref.current) return
    const v = ref.current
    let hls
    let cancelled = false
    if (t.mp4) {
      v.src = t.mp4
      v.play().catch(() => {})
    } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
      v.src = t.hls // Safari plays HLS natively
      v.play().catch(() => {})
    } else {
      import('hls.js') // loaded only when a trailer is played
        .then(({ default: Hls }) => {
          if (cancelled) return
          if (!Hls.isSupported() || !t.hls) return setFailed(true)
          hls = new Hls()
          hls.on(Hls.Events.ERROR, (_, d) => { if (d.fatal) setFailed(true) })
          hls.loadSource(t.hls)
          hls.attachMedia(v)
          v.play().catch(() => {})
        })
        .catch(() => setFailed(true))
    }
    return () => { cancelled = true; hls?.destroy() }
  }, [playing, t])

  if (failed) {
    return (
      <a className="trailer fallback" href={steamUrl} target="_blank" rel="noreferrer">
        <img src={t.thumbnail} alt="" />
        <span>Couldn’t play here — watch on Steam</span>
      </a>
    )
  }
  return playing ? (
    <video ref={ref} className="trailer" controls playsInline poster={t.thumbnail} />
  ) : (
    <button className="trailer thumb" onClick={() => setPlaying(true)} aria-label={`Play ${t.name}`}>
      <img src={t.thumbnail} alt="" />
      <span className="play">▶</span>
      <em>{t.name}</em>
    </button>
  )
}

const TRAILERS_FIRST = 4
const SHOTS_FIRST = 12

export default function Media({ slug }) {
  const [m, setM] = useState(null)
  const [open, setOpen] = useState(null) // screenshot index in lightbox
  const [allTrailers, setAllTrailers] = useState(false)
  const [allShots, setAllShots] = useState(false)

  useEffect(() => {
    setM(null)
    setOpen(null); setAllTrailers(false); setAllShots(false)
    api(`/titles/${slug}/media/`).then(setM).catch(() => setM({ trailers: [], screenshots: [] }))
  }, [slug])

  useEffect(() => {
    if (open === null) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(null)
      if (e.key === 'ArrowRight') setOpen((i) => (i + 1) % m.screenshots.length)
      if (e.key === 'ArrowLeft') setOpen((i) => (i - 1 + m.screenshots.length) % m.screenshots.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, m])

  if (!m || (m.trailers.length === 0 && m.screenshots.length === 0)) return null

  const shownTrailers = allTrailers ? m.trailers : m.trailers.slice(0, TRAILERS_FIRST)
  const shownShots = allShots ? m.screenshots : m.screenshots.slice(0, SHOTS_FIRST)
  const step = (d) => setOpen((i) => (i + d + m.screenshots.length) % m.screenshots.length)

  return (
    <section className="panel">
      {m.trailers.length > 0 && (
        <>
          <h2>Trailers <span className="muted count">{m.trailers.length}</span></h2>
          <div className="trailers">
            {shownTrailers.map((t) => <Trailer key={t.hls || t.name} t={t} steamUrl={m.steam_url} />)}
          </div>
          {m.trailers.length > TRAILERS_FIRST && (
            <p><button className="ghost" onClick={() => setAllTrailers(!allTrailers)}>
              {allTrailers ? 'Show fewer trailers' : `Show all ${m.trailers.length} trailers`}
            </button></p>
          )}
        </>
      )}
      {m.screenshots.length > 0 && (
        <>
          <h2>Screenshots <span className="muted count">{m.screenshots.length}</span></h2>
          <div className="shots">
            {shownShots.map((s, i) => (
              <button key={s.full} onClick={() => setOpen(i)} aria-label={`Open screenshot ${i + 1} of ${m.screenshots.length}`}>
                <img src={s.thumb} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          {m.screenshots.length > SHOTS_FIRST && (
            <p><button className="ghost" onClick={() => setAllShots(!allShots)}>
              {allShots ? 'Show fewer screenshots' : `Show all ${m.screenshots.length} screenshots`}
            </button></p>
          )}
        </>
      )}
      {m.source === 'steam' && m.steam_url && (
        <p className="muted small">Media from the game’s <a href={m.steam_url} target="_blank" rel="noreferrer">Steam store page</a>.</p>
      )}
      {open !== null && (
        <div className="lightbox" onClick={() => setOpen(null)} role="dialog" aria-label="Screenshot viewer">
          <button className="lbnav prev" aria-label="Previous screenshot" onClick={(e) => { e.stopPropagation(); step(-1) }}>‹</button>
          <img src={m.screenshots[open].full} alt="" onClick={(e) => e.stopPropagation()} />
          <button className="lbnav next" aria-label="Next screenshot" onClick={(e) => { e.stopPropagation(); step(1) }}>›</button>
          <span className="muted lbcount">{open + 1} / {m.screenshots.length} · ← → to browse · Esc to close</span>
        </div>
      )}
    </section>
  )
}
