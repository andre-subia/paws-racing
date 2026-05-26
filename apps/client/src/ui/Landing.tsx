import { LAPS_DEFAULT, MAX_PLAYERS_PER_ROOM, TRACKS, VEHICLES } from '@paws/shared';
import { useGame } from '../store/game.ts';
import { TrackThumb } from './components/TrackThumb.tsx';
import './landing.css';

const VEHICLE_LIST = Object.values(VEHICLES);
const TRACK_LIST = Object.values(TRACKS);

// Rarity flavor tag per vehicle (purely cosmetic for the landing).
const RARITY: Record<string, { label: string; cls: string }> = {
  scout: { label: 'STARTER', cls: 'b' },
  bruiser: { label: 'HEAVY', cls: 'a' },
  drifter: { label: 'PRO', cls: 's' },
  inferno: { label: 'RARE', cls: 'a' },
};

// Normalize a stat into a 0-100 bar width given the spread across all vehicles.
function pct(value: number, lo: number, hi: number): number {
  return Math.round(Math.min(100, Math.max(8, ((value - lo) / (hi - lo)) * 100)));
}

const diffByTrack: Record<string, number> = {
  neo_kibble_city: 2,
  catnip_speedway: 3,
  alleycat_sprawl: 4,
  litter_box_loop: 5,
};

export function Landing() {
  const setScene = useGame((s) => s.setScene);
  const play = () => setScene('menu');
  const scrollTo = (id: string) => () =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="lp">
      <div className="crt-overlay" />

      {/* NAV */}
      <nav className="top">
        <div className="row">
          <div className="brand">
            <div className="mark" />
            <span>
              PAWS<span style={{ color: 'var(--yellow)' }}>/</span>RACING
            </span>
          </div>
          <ul>
            <li>
              <a href="#features" onClick={scrollTo('features')}>
                FEATURES
              </a>
            </li>
            <li>
              <a href="#riders" onClick={scrollTo('riders')}>
                RIDERS
              </a>
            </li>
            <li>
              <a href="#play" onClick={scrollTo('play')}>
                GAMEPLAY
              </a>
            </li>
            <li>
              <a href="#tracks" onClick={scrollTo('tracks')}>
                TRACKS
              </a>
            </li>
          </ul>
          <button type="button" className="pbtn cyan" onClick={play}>
            ▶ PLAY
          </button>
        </div>
      </nav>

      {/* HERO */}
      <header className="hero">
        <div className="sky" />
        <div className="sun" />
        <div className="hero-road"/>
        <div className="content">
          <div className="logo-arcade">
            PAWS <span className="a2">RACING</span>
          </div>
          <div className="tagline">
            16-BIT BIKER CATS <span className="sep">·</span> MODE-7 SPEED{' '}
            <span className="sep">·</span> ONLINE 8-PACK
          </div>
          <div className="cta-row">
            <button type="button" className="pbtn cyan" onClick={scrollTo('riders')}>
              ★ MEET THE CATS
            </button>
          </div>
          <div className="insert-coin">▌ INSERT COIN TO START ▐</div>
        </div>


        <img className="hero-cat" src="/assets/cats/cat1.png" alt="Biker cat" />

      </header>

      {/* MARQUEE */}
      <div className="strip">
        <div className="marquee">
          <em>NEW</em>
          <span>·</span> {VEHICLE_LIST.length} RIDERS <span>·</span> {TRACK_LIST.length} CIRCUITS{' '}
          <span>·</span> ONLINE {MAX_PLAYERS_PER_ROOM}-PLAYER <span>·</span> MODE-7 DRIFT{' '}
          <span>·</span> REAR-HIT COMBAT <span>·</span> CODE-JOIN LOBBIES <span>·</span>{' '}
          <em>FREE TO PLAY</em> <span>·</span> {VEHICLE_LIST.length} RIDERS <span>·</span>{' '}
          {TRACK_LIST.length} CIRCUITS <span>·</span> ONLINE {MAX_PLAYERS_PER_ROOM}-PLAYER{' '}
          <span>·</span> MODE-7 DRIFT <span>·</span> REAR-HIT COMBAT <span>·</span>{' '}
          CODE-JOIN LOBBIES <span>·</span> <em>FREE TO PLAY</em> <span>·</span>
        </div>
      </div>

      {/* FEATURES */}
      <section className="block" id="features">
        <div className="eyebrow">SELECT MODE</div>
        <h2 className="section-title">
          BUILT FOR <span className="accent">PURE ARCADE SPEED</span>
        </h2>
        <div className="features-grid">
          <Feat title="MODE-7 DRIFT" body="On-rails arcade handling — snap turns, no realism, all rubber. Hold drift for slide-corner moves." />
          <Feat title="REAR-HIT COMBAT" body="Ram a rival's tail to drain their health. Hit zero and they explode — then respawn at the last checkpoint." />
          <Feat title={`ONLINE ${MAX_PLAYERS_PER_ROOM}-PACK`} body="Quick Race into a public lobby, or Create Private and share a 5-letter code with friends." />
          <Feat title={`${VEHICLE_LIST.length} BIKER CATS`} body="Each rider tunes accel, top speed, turn rate and drift grip. Pick the cat that fits your line." />
          <Feat title={`${TRACK_LIST.length} CIRCUITS`} body="From the Neo-Kibble stadium to twisty alley sprawls. Host picks the track and lap count." />
          <Feat title="PIXEL + MOBILE" body="Crisp pixel-art rendering with on-screen touch controls — race from desktop or phone, same link." />
        </div>
      </section>

      {/* RIDERS */}
      <section className="block" id="riders">
        <div className="eyebrow">CHOOSE YOUR FIGHTER</div>
        <h2 className="section-title">
          THE <span className="accent">FERAL FOUR</span>
        </h2>
        <div className="chars-grid">
          {VEHICLE_LIST.map((v) => {
            const r = RARITY[v.id] ?? { label: 'RIDER', cls: 'b' };
            return (
              <div className="char" key={v.id}>
                <div className="portrait">
                  <img src={v.spritePath} alt={v.label} />
                </div>
                <div className="meta">
                  <div className="name">{v.label.toUpperCase()}</div>
                  <div className={`rarity ${r.cls}`}>{r.label}</div>
                  <Stat label="SPD" cls="" w={pct(v.topSpeed, 44, 60)} />
                  <Stat label="ACC" cls="yl" w={pct(v.accel, 12, 28)} />
                  <Stat label="TRN" cls="cy" w={pct(v.turnRate, 1.8, 3.2)} />
                  <Stat label="GRIP" cls="gr" w={pct(v.driftGrip, 0.4, 0.7)} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* GAMEPLAY / CRT */}
      <section className="block" id="play">
        <div className="eyebrow">DEMO REEL</div>
        <h2 className="section-title">
          PIXEL-FED <span className="accent">ADRENALINE</span>
        </h2>
        <div className="crt-grid">
          <div className="crt">
            <div className="label">▮ CH 03 · LIVE</div>
            <div className="screen">
              <div className="game">
                <div className="horizon-sun" />
                <div className="road" />
              </div>
              <div className="hud">
                <div className="top">
                  <div className="lap">LAP 02/{LAPS_DEFAULT}</div>
                  <div className="pos">POS 01/{MAX_PLAYERS_PER_ROOM}</div>
                  <div className="time">01:42:73</div>
                </div>
                <div className="bot">
                  <div className="speed">
                    287<span> KM/H</span>
                  </div>
                  <div className="time" style={{ color: 'var(--green)' }}>
                    ▮▮▮▮▮▮▯▯ NOS
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="crt-secondary">
            <div className="crt mini">
              <div className="label">CAM 02</div>
              <div className="screen">
                <div className="game">
                  <div
                    className="horizon-sun"
                    style={{
                      background:
                        'repeating-linear-gradient(180deg,#00e8ff 0 4px,transparent 4px 6px,#8a2cff 6px 18px,transparent 18px 22px,#ff2dd1 22px 60px)',
                    }}
                  />
                  <div className="road" style={{ filter: 'hue-rotate(140deg)' }} />
                </div>
                <div className="hud">
                  <div className="top">
                    <div className="lap">LAP 01/{LAPS_DEFAULT}</div>
                    <div className="pos">P 03</div>
                  </div>
                  <div className="bot">
                    <div className="speed">194</div>
                    <div className="time">▮▮▮▯▯</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="crt mini">
              <div className="label">CAM 04</div>
              <div className="screen">
                <div className="game">
                  <div
                    className="horizon-sun"
                    style={{
                      background:
                        'repeating-linear-gradient(180deg,#ffd400 0 4px,transparent 4px 6px,#ff7a1a 6px 18px,transparent 18px 22px,#ff2dd1 22px 60px)',
                      top: '48%',
                      width: '80px',
                      height: '80px',
                    }}
                  />
                  <div className="road" style={{ filter: 'hue-rotate(40deg)' }} />
                </div>
                <div className="hud">
                  <div className="top">
                    <div className="lap">FINAL</div>
                    <div className="pos">P 01</div>
                  </div>
                  <div className="bot">
                    <div className="speed">312</div>
                    <div className="time" style={{ color: 'var(--yellow)' }}>
                      ▮▮▮▮▮▮▮▮
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TRACKS */}
      <section className="block" id="tracks">
        <div className="eyebrow">WORLD MAP</div>
        <h2 className="section-title">
          {TRACK_LIST.length} <span className="accent">CIRCUITS</span>, ZERO MERCY
        </h2>
        <div className="tracks-grid">
          {TRACK_LIST.map((t, i) => (
            <div className="track" key={t.id}>
              <div className="thumb">
                <TrackThumb track={t} width={160} height={120} />
              </div>
              <div className="meta">
                <div className="num">CIRCUIT 0{i + 1}</div>
                <div className="name">{t.name.toUpperCase()}</div>
                <div className="diff">
                  {[0, 1, 2, 3, 4].map((d) => (
                    <i key={d} className={d < (diffByTrack[t.id] ?? 3) ? 'on' : ''} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA — with an animated Mode-7 grid floor behind it */}
      <section
        className="block"
        style={{ textAlign: 'center', position: 'relative', overflow: 'hidden' }}
      >
        <div className="mode7-bg" />
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div className="eyebrow">READY PLAYER ONE</div>
          <h2 className="section-title">
            START YOUR <span className="accent">ENGINES</span>
          </h2>
          <p style={{ maxWidth: 560, margin: '0 auto 32px', fontSize: 22, color: '#cdb6ff' }}>
            Free to play. {TRACK_LIST.length} circuits, {VEHICLE_LIST.length} riders, up to{' '}
            {MAX_PLAYERS_PER_ROOM} online. Grab a friend, share a room code, drop the clutch.
          </p>
          <div className="cta-row" style={{ marginTop: 0 }}>
            <button type="button" className="pbtn" onClick={play}>
              ▶ PLAY NOW
            </button>
          </div>
          <div className="insert-coin">▌ 1 CREDIT REMAINING ▐</div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="inner">
          <div>
            <div
              className="brand"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 14,
                fontFamily: "'Press Start 2P', monospace",
                fontSize: 14,
              }}
            >
              <div className="mark" style={{ width: 24, height: 24, background: 'conic-gradient(from 0deg at 50% 50%, var(--pink), var(--cyan), var(--yellow), var(--pink))', boxShadow: '0 0 0 4px #000, 0 0 0 8px #fff' }} />
              <span>
                PAWS<span style={{ color: 'var(--yellow)' }}>/</span>RACING
              </span>
            </div>
            <p style={{ fontSize: 18, color: '#a78fdf', maxWidth: 280 }}>
              An arcade racer for cats that ride too fast and corner like they pay rent.
            </p>
          </div>
          <div>
            <h4>GAME</h4>
            <ul>
              <li>
                <a href="#features" onClick={scrollTo('features')}>
                  Features
                </a>
              </li>
              <li>
                <a href="#riders" onClick={scrollTo('riders')}>
                  Riders
                </a>
              </li>
              <li>
                <a href="#tracks" onClick={scrollTo('tracks')}>
                  Tracks
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4>PLAY</h4>
            <ul>
              <li>
                <a href="#" onClick={(e) => { e.preventDefault(); play(); }}>
                  Quick Race
                </a>
              </li>
              <li>
                <a href="#" onClick={(e) => { e.preventDefault(); play(); }}>
                  Create Private
                </a>
              </li>
              <li>
                <a href="#" onClick={(e) => { e.preventDefault(); play(); }}>
                  Join by Code
                </a>
              </li>
            </ul>
          </div>
          <div className="copyright">
            <div>© 2026 PAWS RACING · An original arcade fever dream.</div>
            <div className="pix">
              RATED <span style={{ color: 'var(--yellow)' }}>E</span> FOR EVERY CAT
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function Feat({ title, body }: { title: string; body: string }) {
  return (
    <div className="feat">
      <svg className="icon" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
        <rect x="0" y="0" width="16" height="16" fill="#000" />
        <rect x="2" y="6" width="2" height="2" fill="#ff2dd1" />
        <rect x="4" y="6" width="2" height="2" fill="#ff2dd1" />
        <rect x="6" y="6" width="2" height="2" fill="#ffd400" />
        <rect x="8" y="6" width="2" height="2" fill="#ffd400" />
        <rect x="10" y="6" width="2" height="2" fill="#fff" />
        <rect x="2" y="9" width="2" height="2" fill="#ff2dd1" />
        <rect x="4" y="9" width="2" height="2" fill="#ffd400" />
        <rect x="6" y="9" width="2" height="2" fill="#00e8ff" />
      </svg>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function Stat({ label, cls, w }: { label: string; cls: string; w: number }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`bar ${cls}`}>
        <i style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}
