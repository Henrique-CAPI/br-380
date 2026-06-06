import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TEAMS, FORMATION } from "./data";
import { LOGOS } from "./logos";
import { STRINGS } from "./i18n";
import "./App.css";

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function emptyRoster() {
  const r = {};
  for (const s of FORMATION) r[s.slot] = null;
  return r;
}

function findOpenSlot(roster, position) {
  for (const slot of FORMATION) {
    if (slot.accepts.includes(position) && !roster[slot.slot]) {
      return slot.slot;
    }
  }
  return null;
}

function simulateSeason(rating) {
  let w = 0,
    d = 0,
    l = 0;
  const log = [];
  for (let i = 0; i < 38; i++) {
    const opp = 62 + Math.random() * 18;
    const diff = rating - opp;
    const pWraw = 1 / (1 + Math.exp(-(diff - 1) / 3.2));
    const pLraw = 1 / (1 + Math.exp((diff + 1) / 3.2));
    const pW = pWraw * 0.93 + 0.025;
    const pL = pLraw * 0.85 + 0.04;
    const pD = Math.max(0, 1 - pW - pL);
    const r = Math.random();
    let outcome;
    if (r < pW) {
      w++;
      outcome = "W";
    } else if (r < pW + pD) {
      d++;
      outcome = "D";
    } else {
      l++;
      outcome = "L";
    }
    log.push({ round: i + 1, opp: Math.round(opp), outcome });
  }
  return { w, d, l, log, points: w * 3 + d };
}

function teamEraLabel(team) {
  if (team.yearMin && team.yearMax && team.yearMin !== team.yearMax) {
    return `${team.yearMin}–${team.yearMax}`;
  }
  return String(team.year);
}

function localizeOutcome(o, lang) {
  if (lang !== "pt") return o;
  return { W: "V", D: "E", L: "D" }[o] || o;
}

function IntroPopup({ t, onStart }) {
  return (
    <motion.div
      className="intro-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="intro-card"
        initial={{ y: 20, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 10, opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="intro-eyebrow">Brasileirão <span>38-0</span></div>
        <h1 className="intro-title">{t.introTitle}</h1>
        <p className="intro-body">{t.introBody}</p>
        <button className="intro-button" onClick={onStart}>
          {t.introButton}
        </button>
      </motion.div>
    </motion.div>
  );
}

function LanguageToggle({ lang, setLang }) {
  return (
    <div className="lang-toggle" role="group" aria-label="Language">
      <button
        type="button"
        className={lang === "en" ? "active" : ""}
        onClick={() => setLang("en")}
      >
        EN
      </button>
      <button
        type="button"
        className={lang === "pt" ? "active" : ""}
        onClick={() => setLang("pt")}
      >
        PT
      </button>
    </div>
  );
}

function TeamAnnouncement({ team, t }) {
  const logo = LOGOS[team.name];
  return (
    <motion.div
      className="announcement"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ "--accent": team.accent }}
    >
      <div className="announcement-inner">
        <motion.div
          className="ann-badge"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.5 }}
        >
          {logo ? (
            <img src={logo} alt="" className="ann-logo" />
          ) : (
            <span className="ann-badge-text">{team.badge}</span>
          )}
        </motion.div>
        <motion.h1
          className="ann-name"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.5 }}
        >
          {team.name}
        </motion.h1>
        <motion.div
          className="ann-year"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          {teamEraLabel(team)}
        </motion.div>
        {team.achievements.length > 0 && (
          <motion.div
            className="ann-achievements"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.55, duration: 0.5 }}
          >
            {team.achievements.map((a) => (
              <span key={a} className={`ach-pill ach-${a.toLowerCase()}`}>
                {t.ach[a]}
              </span>
            ))}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

function PlayerCard({ player, can, onClick, accent, index, t }) {
  return (
    <motion.button
      className={`player-card ${can ? "can" : "cant"} pos-${player.pos.toLowerCase()}`}
      style={{ "--accent": accent }}
      onClick={can ? onClick : undefined}
      disabled={!can}
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
      transition={{
        duration: 0.35,
        delay: index * 0.04,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <div className="pc-top">
        <span className={`pc-pos pc-pos-${player.pos.toLowerCase()}`}>
          {player.pos}
        </span>
        <span className="pc-rating">{player.rating}</span>
      </div>
      <div className="pc-name">{player.name}</div>
      <div className="pc-meta">
        <span className="pc-nat">{player.nat || "BRA"}</span>
        {(player.apps > 0 || player.goals > 0) && (
          <span className="pc-stats">
            {player.apps > 0 && <span>{player.apps} apps</span>}
            {player.goals > 0 && <span>{player.goals} goals</span>}
          </span>
        )}
      </div>
      {!can && <div className="pc-overlay">{t.positionFilled}</div>}
    </motion.button>
  );
}

function PlayerGrid({ team, roster, onPick, t }) {
  const logo = LOGOS[team.name];
  return (
    <motion.div
      className="grid"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="grid-header">
        <span className="grid-team">
          {logo ? (
            <img src={logo} alt="" className="gt-logo" />
          ) : (
            <span className="gt-badge" style={{ background: team.accent }}>
              {team.badge}
            </span>
          )}
          {team.name} · {teamEraLabel(team)}
        </span>
        <span className="grid-prompt">{t.pickOne}</span>
      </div>
      <div className="cards">
        {team.players.map((p, i) => {
          const openSlot = findOpenSlot(roster, p.pos);
          const can = !!openSlot;
          return (
            <PlayerCard
              key={`${team.id}-${i}`}
              player={p}
              can={can}
              accent={team.accent}
              index={i}
              t={t}
              onClick={() => onPick(p)}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

function RosterStrip({ roster, justFilledSlot, picks, teamRating, t }) {
  return (
    <div className="roster-strip">
      <div className="rs-label">
        <span className="rs-left">
          {t.yourXI} <span className="rs-count">({picks}/11)</span>
        </span>
        <span className="rs-rating">
          {teamRating > 0 ? `${t.avg} ${teamRating.toFixed(1)}` : " "}
        </span>
      </div>
      <div className="rs-slots">
        {FORMATION.map((s) => {
          const p = roster[s.slot];
          const filled = !!p;
          const just = justFilledSlot === s.slot;
          return (
            <motion.div
              key={s.slot}
              className={`rs-slot ${filled ? "filled" : ""} ${just ? "just" : ""} rs-pos-${s.accepts[0].toLowerCase()}`}
              animate={just ? { scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 0.6 }}
            >
              <span className="rs-pos-tag">{s.accepts[0]}</span>
              {filled ? (
                <motion.span
                  key={p.name}
                  className="rs-name"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  {p.name}
                </motion.span>
              ) : (
                <span className="rs-empty">—</span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function ResultScreen({ result, roster, teamRating, onResim, onReset, t, lang }) {
  const verdict =
    result.w === 38
      ? { label: t.verdictWin, className: "win" }
      : result.w >= 32
        ? { label: t.verdictClose(result.l), className: "close" }
        : result.w >= 24
          ? { label: t.verdictMid, className: "mid" }
          : { label: t.verdictBad, className: "bad" };

  return (
    <motion.div
      className="result"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <h2 className="r-title">{t.seasonSimulated}</h2>
      <div className="r-record">
        {[
          { v: result.w, l: t.w },
          { v: result.d, l: t.d },
          { v: result.l, l: t.l },
          { v: result.points, l: t.pts },
        ].map((x, i) => (
          <motion.div
            key={x.l}
            className="r-stat"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
          >
            <strong>{x.v}</strong>
            <span>{x.l}</span>
          </motion.div>
        ))}
      </div>
      <motion.h3
        className={`r-verdict r-${verdict.className}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.4 }}
      >
        {verdict.label}
      </motion.h3>

      <div className="r-xi">
        <h3>{t.yourXIRating(teamRating.toFixed(1))}</h3>
        <div className="r-xi-grid">
          {FORMATION.map((s, i) => {
            const p = roster[s.slot];
            return (
              <motion.div
                key={s.slot}
                className={`r-card pos-${p.pos.toLowerCase()}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.04, duration: 0.3 }}
              >
                <div className="r-card-top">
                  <span className={`pc-pos pc-pos-${p.pos.toLowerCase()}`}>{p.pos}</span>
                  <span className="pc-rating">{p.rating}</span>
                </div>
                <div className="r-card-name">{p.name}</div>
                <div className="r-card-from">{p.fromTeamName} {p.fromYear}</div>
              </motion.div>
            );
          })}
        </div>
      </div>

      <details className="r-log">
        <summary>{t.matchLog}</summary>
        <ol>
          {result.log.map((m) => (
            <li key={m.round} className={`m-${m.outcome.toLowerCase()}`}>
              {t.matchRow(m.round, m.opp, localizeOutcome(m.outcome, lang))}
            </li>
          ))}
        </ol>
      </details>

      <div className="r-actions">
        <button className="primary" onClick={onResim}>{t.resimulate}</button>
        <button onClick={onReset}>{t.newDraft}</button>
      </div>
    </motion.div>
  );
}

export default function App() {
  const [lang, setLangState] = useState(() => {
    const stored = typeof localStorage !== "undefined" ? localStorage.getItem("lang") : null;
    return stored === "pt" || stored === "en" ? stored : "en";
  });
  const t = STRINGS[lang];

  function setLang(l) {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
    } catch (e) {
      // ignore
    }
  }

  const [queue, setQueue] = useState(() => shuffle(TEAMS));
  const [roster, setRoster] = useState(emptyRoster);
  const [picks, setPicks] = useState(0);
  const [phase, setPhase] = useState("intro");
  const [justFilledSlot, setJustFilledSlot] = useState(null);
  const [result, setResult] = useState(null);

  const done = picks >= 11;
  const currentTeam = done ? null : queue[picks];

  const teamRating = useMemo(() => {
    const filled = Object.values(roster).filter(Boolean);
    if (filled.length === 0) return 0;
    return filled.reduce((s, p) => s + p.rating, 0) / filled.length;
  }, [roster]);

  useEffect(() => {
    if (phase === "announcing" && currentTeam) {
      const tm = setTimeout(() => setPhase("selecting"), 2200);
      return () => clearTimeout(tm);
    }
  }, [phase, currentTeam, picks]);

  useEffect(() => {
    if (justFilledSlot) {
      const tm = setTimeout(() => setJustFilledSlot(null), 700);
      return () => clearTimeout(tm);
    }
  }, [justFilledSlot]);

  function pickPlayer(player) {
    if (phase !== "selecting" || done) return;
    const slot = findOpenSlot(roster, player.pos);
    if (!slot) return;
    const newRoster = {
      ...roster,
      [slot]: {
        ...player,
        fromTeam: currentTeam.id,
        fromTeamName: currentTeam.name,
        fromYear: currentTeam.year,
      },
    };
    setRoster(newRoster);
    setJustFilledSlot(slot);
    const newPicks = picks + 1;
    setPicks(newPicks);
    if (newPicks === 11) {
      const rating =
        Object.values(newRoster).reduce((s, p) => s + p.rating, 0) / 11;
      setTimeout(() => setResult(simulateSeason(rating)), 600);
    } else {
      setPhase("announcing");
    }
  }

  function reset() {
    setQueue(shuffle(TEAMS));
    setRoster(emptyRoster());
    setPicks(0);
    setPhase("announcing");
    setResult(null);
  }

  function resimulate() {
    setResult(simulateSeason(teamRating));
  }

  function startDraft() {
    setPhase("announcing");
  }

  const showIntro = phase === "intro";

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          Brasileirão <span className="brand-num">38-0</span>
        </div>
        <div className="top-right">
          {!done && !showIntro && (
            <div className="progress">
              <div className="progress-text">
                {t.roundOf(picks + 1, 11)}
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${(picks / 11) * 100}%` }}
                />
              </div>
            </div>
          )}
          <LanguageToggle lang={lang} setLang={setLang} />
        </div>
      </header>

      <main
        className="stage"
        style={{
          "--bg-logo":
            !showIntro && currentTeam && LOGOS[currentTeam.name]
              ? `url("${LOGOS[currentTeam.name]}")`
              : "none",
          "--team-accent": currentTeam ? currentTeam.accent : "#2d6cdf",
        }}
      >
        <AnimatePresence mode="wait">
          {showIntro && (
            <IntroPopup key="intro" t={t} onStart={startDraft} />
          )}
          {!done && phase === "announcing" && currentTeam && (
            <TeamAnnouncement key={`ann-${picks}`} team={currentTeam} t={t} />
          )}
          {!done && phase === "selecting" && currentTeam && (
            <PlayerGrid
              key={`grid-${picks}`}
              team={currentTeam}
              roster={roster}
              onPick={pickPlayer}
              t={t}
            />
          )}
          {done && result && (
            <ResultScreen
              key="result"
              result={result}
              roster={roster}
              teamRating={teamRating}
              onResim={resimulate}
              onReset={reset}
              t={t}
              lang={lang}
            />
          )}
        </AnimatePresence>
      </main>

      {!done && !showIntro && (
        <RosterStrip
          roster={roster}
          justFilledSlot={justFilledSlot}
          picks={picks}
          teamRating={teamRating}
          t={t}
        />
      )}
    </div>
  );
}
