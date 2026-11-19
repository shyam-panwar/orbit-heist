"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCheck,
  ChevronRight,
  Copy,
  Crown,
  Diamond,
  HelpCircle,
  Link2,
  LoaderCircle,
  LogOut,
  Radio,
  RotateCcw,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from "lucide-react";

import type { Room, Sector } from "./game-types";
import {
  createPractice,
  practiceView,
  practiceAction,
  tickPractice,
} from "../lib/practice.mjs";
import { MatchReplay, TacticalIntel, TrainingBrief } from "./mission-insights";
type Session = { code: string; token: string; practice?: boolean };
type ApiData = { room?: Room; playerToken?: string; error?: string };
const sessionKey = "orbit-heist-session-v1";
const demoSectors: Sector[] = [
  {
    id: 0,
    name: "Azure Belt",
    pool: 24,
    risk: 0.1,
    flavor: "Quiet skies. Smaller prizes.",
  },
  {
    id: 1,
    name: "Ember Ring",
    pool: 30,
    risk: 0.25,
    flavor: "A little heat. A bigger haul.",
  },
  {
    id: 2,
    name: "Violet Rift",
    pool: 36,
    risk: 0.4,
    flavor: "Fortune favors the reckless.",
  },
];
const names = ["azure", "ember", "violet"];
const nf = new Intl.NumberFormat("en-US");
function riskPercent(risk: number) {
  return Math.round(risk > 1 ? risk : risk * 100);
}

function Logo() {
  return (
    <span className="brand">
      <span className="brand-icon" aria-hidden="true">
        <svg viewBox="0 0 44 44">
          <ellipse
            cx="22"
            cy="22"
            rx="20"
            ry="8"
            transform="rotate(-38 22 22)"
          />
          <circle cx="22" cy="22" r="11" />
          <circle cx="35" cy="12" r="3" />
        </svg>
      </span>
      <span>
        ORBIT<span className="brand-light">HEIST</span>
        <sup>™</sup>
      </span>
    </span>
  );
}

function OrbitArt({
  sectors = demoSectors,
  selected = null,
  storms = [],
  preview = false,
}: {
  sectors?: Sector[];
  selected?: number | null;
  storms?: number[];
  preview?: boolean;
}) {
  return (
    <div
      className={`orbital-scene ${preview ? "preview-scene" : "game-scene"}`}
      aria-label={
        preview
          ? "Illustrated game board preview: Azure Belt, Ember Ring and Violet Rift"
          : "Orbital sector map"
      }
      role="img"
    >
      <div className="scene-glow" />
      <div className="space-grid" />
      <svg className="orbit-lines" viewBox="0 0 600 530" aria-hidden="true">
        <defs>
          <linearGradient
            id={preview ? "orbitStrokePreview" : "orbitStrokeGame"}
          >
            <stop stopColor="#68ccff" stopOpacity=".03" />
            <stop offset=".5" stopColor="#8c96c7" stopOpacity=".4" />
            <stop offset="1" stopColor="#7f6ae8" stopOpacity=".05" />
          </linearGradient>
        </defs>
        <g
          fill="none"
          stroke={`url(#${preview ? "orbitStrokePreview" : "orbitStrokeGame"})`}
        >
          <ellipse
            cx="310"
            cy="275"
            rx="247"
            ry="151"
            transform="rotate(-24 310 275)"
          />
          <ellipse
            cx="310"
            cy="275"
            rx="207"
            ry="108"
            transform="rotate(-24 310 275)"
            strokeDasharray="3 8"
          />
          <ellipse
            cx="310"
            cy="275"
            rx="154"
            ry="225"
            transform="rotate(40 310 275)"
          />
          <path d="M40 310Q230 55 520 230" strokeDasharray="2 7" />
        </g>
        <g fill="#b3d8f2">
          <circle cx="79" cy="355" r="2" />
          <circle cx="472" cy="129" r="2" />
          <circle cx="467" cy="393" r="3" />
          <circle cx="205" cy="139" r="2" />
        </g>
      </svg>
      <div className="map-cross cross-one" />
      <div className="map-cross cross-two" />
      {sectors.slice(0, 3).map((sector, i) => (
        <div
          key={sector.id}
          className={`space-object object-${i} ${selected === sector.id ? "object-selected" : ""} ${storms.includes(sector.id) ? "object-storm" : ""}`}
        >
          <div className={`planet planet-${names[i]}`}>
            <div className="planet-texture" />
            <div className="planet-shadow" />
            {i === 1 && (
              <>
                <div className="planet-ring ring-back" />
                <div className="planet-ring ring-front" />
              </>
            )}
          </div>
          <div className={`planet-label label-${i}`}>
            <span className="tiny-number">0{i + 1}</span>
            <span>
              <strong>{sector.name}</strong>
              <small>
                <Diamond size={10} /> {nf.format(sector.pool)} gem pool
              </small>
            </span>
            {storms.includes(sector.id) && (
              <span className="storm-label">STORM</span>
            )}
          </div>
        </div>
      ))}
      <div className="tiny-ship" aria-hidden="true">
        <svg viewBox="0 0 34 44">
          <path d="M17 2 29 35 17 28 5 35Z" fill="#d7ecff" />
          <path d="m17 12 5 15-5-3-5 3Z" fill="#6a8eff" />
          <path d="m12 33 5 10 5-10" fill="#67bcff" />
        </svg>
      </div>
      <div className="map-coordinate">SECTOR 07.24 / OUTER REACH</div>
      <div className="map-scale">
        <span />
        <span />
        <span /> 1,000 KM
      </div>
    </div>
  );
}

function Rules({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => previous?.focus();
  }, []);
  function trap(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") onClose();
    if (event.key === "Tab") {
      const elements = event.currentTarget.querySelectorAll<HTMLElement>(
        'button,[href],input,[tabindex="0"]',
      );
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="rules-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rules-title"
        onKeyDown={trap}
      >
        <button
          ref={closeRef}
          className="icon-button modal-close"
          onClick={onClose}
          aria-label="Close how to play"
        >
          <X size={20} />
        </button>
        <span className="eyebrow">YOUR 30-SECOND BRIEFING</span>
        <h2 id="rules-title">One crew. Different plans.</h2>
        <p className="modal-intro">
          Outguess your friends, dodge cosmic storms, and finish with the
          biggest haul.
        </p>
        <ol className="rules-list">
          <li>
            <span>01</span>
            <div>
              <strong>Assemble your crew</strong>
              <p>
                Invite 2–6 players with your room link. Everyone gets ready; the
                captain starts the game.
              </p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Pick an orbit. Keep it secret.</strong>
              <p>
                Each round, choose one of three sectors in 45 seconds. Its gem
                pool is divided equally between everyone who picked it, rounded
                down.
              </p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Watch the forecast</strong>
              <p>
                First-round storm risks are 10% for Azure, 25% for Ember, and
                40% for Violet. Pools and risks change each round; check the
                sector cards. A storm wipes out that round’s haul in its sector.
                Spend one of your two shields to protect your share.
              </p>
            </div>
          </li>
          <li>
            <span>04</span>
            <div>
              <strong>Six rounds. One biggest haul.</strong>
              <p>
                Choices reveal when everyone locks in or time runs out. Miss a
                round and earn zero. Highest total wins; equal scores share the
                win.
              </p>
            </div>
          </li>
        </ol>
        <div className="rules-note">
          <Diamond size={18} />
          <span>
            All gems are fictional game points. No money, purchases, or prizes.
          </span>
        </div>
        <button className="primary-button full-width" onClick={onClose}>
          Got it. Let’s fly. <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const phaseHeading = useRef<HTMLHeadingElement>(null);
  const [announcement, setAnnouncement] = useState("");
  const [rules, setRules] = useState(false);
  const [sound, setSound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [shield, setShield] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const simulation = useRef<ReturnType<typeof createPractice> | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const currentRoom = useRef<Room | null>(null);
  const busyRef = useRef(false);
  const audioRef = useRef<AudioContext | null>(null);
  const requestControllers = useRef(new Set<AbortController>());
  const nameInput = useRef<HTMLInputElement>(null);
  const copyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTime = useRef(0);

  useEffect(() => {
    const requestedCode = new URLSearchParams(location.search)
      .get("room")
      ?.toUpperCase()
      .slice(0, 6);
    try {
      const saved = sessionStorage.getItem(sessionKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed.code === "string" &&
          typeof parsed.token === "string" &&
          (!requestedCode || parsed.code === requestedCode)
        ) {
          sessionRef.current = parsed;
          setSession(parsed);
        }
      }
      setSound(localStorage.getItem("orbit-heist-sound") === "on");
    } catch {
      /* In-memory sessions still work. */
    }
    if (requestedCode) {
      setJoinCode(requestedCode);
      setMode("join");
    }
    setLoaded(true);
    return () => {
      requestControllers.current.forEach((controller) => controller.abort());
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      void audioRef.current?.close();
    };
  }, []);
  function playTone(kind: "lock" | "reveal" = "lock") {
    if (!sound) return;
    try {
      const ctx = audioRef.current ?? new AudioContext();
      audioRef.current = ctx;
      void ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(
        kind === "lock" ? 540 : 320,
        ctx.currentTime,
      );
      osc.frequency.exponentialRampToValueAtTime(
        kind === "lock" ? 900 : 640,
        ctx.currentTime + 0.15,
      );
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.26);
    } catch {
      /* Sound is optional. */
    }
  }
  const acceptRoom = useCallback((next: Room, forSession: Session) => {
    if (
      sessionRef.current?.token !== forSession.token ||
      sessionRef.current?.code !== forSession.code
    )
      return;
    if (
      currentRoom.current &&
      currentRoom.current.code === next.code &&
      currentRoom.current.revision > next.revision
    )
      return;
    if (currentRoom.current?.phase !== "reveal" && next.phase === "reveal")
      revealTime.current = Date.now();
    currentRoom.current = next;
    setRoom(next);
    setOffset(next.serverNow - Date.now());
    setConnectionError("");
  }, []);
  useEffect(() => {
    if (!session || session.practice) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    const poll = async () => {
      controller = new AbortController();
      requestControllers.current.add(controller);
      try {
        const response = await fetch(
          `/api/rooms/${encodeURIComponent(session.code)}`,
          {
            headers: { "X-Player-Token": session.token },
            signal: controller.signal,
            cache: "no-store",
          },
        );
        const data = (await response.json()) as ApiData;
        if (!response.ok) {
          if (response.status === 401 || response.status === 404) alive = false;
          throw new Error(data.error || "Could not reconnect to this room.");
        }
        if (alive && data.room) acceptRoom(data.room, session);
      } catch (e) {
        if (
          !(e instanceof Error && e.name === "AbortError") &&
          sessionRef.current?.token === session.token
        )
          setConnectionError(
            e instanceof Error
              ? e.message
              : "Connection interrupted. Reconnecting…",
          );
      } finally {
        if (controller) requestControllers.current.delete(controller);
        if (alive) timer = setTimeout(poll, 1000);
      }
    };
    void poll();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [session, acceptRoom]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    setSelected(null);
    setShield(false);
    setError("");
  }, [room?.round, room?.phase]);
  useEffect(() => {
    if (!room) return;
    setAnnouncement(
      room.phase === "lobby"
        ? "Crew lobby. Invite at least one other player."
        : room.phase === "choosing"
          ? `Round ${room.round} of ${room.totalRounds}. You have 45 seconds to choose a sector and lock your move.`
          : room.phase === "reveal"
            ? `Round ${room.round} revealed. Review the sector report and your haul.`
            : "Mission complete. Final standings are ready.",
    );
    phaseHeading.current?.focus({ preventScroll: true });
  }, [room?.phase, room?.round]);
  const persistSession = (next: Session) => {
    sessionRef.current = next;
    setSession(next);
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify(next));
    } catch {
      /* No storage. */
    }
  };
  const clearSession = () => {
    simulation.current = null;
    setAnnouncement("");
    requestControllers.current.forEach((c) => c.abort());
    sessionRef.current = null;
    currentRoom.current = null;
    setSession(null);
    setRoom(null);
    setError("");
    setConnectionError("");
    setSelected(null);
    try {
      sessionStorage.removeItem(sessionKey);
    } catch {
      /* No storage. */
    }
    history.replaceState({}, "", location.pathname);
  };
  async function abandonSession() {
    const s = sessionRef.current;
    if (!s || s.practice) {
      clearSession();
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    try {
      await fetch(`/api/rooms/${encodeURIComponent(s.code)}/action`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Player-Token": s.token,
        },
        body: JSON.stringify({ type: "leave" }),
        signal: controller.signal,
      });
    } catch {
      /* Bounded best-effort departure; expired rooms need no cleanup. */
    } finally {
      clearTimeout(timeout);
      clearSession();
    }
  }
  function startPractice() {
    try {
      const sim = createPractice(name.trim() || "Pilot");
      simulation.current = sim;
      const next: Session = {
        code: "TRAINING",
        token: "local-training",
        practice: true,
      };
      sessionRef.current = next;
      setSession(next);
      setError("");
      acceptRoom(practiceView(sim) as Room, next);
      history.replaceState({}, "", location.pathname);
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start training.");
    }
  }
  useEffect(() => {
    if (!session?.practice || !simulation.current) return;
    const sim = simulation.current;
    const timer = setInterval(() => {
      const next = tickPractice(sim);
      if (next) acceptRoom(next as Room, session);
    }, 200);
    return () => clearInterval(timer);
  }, [session, acceptRoom]);
  async function enterRoom(event: React.FormEvent) {
    event.preventDefault();
    if (busyRef.current) return;
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Choose a callsign before boarding.");
      nameInput.current?.focus();
      return;
    }
    if (mode === "join" && !joinCode.trim()) {
      setError("Enter the room code from your crew.");
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    requestControllers.current.add(controller);
    try {
      const response = await fetch(
        mode === "create"
          ? "/api/rooms"
          : `/api/rooms/${encodeURIComponent(joinCode.trim().toUpperCase())}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cleanName }),
          signal: controller.signal,
        },
      );
      const data = (await response.json()) as ApiData;
      if (!response.ok)
        throw new Error(data.error || "Could not enter the room. Try again.");
      if (!data.room || !data.playerToken)
        throw new Error(
          "Mission control returned an incomplete response. Please retry.",
        );
      const next = { code: data.room.code, token: data.playerToken };
      persistSession(next);
      acceptRoom(data.room, next);
      history.replaceState({}, "", `?room=${encodeURIComponent(next.code)}`);
      playTone();
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(
          e instanceof Error
            ? e.message
            : "Could not reach mission control. Please try again.",
        );
    } finally {
      requestControllers.current.delete(controller);
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function act(
    type: "ready" | "start" | "choose" | "continue" | "rematch" | "leave",
    extra: Record<string, unknown> = {},
  ) {
    const s = sessionRef.current;
    if (!s || busyRef.current) return;
    if (s.practice && simulation.current) {
      if (type === "leave") {
        clearSession();
        window.scrollTo({ top: 0, behavior: "instant" });
        return;
      }
      try {
        setError("");
        acceptRoom(practiceAction(simulation.current, type, extra) as Room, s);
        if (type === "choose") playTone();
      } catch (e) {
        const next = practiceView(simulation.current) as Room;
        acceptRoom(next, s);
        setError(e instanceof Error ? e.message : "Try that move again.");
      }
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    requestControllers.current.add(controller);
    try {
      const response = await fetch(
        `/api/rooms/${encodeURIComponent(s.code)}/action`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Player-Token": s.token,
          },
          body: JSON.stringify({ type, ...extra }),
          signal: controller.signal,
        },
      );
      const data = (await response.json()) as ApiData;
      if (!response.ok)
        throw new Error(
          data.error || "That action did not go through. Please try again.",
        );
      if (type === "leave") {
        clearSession();
        return;
      }
      if (data.room) acceptRoom(data.room, s);
      if (type === "choose") playTone();
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(
          e instanceof Error
            ? e.message
            : "Connection interrupted. Your action was not confirmed.",
        );
    } finally {
      requestControllers.current.delete(controller);
      busyRef.current = false;
      setBusy(false);
    }
  }
  async function copyInvite() {
    if (!room) return;
    const invite = `${location.origin}${location.pathname}?room=${encodeURIComponent(room.code)}`;
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      if (copyTimeout.current) clearTimeout(copyTimeout.current);
      copyTimeout.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      setError(`Copy this invite link: ${invite}`);
    }
  }
  function toggleSound() {
    const next = !sound;
    setSound(next);
    try {
      localStorage.setItem("orbit-heist-sound", next ? "on" : "off");
    } catch {
      /* Optional preference. */
    }
  }
  const players = room?.players.filter((p) => p.active) ?? [];
  const me = room?.players.find((p) => p.id === room.youId);
  const host = room?.hostId === room?.youId;
  const allReady = players.length >= 2 && players.every((p) => p.ready);
  const seconds = room?.deadline
    ? Math.max(
        0,
        Math.min(45, Math.ceil((room.deadline - now - offset) / 1000)),
      )
    : 45;
  const canContinue = now - revealTime.current >= 2000;
  const ranked = [...(room?.players ?? [])].sort((a, b) => b.score - a.score);
  const winnerScore = ranked[0]?.score;
  const myGain = room?.result?.gains.find((g) => g.playerId === me?.id);

  return (
    <main className="app-shell">
      <div className="ambient-stars" aria-hidden="true" />
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
      <header className="site-header">
        <a
          href="/"
          className="brand-link"
          aria-label={
            session ? "Return to launchpad and leave room" : "Orbit Heist home"
          }
          onClick={(e) => {
            if (session) {
              e.preventDefault();
              void act("leave");
            }
          }}
        >
          <Logo />
        </a>
        <nav aria-label="Main navigation">
          <span className="header-caption">SMALL CREW. BIG COSMIC ENERGY.</span>
          {!session && (
            <button
              className="quiet-button quick-play"
              disabled={!loaded || busy}
              onClick={startPractice}
            >
              <Zap size={14} /> Try solo
            </button>
          )}
          <button
            className="quiet-button help-button"
            onClick={() => setRules(true)}
          >
            <HelpCircle size={16} /> How to play
          </button>
          <button
            className={`icon-button sound-button ${sound ? "active" : ""}`}
            onClick={toggleSound}
            aria-label={sound ? "Turn sound off" : "Turn sound on"}
            title={sound ? "Sound on" : "Sound off"}
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
        </nav>
      </header>
      {!session ? (
        <>
          <section className="landing-hero" aria-labelledby="hero-title">
            <div className="hero-copy">
              <div className="eyebrow hero-eyebrow">
                <span className="status-dot" /> A MULTIPLAYER GAME OF BEAUTIFUL
                BETRAYAL
              </div>
              <h1 id="hero-title">
                Pick your orbit.
                <br />
                <span>Take the heist.</span>
              </h1>
              <p className="hero-description">
                Three sectors. One secret choice.
                <br />
                Outsmart your friends and steal the stars.
              </p>
              <div className="game-facts">
                <span>
                  <i className="crew-dots">
                    <b />
                    <b />
                    <b />
                  </i>{" "}
                  2–6 players
                </span>
                <span>
                  <RotateCcw size={15} /> 6 rounds
                </span>
                <span>
                  <Zap size={15} /> No account needed
                </span>
              </div>
              <form className="boarding-form" onSubmit={enterRoom}>
                <div
                  className="boarding-tabs"
                  role="tablist"
                  aria-label="Choose how to play"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "create"}
                    aria-controls="boarding-panel"
                    id="create-tab"
                    className={mode === "create" ? "selected" : ""}
                    onClick={() => {
                      setMode("create");
                      setError("");
                    }}
                  >
                    Create a crew
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={mode === "join"}
                    aria-controls="boarding-panel"
                    id="join-tab"
                    className={mode === "join" ? "selected" : ""}
                    onClick={() => {
                      setMode("join");
                      setError("");
                    }}
                  >
                    Join with a code
                  </button>
                </div>
                <div
                  id="boarding-panel"
                  role="tabpanel"
                  aria-labelledby={
                    mode === "create" ? "create-tab" : "join-tab"
                  }
                >
                  <div
                    className={`entry-fields ${mode === "join" ? "joining" : ""}`}
                  >
                    <label htmlFor="callsign">
                      YOUR CALLSIGN
                      <input
                        ref={nameInput}
                        id="callsign"
                        name="callsign"
                        placeholder="e.g. Cosmic Bandit"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        maxLength={18}
                        autoComplete="off"
                        required
                      />
                    </label>
                    {mode === "join" && (
                      <label htmlFor="room-code">
                        ROOM CODE
                        <input
                          id="room-code"
                          name="room-code"
                          className="code-input"
                          placeholder="ABC123"
                          value={joinCode}
                          onChange={(e) =>
                            setJoinCode(
                              e.target.value
                                .toUpperCase()
                                .replace(/[^A-Z0-9]/g, "")
                                .slice(0, 6),
                            )
                          }
                          maxLength={6}
                          autoComplete="off"
                          required
                        />
                      </label>
                    )}
                  </div>
                  <button
                    className="primary-button boarding-button"
                    type="submit"
                    disabled={busy || !loaded}
                  >
                    {busy ? (
                      <>
                        <LoaderCircle className="spin" size={18} /> Contacting
                        mission control…
                      </>
                    ) : (
                      <>
                        {mode === "create"
                          ? "Launch a new heist"
                          : "Join the crew"}
                        <ArrowRight size={20} />
                      </>
                    )}
                  </button>
                  <p className="form-note">
                    <Shield size={12} /> Private room. Invite your people. Make
                    your move.
                  </p>
                </div>
                {error && (
                  <div className="error-message" role="alert">
                    {error}
                  </div>
                )}
              </form>
              <div className="training-entry">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!loaded || busy}
                  onClick={startPractice}
                >
                  <Zap size={16} /> Play solo · Flight school{" "}
                  <ArrowRight size={16} />
                </button>
                <p>
                  No crew yet? Learn by playing against three simulated rivals.
                </p>
              </div>
            </div>
            <div className="hero-board">
              <div className="board-topline">
                <span>
                  <span className="status-dot" /> THE PLAYING FIELD
                </span>
                <span className="preview-tag">BOARD PREVIEW</span>
              </div>
              <OrbitArt preview />
              <div className="preview-caption">
                <span className="preview-caption-icon">
                  <Radio size={17} />
                </span>
                <div>
                  <strong>Your next move is everyone’s guess.</strong>
                  <span>Pick alone. Split the haul. Or take it all.</span>
                </div>
                <span className="preview-caption-arrow">↗</span>
              </div>
              <span className="scene-side-label">
                DEEP SPACE / HIGH STAKES / FICTIONAL GEMS
              </span>
            </div>
          </section>
          <section className="how-strip" aria-label="How Orbit Heist works">
            <div className="strip-intro">
              <span className="eyebrow">SIMPLE TO PLAY.</span>
              <h2>
                Hard to read
                <br />
                your friends.
              </h2>
            </div>
            <div className="how-item">
              <span className="how-number">01 /</span>
              <h3>Find your people.</h3>
              <p>
                Share a room code. Gather your crew.
                <br />
                No downloads, no sign-ups.
              </p>
            </div>
            <div className="how-item">
              <span className="how-number">02 /</span>
              <h3>Make a secret move.</h3>
              <p>
                Chase the big pool or play it safe.
                <br />
                Too much company splits your haul.
              </p>
            </div>
            <div className="how-item">
              <span className="how-number">03 /</span>
              <h3>Keep the biggest haul.</h3>
              <p>
                Weather the storms. Save your shields.
                <br />
                Six rounds decide who rules the orbit.
              </p>
            </div>
          </section>
        </>
      ) : !room ? (
        <section className="reconnect-screen">
          <div className="reconnect-orbit">
            <LoaderCircle className="spin" size={42} />
          </div>
          <span className="eyebrow">BACK TO THE COSMOS</span>
          <h1>Reconnecting to {session.code}</h1>
          <p>
            {connectionError ||
              "Recovering your seat and the latest mission state…"}
          </p>
          <button className="secondary-button" onClick={clearSession}>
            Return to the launchpad <ArrowRight size={16} />
          </button>
        </section>
      ) : (
        <section className="mission-shell">
          <div className="mission-topline">
            <div className="mission-breadcrumb">
              <span className="status-dot" />
              <span>
                {session.practice ? "LOCAL FLIGHT SCHOOL" : "MISSION CONTROL"}
              </span>
              <ChevronRight size={14} />
              <span>{room.code}</span>
            </div>
            <div className="room-tools">
              {!session.practice && (
                <button
                  className="quiet-button"
                  onClick={copyInvite}
                  aria-label="Copy room invite link"
                >
                  {copied ? <CheckCheck size={15} /> : <Link2 size={15} />}
                  {copied ? "Invite copied" : "Copy invite"}
                </button>
              )}
              <button
                className="quiet-button leave-button"
                onClick={() => void act("leave")}
                disabled={busy}
                aria-label="Leave room"
              >
                <LogOut size={15} /> Leave room
              </button>
            </div>
          </div>
          {(error || connectionError) && (
            <div
              className={`error-message mission-error ${connectionError ? "connection-warning" : ""}`}
              role="alert"
            >
              {error || (
                <>
                  <LoaderCircle className="spin" size={15} /> {connectionError}
                </>
              )}
              {connectionError && (
                <button
                  className="secondary-button recovery-button"
                  onClick={() => void abandonSession()}
                >
                  Return to launchpad <ArrowRight size={14} />
                </button>
              )}
            </div>
          )}
          {session.practice && (
            <div className="simulation-label">
              <strong>SIMULATED OPPONENTS</strong>
              <span>
                Local practice · same scoring as multiplayer · resets on refresh
              </span>
            </div>
          )}
          {room.phase === "lobby" ? (
            <div className="lobby-grid">
              <div className="lobby-main">
                <span className="eyebrow">YOUR CREW. YOUR COSMIC CRIME.</span>
                <h1 ref={phaseHeading} tabIndex={-1}>
                  The stars can wait.
                  <br />
                  <span>Get the crew together.</span>
                </h1>
                <p className="lobby-lead">
                  Invite at least one friend. Every player needs their own
                  browser tab or device. No accounts. Just a callsign and a
                  little nerve.
                </p>
                <div className="room-code-card">
                  <div>
                    <span className="field-label">YOUR ROOM CODE</span>
                    <strong>{room.code}</strong>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={copyInvite}
                    aria-label="Copy invite link"
                  >
                    {copied ? <Check size={17} /> : <Copy size={17} />}
                    {copied ? "Copied!" : "Copy invite"}
                  </button>
                </div>
                <div className="lobby-map">
                  <OrbitArt
                    sectors={room.sectors.length ? room.sectors : demoSectors}
                    preview
                  />
                </div>
              </div>
              <aside className="crew-panel">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">FLIGHT MANIFEST</span>
                    <h2>
                      Your crew <span>{players.length}/6</span>
                    </h2>
                  </div>
                  <span className="live-pill">
                    <span className="status-dot" /> LIVE
                  </span>
                </div>
                <div className="crew-list">
                  {players.map((player) => (
                    <div className="crew-row" key={player.id}>
                      <span
                        className="avatar"
                        style={
                          { "--avatar": player.color } as React.CSSProperties
                        }
                      >
                        {player.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="crew-name">
                        <strong>
                          {player.name}{" "}
                          {player.id === me?.id && <small>YOU</small>}
                        </strong>
                        <span>
                          {player.id === room.hostId
                            ? "Crew captain"
                            : "Crew member"}
                        </span>
                      </div>
                      {player.ready ? (
                        <span className="ready-state">
                          <Check size={12} /> Ready
                        </span>
                      ) : (
                        <span className="waiting-state">Preparing</span>
                      )}
                    </div>
                  ))}
                  {players.length < 6 && (
                    <div className="empty-seat">
                      <span>+</span>
                      <p>
                        {players.length < 2
                          ? "A heist needs a partner."
                          : "Room for another orbit outlaw."}
                        <small>Share the invite to fill this seat.</small>
                      </p>
                    </div>
                  )}
                </div>
                <div className="lobby-brief">
                  <Shield size={19} />
                  <div>
                    <strong>A level playing field.</strong>
                    <p>
                      Everyone starts at zero, with 2 shields. Secret choices.
                      Six rounds. Biggest haul wins.
                    </p>
                  </div>
                </div>
                <button
                  className={
                    me?.ready
                      ? "secondary-button full-width ready-button"
                      : "primary-button full-width"
                  }
                  disabled={busy || !me?.active || host}
                  onClick={() => void act("ready", { ready: !me?.ready })}
                >
                  {busy ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : me?.ready ? (
                    <>
                      <CheckCheck size={17} />{" "}
                      {host ? "Captain ready" : "You’re ready · Undo"}
                    </>
                  ) : (
                    <>
                      I’m ready <Check size={18} />
                    </>
                  )}
                </button>
                {host && (
                  <button
                    className="primary-button full-width start-button"
                    disabled={busy || !allReady}
                    onClick={() => void act("start")}
                  >
                    Launch the heist <ArrowRight size={18} />
                  </button>
                )}
                <p className="crew-hint" aria-live="polite">
                  {players.length < 2
                    ? "Waiting for at least 2 players."
                    : !allReady
                      ? "Waiting for everyone to get ready."
                      : host
                        ? "All systems go. Launch when you’re ready."
                        : "Everyone’s ready. Waiting for the captain to launch."}
                </p>
              </aside>
            </div>
          ) : room.phase === "finished" ? (
            <div className="final-screen">
              <div className="finish-kicker">
                <Sparkles size={15} /> MISSION COMPLETE
              </div>
              <div className="winner-orbit">
                <div className="winner-ring" />
                <Crown size={47} />
                <div className="mini-star star-a">✦</div>
                <div className="mini-star star-b">✧</div>
              </div>
              <h1 ref={phaseHeading} tabIndex={-1}>
                {ranked.filter((p) => p.score === winnerScore).length > 1
                  ? "A shared orbit. A shared win."
                  : `${ranked[0]?.name || "The crew"} owns the orbit.`}
              </h1>
              <p>
                {room.finishReason ||
                  "Six rounds, a few close calls, and one unforgettable heist."}
              </p>
              <FinalRoundReport room={room} playerId={me?.id} />
              <div className="final-board">
                <div className="final-board-header">
                  <span>FINAL FLIGHT MANIFEST</span>
                  <span>GEMS COLLECTED</span>
                </div>
                {ranked.map((player, i) => (
                  <div
                    key={player.id}
                    className={`final-row ${player.score === winnerScore ? "winner-row" : ""}`}
                  >
                    <span className="rank-number">
                      {player.score === winnerScore ? (
                        <Crown size={19} />
                      ) : (
                        String(i + 1).padStart(2, "0")
                      )}
                    </span>
                    <span
                      className="avatar"
                      style={
                        { "--avatar": player.color } as React.CSSProperties
                      }
                    >
                      {player.name[0]?.toUpperCase()}
                    </span>
                    <strong>
                      {player.name} {player.id === me?.id && <small>YOU</small>}
                      {!player.active && <small>LEFT</small>}
                    </strong>
                    <span className="final-score">
                      <Diamond size={16} /> {nf.format(player.score)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="final-actions">
                <button
                  className="primary-button"
                  disabled={busy || !me?.active}
                  onClick={() => void act("rematch")}
                >
                  <RotateCcw size={18} /> One more heist
                </button>
                <button
                  className="secondary-button"
                  disabled={busy}
                  onClick={() => void act("leave")}
                >
                  Back to launchpad <ArrowRight size={17} />
                </button>
              </div>
              <p className="small-muted">
                {session.practice
                  ? "Train again, or return to the launchpad and invite real friends."
                  : "A rematch returns everyone to the lobby. Ready up for a fresh start."}
              </p>
              <MatchReplay
                key={room.code + room.history.length}
                room={room}
                practice={!!session.practice}
              />
              <History room={room} />
            </div>
          ) : (
            <>
              <div className="round-heading">
                <div>
                  <span className="eyebrow">
                    {room.phase === "reveal"
                      ? "SECRETS OUT. GEMS COUNTED."
                      : "THE CREW IS WATCHING. YOUR CHOICE ISN’T."}
                  </span>
                  <h1 ref={phaseHeading} tabIndex={-1}>
                    {room.phase === "reveal"
                      ? "The orbit has spoken."
                      : me?.locked
                        ? "Your move is sealed."
                        : "Where will you make your move?"}
                  </h1>
                </div>
                <div
                  className={`round-clock ${seconds <= 10 && room.phase === "choosing" ? "clock-urgent" : ""}`}
                >
                  <div>
                    <span>
                      {room.phase === "reveal"
                        ? "ROUND REVEALED"
                        : "TIME TO DECIDE"}
                    </span>
                    <strong>
                      {room.phase === "reveal" ? (
                        <CheckCheck size={27} />
                      ) : (
                        <>
                          {String(seconds).padStart(2, "0")}
                          <small>s</small>
                        </>
                      )}
                    </strong>
                  </div>
                  <span className="round-label">
                    ROUND {room.round}
                    <i>/</i>
                    {room.totalRounds}
                  </span>
                </div>
              </div>
              <div
                className="round-progress"
                aria-label={`Round ${room.round} of ${room.totalRounds}`}
              >
                {Array.from({ length: room.totalRounds }, (_, i) => (
                  <span
                    key={i}
                    className={
                      i + 1 < room.round
                        ? "complete"
                        : i + 1 === room.round
                          ? "current"
                          : ""
                    }
                  />
                ))}
              </div>
              {session.practice && room.phase === "choosing" && (
                <TrainingBrief round={room.round} />
              )}
              <div className="play-grid">
                <div className="play-board">
                  <div className="play-map">
                    <div className="board-topline">
                      <span>
                        <span className="status-dot" />{" "}
                        {room.phase === "reveal"
                          ? "SECTOR REPORT"
                          : "LIVE ORBITAL MAP"}
                      </span>
                      <span>
                        {room.phase === "reveal"
                          ? "CHOICES REVEALED"
                          : "CHOICES ARE SECRET"}
                      </span>
                    </div>
                    <OrbitArt
                      sectors={room.sectors}
                      selected={selected}
                      storms={room.result?.stormIds ?? []}
                    />
                    {room.phase === "choosing" && (
                      <div className="map-bottom-note">
                        <Shield size={13} /> Two shields. Six rounds. Use them
                        wisely.
                      </div>
                    )}
                  </div>
                  <div
                    className="sector-grid"
                    role={room.phase === "choosing" ? "group" : undefined}
                    aria-label="Choose a sector"
                  >
                    {room.sectors.map((sector, i) => {
                      const storm = room.result?.stormIds.includes(sector.id);
                      const arrivals =
                        room.result?.gains.filter(
                          (g) => g.sectorId === sector.id,
                        ) ?? [];
                      return (
                        <button
                          key={sector.id}
                          className={`sector-card sector-${names[i]} ${selected === sector.id ? "sector-selected" : ""} ${room.phase === "reveal" ? "sector-revealed" : ""}`}
                          disabled={
                            busy ||
                            room.phase !== "choosing" ||
                            me?.locked ||
                            !me?.active ||
                            seconds <= 0
                          }
                          aria-pressed={selected === sector.id}
                          aria-label={
                            room.phase === "reveal"
                              ? `${sector.name}: ${storm ? "storm hit" : "clear skies"}, ${arrivals.length} arrivals. ${arrivals.map((g) => `${room.players.find((p) => p.id === g.playerId)?.name}: ${g.gain} gems${g.shield ? ", shield used" : ""}`).join(". ")}`
                              : `${sector.name}, ${nf.format(sector.pool)} gem pool, ${riskPercent(sector.risk)} percent storm risk`
                          }
                          onClick={() => setSelected(sector.id)}
                        >
                          <span className="sector-card-top">
                            <span className="sector-number">
                              0{i + 1} /{" "}
                              {room.phase === "reveal" && storm
                                ? "STORM HIT"
                                : room.phase === "reveal"
                                  ? "CLEAR SKIES"
                                  : "SECTOR"}
                            </span>
                            {selected === sector.id ? (
                              <Check size={17} />
                            ) : (
                              <span className="sector-dot" />
                            )}
                          </span>
                          <strong>{sector.name}</strong>
                          <span className="sector-pool">
                            <Diamond size={15} />
                            {nf.format(sector.pool)}
                            <small>gems</small>
                          </span>
                          <span className="sector-card-footer">
                            {room.phase === "reveal" ? (
                              <>
                                <span>
                                  {arrivals.length}{" "}
                                  {arrivals.length === 1
                                    ? "arrival"
                                    : "arrivals"}
                                </span>
                                <span>
                                  {arrivals.filter((g) => g.gain > 0).length > 0
                                    ? `${nf.format(arrivals.find((g) => g.gain > 0)?.gain ?? 0)} / player`
                                    : storm
                                      ? "Unshielded: 0"
                                      : "No haul"}
                                </span>
                              </>
                            ) : (
                              <>
                                <span>
                                  {riskPercent(sector.risk)}% storm risk
                                </span>
                                <span>
                                  {i === 0
                                    ? "LOW"
                                    : i === 1
                                      ? "MEDIUM"
                                      : "HIGH"}
                                </span>
                              </>
                            )}
                          </span>
                          {room.phase === "reveal" && arrivals.length > 0 && (
                            <span className="arrivals">
                              {arrivals.map((g) => {
                                const p = room.players.find(
                                  (v) => v.id === g.playerId,
                                );
                                return (
                                  <span
                                    key={g.playerId}
                                    title={`${p?.name}: ${g.gain} gems${g.shield ? ", shield used" : ""}`}
                                    style={
                                      {
                                        "--avatar": p?.color,
                                      } as React.CSSProperties
                                    }
                                  >
                                    {p?.name[0]?.toUpperCase()}
                                    {g.shield && <Shield size={9} />}
                                  </span>
                                );
                              })}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {room.phase === "choosing" && (
                    <TacticalIntel
                      room={room}
                      selected={selected}
                      shield={shield}
                    />
                  )}
                  {room.phase === "choosing" ? (
                    <div className="move-controls">
                      <div
                        className={`shield-choice ${shield ? "shield-on" : ""}`}
                      >
                        <button
                          className="shield-toggle"
                          aria-label={`Use a shield, ${me?.shields ?? 0} remaining`}
                          role="switch"
                          aria-checked={shield}
                          disabled={
                            busy || me?.locked || !me?.shields || seconds <= 0
                          }
                          onClick={() => setShield(!shield)}
                        >
                          <Shield size={21} />
                          <span>
                            <strong>Shield this run</strong>
                            <small>
                              {me?.shields ?? 0} charges remaining · protects
                              your share in a storm
                            </small>
                          </span>
                          <span className="toggle-track">
                            <i />
                          </span>
                        </button>
                      </div>
                      <button
                        className="primary-button lock-button"
                        disabled={
                          busy ||
                          selected === null ||
                          me?.locked ||
                          seconds <= 0 ||
                          !me?.active
                        }
                        onClick={() =>
                          void act("choose", {
                            sector: selected,
                            shield,
                            round: room.round,
                          })
                        }
                      >
                        {busy ? (
                          <LoaderCircle className="spin" size={17} />
                        ) : me?.locked ? (
                          <>
                            <CheckCheck size={18} /> Choice locked
                          </>
                        ) : seconds <= 0 ? (
                          "Resolving the round…"
                        ) : (
                          <>
                            Lock in{" "}
                            {selected !== null
                              ? room.sectors.find((s) => s.id === selected)
                                  ?.name
                              : "your move"}
                            <ArrowRight size={18} />
                          </>
                        )}
                      </button>
                      <p className="lock-hint" aria-live="polite">
                        {me?.locked
                          ? `${players.filter((p) => p.locked).length} of ${players.length} choices locked. Waiting for the crew or timer.`
                          : "Your choice stays hidden until the reveal. Once locked, it’s final."}
                      </p>
                    </div>
                  ) : (
                    <div className="reveal-controls">
                      <div className="haul-report">
                        <div className="haul-icon">
                          <Diamond size={25} />
                        </div>
                        <div>
                          <span>YOUR ROUND {room.round} HAUL</span>
                          <strong>
                            +{nf.format(myGain?.gain ?? 0)} <small>gems</small>
                          </strong>
                          <p>
                            {!myGain || myGain.sectorId === null
                              ? "No sector locked before the deadline."
                              : myGain.storm && myGain.shield
                                ? "Storm intercepted. Your shield saved your share."
                                : myGain.storm
                                  ? "A cosmic storm caught you. This round’s haul is lost."
                                  : myGain.shield
                                    ? "Clear skies. Shield spent; your haul arrived safely."
                                    : "Clear skies. Your share is safely aboard."}
                          </p>
                        </div>
                      </div>
                      <button
                        className="primary-button"
                        disabled={busy || !canContinue || !me?.active}
                        onClick={() => void act("continue")}
                      >
                        {busy ? (
                          <LoaderCircle className="spin" size={18} />
                        ) : (
                          <>
                            {room.round >= room.totalRounds
                              ? "See the final standings"
                              : "Next orbit"}
                            <ArrowRight size={18} />
                          </>
                        )}
                      </button>
                      {!canContinue && (
                        <span className="small-muted">
                          Taking a moment to count the gems…
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <aside className="score-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">THE COMPETITION</span>
                      <h2>Crew standings</h2>
                    </div>
                    <Crown size={19} />
                  </div>
                  <div className="score-list">
                    {ranked.map((player, i) => (
                      <div
                        key={player.id}
                        className={`score-row ${player.id === me?.id ? "score-me" : ""}`}
                      >
                        <span className="score-rank">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span
                          className="avatar"
                          style={
                            { "--avatar": player.color } as React.CSSProperties
                          }
                        >
                          {player.name[0]?.toUpperCase()}
                        </span>
                        <div className="score-name">
                          <strong>
                            {player.name}
                            {player.id === me?.id && <small>YOU</small>}
                          </strong>
                          <span>
                            {!player.active
                              ? "Left the crew"
                              : room.phase === "choosing"
                                ? player.locked
                                  ? "Move sealed"
                                  : "Choosing an orbit"
                                : `+${nf.format(room.result?.gains.find((g) => g.playerId === player.id)?.gain ?? 0)} this round`}
                          </span>
                        </div>
                        <strong className="score-total">
                          {nf.format(player.score)}
                        </strong>
                        {room.phase === "choosing" && player.locked && (
                          <Check size={12} className="player-locked" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="tactical-note">
                    <span>
                      <Radio size={15} /> CAPTAIN’S LOG
                    </span>
                    <p>
                      {room.phase === "choosing"
                        ? "The biggest pool isn’t always the biggest payout. A crowded sector shares every gem."
                        : "Shields protect against storms, not company. Your share still depends on who joined your orbit."}
                    </p>
                  </div>
                  <div className="personal-loadout">
                    <span className="field-label">YOUR LOADOUT</span>
                    <div>
                      <Shield size={19} />
                      <strong>
                        {me?.shields ?? 0}
                        <small> / 2 shields</small>
                      </strong>
                      <span
                        className={`shield-pip ${(me?.shields ?? 0) >= 1 ? "available" : ""}`}
                      />
                      <span
                        className={`shield-pip ${(me?.shields ?? 0) >= 2 ? "available" : ""}`}
                      />
                    </div>
                  </div>
                  <button
                    className="quiet-button full-width"
                    onClick={() => setRules(true)}
                  >
                    <HelpCircle size={15} /> Need a quick briefing?
                  </button>
                </aside>
              </div>
              <History room={room} />
            </>
          )}
        </section>
      )}
      <footer className="site-footer">
        <div>
          <span className="footer-orbit">✦</span> A LITTLE TRUST. A LITTLE
          TREASON.
        </div>
        <p>
          Fictional gems. Real friends.{" "}
          <span>
            Room nicknames and scores expire after 2 hours. Don’t use personal
            information.
          </span>
        </p>
        <span className="footer-version">
          ORBIT HEIST / FLIGHT SCHOOL EDITION
        </span>
      </footer>
      {rules && <Rules onClose={() => setRules(false)} />}
    </main>
  );
}

function History({ room }: { room: Room }) {
  if (!room.history?.length) return null;
  return (
    <details className="history-panel">
      <summary>
        <span>
          <RotateCcw size={15} /> Mission history
        </span>
        <span>
          {room.history.length} {room.history.length === 1 ? "round" : "rounds"}{" "}
          recorded <ChevronRight size={16} />
        </span>
      </summary>
      <div className="history-scroll">
        <table>
          <caption className="sr-only">
            Each player’s sector and gem haul by round
          </caption>
          <thead>
            <tr>
              <th>ROUND</th>
              {room.players.map((p) => (
                <th key={p.id}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {room.history.map((result) => (
              <tr key={result.round}>
                <th>{String(result.round).padStart(2, "0")}</th>
                {room.players.map((p) => {
                  const g = result.gains.find((v) => v.playerId === p.id);
                  return (
                    <td key={p.id}>
                      <strong>+{nf.format(g?.gain ?? 0)}</strong>
                      <span>
                        {g?.sectorId != null
                          ? room.sectors.find((s) => s.id === g.sectorId)?.name
                          : "Missed"}
                        {g?.shield ? " · Shield" : ""}
                        {g?.storm ? " · Storm" : ""}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

function FinalRoundReport({
  room,
  playerId,
}: {
  room: Room;
  playerId?: string;
}) {
  const result = room.result;
  if (!result) return null;
  const gain = result.gains.find((g) => g.playerId === playerId);
  return (
    <section
      className="final-round-report"
      aria-label={`Round ${result.round} outcome`}
    >
      <div className="final-report-title">
        <span className="eyebrow">LAST ORBIT · ROUND {result.round}</span>
        <strong>
          <Diamond size={16} /> +{nf.format(gain?.gain ?? 0)}{" "}
          <small>your gems</small>
        </strong>
      </div>
      <p>
        {!gain || gain.sectorId === null
          ? "No move was locked before the deadline."
          : gain.storm
            ? gain.shield
              ? "A storm hit your orbit. Your shield protected your share."
              : "A storm hit your orbit. This round’s haul was lost."
            : gain.shield
              ? "Clear skies. Your shield was spent and your share arrived safely."
              : "Clear skies. Your share is safely aboard."}
      </p>
      <div className="final-sector-report">
        {room.sectors.map((sector) => (
          <span key={sector.id}>
            <strong>{sector.name}</strong>
            <small>
              {result.stormIds.includes(sector.id)
                ? "Storm hit"
                : "Clear skies"}{" "}
              · {result.gains.filter((g) => g.sectorId === sector.id).length}{" "}
              {result.gains.filter((g) => g.sectorId === sector.id).length === 1
                ? "arrival"
                : "arrivals"}
            </small>
          </span>
        ))}
      </div>
    </section>
  );
}
