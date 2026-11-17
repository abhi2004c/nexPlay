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

export default function Media({ slug }) {
  const [m, setM] = useState(null)
  const [open, setOpen] = useState(null) // screenshot index in lightbox

  useEffect(() => {
    setM(null)
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

  return (
    <section className="panel">
      <h2>Trailers &amp; screenshots</h2>
      {m.trailers.length > 0 && (
        <div className="trailers">
          {m.trailers.map((t) => <Trailer key={t.hls || t.name} t={t} steamUrl={m.steam_url} />)}
        </div>
      )}
      {m.screenshots.length > 0 && (
        <div className="shots">
          {m.screenshots.map((s, i) => (
            <button key={s} onClick={() => setOpen(i)} aria-label={`Screenshot ${i + 1}`}>
              <img src={s} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
      {open !== null && (
        <div className="lightbox" onClick={() => setOpen(null)}>
          <img src={m.screenshots[open]} alt="" onClick={(e) => e.stopPropagation()} />
          <span className="muted">{open + 1} / {m.screenshots.length} · ← → to browse · Esc to close</span>
        </div>
      )}
    </section>
  )
}
