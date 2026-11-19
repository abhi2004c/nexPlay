import { BASE } from '../api'

// An uploaded picture comes as an API path ("/users/ann/avatar/?v=2"); a Google picture is a full URL.
export const avatarSrc = (url) => (url && url.startsWith('/') ? `${BASE}${url}` : url)

// Round avatar: the picture if there is one, else the first letter of the username.
export default function Avatar({ name, url, size = 36 }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden="true">
      {url ? <img src={avatarSrc(url)} alt="" referrerPolicy="no-referrer" /> : (name || '?')[0].toUpperCase()}
    </span>
  )
}
