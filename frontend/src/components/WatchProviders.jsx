import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'

const STORE_KEY = 'nexplay_country'

// Time zone -> country: the most reliable free hint (a browser set to "en-US" can still be in India).
const TZ_COUNTRY = {
  'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN', 'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US',
  'America/Los_Angeles': 'US', 'America/Phoenix': 'US', 'America/Anchorage': 'US', 'Pacific/Honolulu': 'US',
  'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Edmonton': 'CA', 'America/Halifax': 'CA',
  'Europe/London': 'GB', 'Europe/Dublin': 'IE', 'Europe/Paris': 'FR', 'Europe/Berlin': 'DE', 'Europe/Madrid': 'ES',
  'Europe/Rome': 'IT', 'Europe/Amsterdam': 'NL', 'Europe/Brussels': 'BE', 'Europe/Zurich': 'CH', 'Europe/Vienna': 'AT',
  'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Helsinki': 'FI', 'Europe/Warsaw': 'PL',
  'Europe/Lisbon': 'PT', 'Europe/Athens': 'GR', 'Europe/Istanbul': 'TR', 'Europe/Moscow': 'RU', 'Europe/Prague': 'CZ',
  'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Singapore': 'SG', 'Asia/Hong_Kong': 'HK', 'Asia/Bangkok': 'TH',
  'Asia/Jakarta': 'ID', 'Asia/Manila': 'PH', 'Asia/Kuala_Lumpur': 'MY', 'Asia/Dubai': 'AE', 'Asia/Karachi': 'PK',
  'Asia/Dhaka': 'BD', 'Asia/Kathmandu': 'NP', 'Asia/Colombo': 'LK', 'Asia/Taipei': 'TW', 'Asia/Riyadh': 'SA',
  'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU', 'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU',
  'Pacific/Auckland': 'NZ', 'America/Sao_Paulo': 'BR', 'America/Mexico_City': 'MX', 'America/Argentina/Buenos_Aires': 'AR',
  'America/Bogota': 'CO', 'America/Santiago': 'CL', 'America/Lima': 'PE', 'Africa/Johannesburg': 'ZA',
  'Africa/Lagos': 'NG', 'Africa/Cairo': 'EG', 'Africa/Nairobi': 'KE',
}

function guessCountry() {
  try { // a link like ?country=GB wins, so a specific region can be shared or checked
    const fromUrl = new URLSearchParams(window.location.search).get('country')
    if (/^[A-Za-z]{2}$/.test(fromUrl || '')) return fromUrl.toUpperCase()
  } catch { /* ignore */ }
  try {
    const saved = localStorage.getItem(STORE_KEY)
    if (saved) return saved
  } catch { /* storage blocked: fall through */ }
  try {
    const fromTz = TZ_COUNTRY[Intl.DateTimeFormat().resolvedOptions().timeZone]
    if (fromTz) return fromTz
  } catch { /* ignore */ }
  for (const l of navigator.languages || [navigator.language]) {
    const m = /-([A-Za-z]{2})$/.exec(l || '')
    if (m) return m[1].toUpperCase()
  }
  return 'US'
}

let names
const countryName = (code) => {
  try {
    names ||= new Intl.DisplayNames(['en'], { type: 'region' })
    return names.of(code) || code
  } catch {
    return code
  }
}

function Providers({ label, items }) {
  if (!items?.length) return null
  return (
    <div className="provgroup">
      <h3>{label}</h3>
      <div className="provlist">
        {items.map((p) => (
          <span className="prov" key={p.name} title={p.name}>
            {p.logo ? <img src={p.logo} alt="" loading="lazy" /> : <b>{p.name[0]}</b>}
            <span>{p.name}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export default function WatchProviders({ slug }) {
  const [d, setD] = useState(null)
  const [country, setCountry] = useState(guessCountry)

  useEffect(() => {
    setD(null)
    api(`/titles/${slug}/watch/`).then(setD).catch(() => setD({ available: false }))
  }, [slug])

  const pick = (code) => {
    setCountry(code)
    try { localStorage.setItem(STORE_KEY, code) } catch { /* not saved, still works */ }
  }

  const countries = d?.countries ?? {}
  const options = useMemo(() => {
    const codes = new Set(Object.keys(countries))
    codes.add(country) // keep the visitor's own country in the list even if there is no data for it
    return [...codes].sort((a, b) => countryName(a).localeCompare(countryName(b)))
  }, [countries, country])

  // where it can be streamed (subscription or free) if not here, best-known markets first
  const elsewhere = useMemo(() => {
    const preferred = ['US', 'GB', 'CA', 'AU', 'IN', 'DE', 'FR', 'ES', 'IT', 'BR', 'MX', 'JP']
    return Object.entries(countries)
      .filter(([code, c]) => code !== country && (c.stream.length || c.free.length))
      .sort(([a], [b]) => {
        const ra = preferred.indexOf(a), rb = preferred.indexOf(b)
        return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb) || countryName(a).localeCompare(countryName(b))
      })
  }, [countries, country])

  if (d && !d.available) return null

  const here = countries[country]
  const canWatchHere = here && (here.stream.length || here.free.length)

  return (
    <section className="panel">
      <div className="watchhead">
        <h2>Where to watch</h2>
        {d && (
          <label className="countrypick">
            <span className="muted small">Your country</span>
            <select value={country} onChange={(e) => pick(e.target.value)} aria-label="Choose your country">
              {options.map((c) => <option key={c} value={c}>{countryName(c)}</option>)}
            </select>
          </label>
        )}
      </div>

      {!d && <p className="muted">Checking where it’s available…</p>}
      {d?.error && <p className="muted">Streaming information is unavailable right now.</p>}

      {d && !d.error && Object.keys(countries).length === 0 && (
        <p className="muted">No streaming information is available for this movie yet.</p>
      )}

      {d && !d.error && Object.keys(countries).length > 0 && (
        <>
          {here ? (
            <>
              {!canWatchHere && (
                <p className="notice">
                  Not available to stream in {countryName(country)} right now{here.rent.length || here.buy.length ? ' — you can rent or buy it:' : '.'}
                </p>
              )}
              <Providers label="Stream" items={here.stream} />
              <Providers label="Free with ads" items={here.free} />
              <Providers label="Rent" items={here.rent} />
              <Providers label="Buy" items={here.buy} />
              {here.link && (
                <p><a className="steamlink" href={here.link} target="_blank" rel="noreferrer">See all watch options for {countryName(country)}</a></p>
              )}
            </>
          ) : (
            <p className="notice">Not available to stream, rent or buy in {countryName(country)}, as far as we know.</p>
          )}

          {!canWatchHere && elsewhere.length > 0 && (
            <div className="elsewhere">
              <h3>Streaming in other countries</h3>
              <p className="muted small">Availability depends on your region and the services’ licensing. Tap a country to see its options.</p>
              <div className="provlist">
                {elsewhere.slice(0, 8).map(([code, c]) => (
                  <button key={code} className="ghost" onClick={() => pick(code)}>
                    {countryName(code)} · {[...c.stream, ...c.free].slice(0, 2).map((p) => p.name).join(', ')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <p className="muted small">
        Streaming availability data provided by <a href="https://www.justwatch.com" target="_blank" rel="noreferrer">JustWatch</a> via TMDB.
        Availability can change; check the service before you subscribe.
      </p>
    </section>
  )
}
