import { useRef } from 'react'
import { Link } from 'react-router-dom'

// A titled, horizontally scrolling row with ‹ › buttons (mouse users) and snap scrolling (touch).
// `to` adds a "See all" link in the row header.
export default function Rail({ title, hint, to, toLabel = 'See all', children }) {
  const ref = useRef(null)
  const go = (dir) => ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.85, behavior: 'smooth' })
  return (
    <section className="rail">
      <div className="railhead">
        <div>
          <h2>{title}</h2>
          {hint && <p className="muted small">{hint}</p>}
        </div>
        <div className="railbtns">
          {to && <Link className="seeall" to={to}>{toLabel} →</Link>}
          <button aria-label={`Scroll ${title} left`} onClick={() => go(-1)}>‹</button>
          <button aria-label={`Scroll ${title} right`} onClick={() => go(1)}>›</button>
        </div>
      </div>
      <div className="scroll" ref={ref}>{children}</div>
    </section>
  )
}
