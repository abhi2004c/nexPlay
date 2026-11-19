import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth.jsx'
import Avatar from '../components/Avatar.jsx'

function Row({ f, children }) {
  return (
    <div className="frow">
      <Link to={`/u/${f.username}`} className="fwho"><Avatar name={f.username} url={f.avatar_url} /> <strong>{f.username}</strong></Link>
      <div className="grow" />
      {children}
    </div>
  )
}

export default function Friends() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [name, setName] = useState('')
  const [note, setNote] = useState('')

  const load = useCallback(() => api('/friends/').then(setData).catch(() => {}), [])
  useEffect(() => { document.title = 'Friends — NexPlay'; if (user) load() }, [user, load])

  if (!user) return <p>Please <Link to="/login">log in</Link> to see your friends.</p>

  const call = (path, method = 'POST') => api(path, { method }).then(load).catch((e) => setNote(e.message))
  async function add(e) {
    e.preventDefault()
    setNote('')
    try {
      const r = await api('/friends/request/', { method: 'POST', body: { username: name.trim() } })
      setNote(r.detail)
      setName('')
      load()
    } catch (err) { setNote(err.message === 'Not found.' ? 'No user with that username.' : err.message) }
  }

  return (
    <>
      <div className="pagehead"><div><h1>Friends</h1>
        <p className="muted">Add people by username, or open a reviewer's name on any title to add them from their profile.</p></div></div>

      <form className="panel inline addfriend" onSubmit={add}>
        <input placeholder="Add a friend by username" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="btn">Send request</button>
      </form>
      {note && <p className="muted" role="status">{note}</p>}

      {data?.incoming.length > 0 && (
        <section className="panel">
          <h2>Requests for you <span className="muted small">{data.incoming.length}</span></h2>
          {data.incoming.map((f) => (
            <Row key={f.id} f={f}>
              <button className="btn" onClick={() => call(`/friends/${f.id}/accept/`)}>Accept</button>
              <button className="ghost" onClick={() => call(`/friends/${f.id}/`, 'DELETE')}>Decline</button>
            </Row>
          ))}
        </section>
      )}

      <section className="panel">
        <h2>Your friends {data && <span className="muted small">{data.friends.length}</span>}</h2>
        {data && data.friends.length === 0 && <p className="muted">No friends yet.</p>}
        {data?.friends.map((f) => (
          <Row key={f.id} f={f}>
            <button className="btn" onClick={() => nav(`/messages/${f.username}`)}>Message</button>
            <button className="ghost" onClick={() => call(`/friends/${f.id}/`, 'DELETE')}>Unfriend</button>
          </Row>
        ))}
      </section>

      {data?.outgoing.length > 0 && (
        <section className="panel">
          <h2>Waiting for a reply</h2>
          {data.outgoing.map((f) => (
            <Row key={f.id} f={f}><button className="ghost" onClick={() => call(`/friends/${f.id}/`, 'DELETE')}>Cancel</button></Row>
          ))}
        </section>
      )}
    </>
  )
}
