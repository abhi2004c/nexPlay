// Round avatar: the picture if there is one (Google accounts), else the first letter of the username.
export default function Avatar({ name, url, size = 36 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {url ? <img src={url} alt="" referrerPolicy="no-referrer" /> : (name || '?')[0].toUpperCase()}
    </span>
  )
}
