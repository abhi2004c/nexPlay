import { useEffect, useRef, useState } from 'react'

// One trailer, shown inside the gallery stage: a poster with a big play button, then the video.
function TrailerStage({ t, steamUrl }) {
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
      <a className="stage-fallback" href={steamUrl} target="_blank" rel="noreferrer">
        <img src={t.thumbnail} alt="" />
        <span>Couldn’t play here — watch on Steam ↗</span>
      </a>
    )
  }
  if (playing) return <video ref={ref} className="stage-video" controls playsInline poster={t.thumbnail} />
  return (
    <button className="stage-poster" onClick={() => setPlaying(true)} aria-label={`Play ${t.name}`}>
      <img src={t.thumbnail} alt="" />
      <span className="bigplay" aria-hidden="true">▶</span>
      <em>{t.name}</em>
    </button>
  )
}

// A YouTube video: poster with a play button, then the embedded player (loaded only when played).
function YouTubeStage({ t }) {
  const [playing, setPlaying] = useState(false)
  if (playing) {
    return (
      <iframe className="stage-video" src={`https://www.youtube-nocookie.com/embed/${t.key}?autoplay=1&rel=0`} title={t.name}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
    )
  }
  return (
    <button className="stage-poster" onClick={() => setPlaying(true)} aria-label={`Play ${t.name}`}>
      <img src={`https://i.ytimg.com/vi/${t.key}/hqdefault.jpg`} alt="" />
      <span className="bigplay" aria-hidden="true">▶</span>
      <em>{t.name}</em>
    </button>
  )
}

const TABS = [['all', 'All'], ['video', 'Trailers'], ['image', 'Screenshots']]

// Steam-store style gallery used for games (Steam trailers + screenshots) and movies (YouTube videos + stills):
// a large stage, a strip of thumbnails, filter tabs and keyboard navigation.
// videos: [{ name, thumbnail, hls?, mp4?  |  key (YouTube) }]   images: [{ thumb, full }]
export default function Gallery({ videos, images, title, steamUrl, credit, imageLabel = 'Screenshots' }) {
  const [tab, setTab] = useState('all')
  const [idx, setIdx] = useState(0)
  const [lb, setLb] = useState(null) // image index in the full-screen viewer
  const strip = useRef(null)
  const m = { trailers: videos, screenshots: images, steam_url: steamUrl }

  const all = [
    ...videos.map((t) => ({
      kind: 'video', t, key: `v:${t.key || t.hls || t.mp4 || t.name}`,
      thumb: t.thumbnail || `https://i.ytimg.com/vi/${t.key}/mqdefault.jpg`,
    })),
    ...images.map((s, i) => ({ kind: 'image', s, shot: i, thumb: s.thumb, key: `i:${s.full}` })),
  ]
  const items = tab === 'all' ? all : all.filter((x) => x.kind === tab)
  const count = items.length
  const cur = items[Math.min(idx, count - 1)]
  const go = (d) => setIdx((i) => (i + d + count) % count)

  // keep the selected thumbnail centred in the strip
  useEffect(() => {
    const el = strip.current?.children[idx]
    if (el) strip.current.scrollTo({ left: el.offsetLeft - strip.current.clientWidth / 2 + el.clientWidth / 2, behavior: 'smooth' })
  }, [idx, tab, count])

  // full-screen viewer for screenshots
  useEffect(() => {
    if (lb === null) return
    const n = m.screenshots.length
    const onKey = (e) => {
      if (e.key === 'Escape') setLb(null)
      if (e.key === 'ArrowRight') setLb((i) => (i + 1) % n)
      if (e.key === 'ArrowLeft') setLb((i) => (i - 1 + n) % n)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lb, m])

  if (all.length === 0) return null

  const onKeyDown = (e) => {
    if (e.target.tagName === 'VIDEO') return // let the video's own keys work
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
  }
  const counts = { all: all.length, video: m.trailers.length, image: m.screenshots.length }

  return (
    <section className="panel gallery" onKeyDown={onKeyDown}>
      <div className="galleryhead">
        <h2>{title}</h2>
        <div className="segmented" role="tablist" aria-label="Media type">
          {TABS.map(([id, label]) => [id, id === 'image' ? imageLabel : label]).filter(([id]) => counts[id] > 0 && (id === 'all' ? counts.video > 0 && counts.image > 0 : true)).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''}
              onClick={() => { setTab(id); setIdx(0) }}>
              {label} <span className="count">{counts[id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="stage">
        {cur.kind === 'video' ? (
          (cur.t.key ? <YouTubeStage key={cur.key} t={cur.t} /> : <TrailerStage key={cur.key} t={cur.t} steamUrl={steamUrl} />)
        ) : (
          <button className="stage-image" onClick={() => setLb(cur.shot)} aria-label="View screenshot full screen">
            <img src={cur.s.full} alt={`Screenshot ${cur.shot + 1}`} />
            <span className="zoomhint">⤢ Full screen</span>
          </button>
        )}
        {count > 1 && (
          <>
            <button className="stagenav prev" onClick={() => go(-1)} aria-label="Previous">‹</button>
            <button className="stagenav next" onClick={() => go(1)} aria-label="Next">›</button>
          </>
        )}
        <span className="stagecount">{Math.min(idx, count - 1) + 1} / {count}</span>
      </div>

      {count > 1 && (
        <div className="thumbstrip" ref={strip} role="listbox" aria-label="All media">
          {items.map((x, i) => (
            <button key={x.key} role="option" aria-selected={i === idx} className={`thumb ${i === idx ? 'on' : ''} ${x.kind}`}
              onClick={() => setIdx(i)} aria-label={x.kind === 'video' ? `Trailer: ${x.t.name}` : `Screenshot ${x.shot + 1}`}>
              <img src={x.thumb} alt="" loading="lazy" />
              {x.kind === 'video' && <span className="thumbplay" aria-hidden="true">▶</span>}
            </button>
          ))}
        </div>
      )}

      <p className="muted small hint">← → to browse{credit}</p>

      {lb !== null && (
        <div className="lightbox" onClick={() => setLb(null)} role="dialog" aria-label="Screenshot viewer">
          <button className="lbnav prev" aria-label="Previous screenshot" onClick={(e) => { e.stopPropagation(); setLb((i) => (i - 1 + m.screenshots.length) % m.screenshots.length) }}>‹</button>
          <img src={m.screenshots[lb].full} alt="" onClick={(e) => e.stopPropagation()} />
          <button className="lbnav next" aria-label="Next screenshot" onClick={(e) => { e.stopPropagation(); setLb((i) => (i + 1) % m.screenshots.length) }}>›</button>
          <span className="muted lbcount">{lb + 1} / {m.screenshots.length} · ← → to browse · Esc to close</span>
        </div>
      )}
    </section>
  )
}
