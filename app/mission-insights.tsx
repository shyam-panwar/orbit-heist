"use client";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Radar,
  Trophy,
  Share2,
  Check,
  Shield,
} from "lucide-react";
import type { Room } from "./game-types";
import { replayAt, playerDebrief } from "../lib/match-insights.mjs";

export function TacticalIntel({
  room,
  selected,
  shield,
}: {
  room: Room;
  selected: number | null;
  shield: boolean;
}) {
  const sector = room.sectors.find((s) => s.id === selected);
  const previous = room.history.at(-1);
  return (
    <details
      className="intel-panel"
      open={room.round === 1 && selected !== null}
    >
      <summary>
        <span>
          <Radar size={16} /> Flight computer
        </span>
        <span>Read the risk. Read the room.</span>
      </summary>
      <div className="intel-body">
        {sector ? (
          <>
            <div className="intel-title">
              <strong>{sector.name}</strong>
              <span>{Math.round(sector.risk * 100)}% storm risk</span>
            </div>
            <div className="payoff-grid">
              {[1, 2, 3].map((n) => (
                <div key={n}>
                  <span>{n === 1 ? "YOU ALONE" : `${n} ARRIVALS`}</span>
                  <strong>
                    {Math.floor(sector.pool / n)}
                    <small> gems</small>
                  </strong>
                </div>
              ))}
            </div>
            <p>
              {shield
                ? "Shield on: you keep your share even in a storm. It still gets split with other arrivals."
                : "Clear skies: earn the share above. Storm: earn zero unless you use a shield."}
            </p>
          </>
        ) : (
          <p>
            Select a sector to see how the payout changes when rivals join you.
          </p>
        )}
        {previous && (
          <div className="traffic-readout">
            <span className="field-label">
              LAST ROUND’S TRAFFIC · PUBLIC INTEL
            </span>
            <div>
              {room.sectors.map((s) => (
                <span key={s.id}>
                  <strong>{s.name}</strong>
                  <b>
                    {previous.gains.filter((g) => g.sectorId === s.id).length}
                  </b>
                </span>
              ))}
            </div>
            <p>
              Past traffic is a clue, not a forecast. Current choices stay
              secret.
            </p>
          </div>
        )}
      </div>
    </details>
  );
}

export function TrainingBrief({ round }: { round: number }) {
  const lessons = [
    [
      "01 · Read the room",
      "Three simulated rivals have already committed. Kestrel favors safe routes, Echo chases big pools, and Rook avoids last round’s crowds. Pick a sector; their choices stay hidden.",
    ],
    [
      "02 · Follow the traffic",
      "Open the flight computer to see last round’s arrivals. An unpopular orbit can be more valuable than the richest one.",
    ],
    [
      "03 · Spend a shield wisely",
      "You have only two shields. They protect against storms, but never stop rivals splitting the pool.",
    ],
    [
      "04 · Break your pattern",
      "Try a different orbit. Rook adapts to the previous round’s traffic, while the other rivals keep their preferences.",
    ],
    [
      "05 · Protect the big haul",
      "Pools grow as the match goes on. Compare the reward, the storm chance, and your remaining shields.",
    ],
    [
      "06 · Make the last move count",
      "This is the final orbit. Any unused shields disappear after the match. Lock your move, then explore the replay.",
    ],
  ];
  const lesson = lessons[Math.max(0, Math.min(5, round - 1))];
  return (
    <aside className="training-brief">
      <span className="training-badge">FLIGHT SCHOOL</span>
      <div>
        <strong>{lesson[0]}</strong>
        <p>{lesson[1]}</p>
      </div>
    </aside>
  );
}

export function MatchReplay({
  room,
  practice,
}: {
  room: Room;
  practice: boolean;
}) {
  const [round, setRound] = useState(room.history.length);
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState("");
  if (!room.history.length) return null;
  const chosen = Math.min(round, room.history.length);
  const result = room.history[chosen - 1];
  const scores = replayAt(room, chosen);
  const me = room.players.find((p) => p.id === room.youId);
  const insight = playerDebrief(room, room.youId);
  const max = Math.max(1, ...room.players.map((p) => p.score));
  async function share() {
    const text = `ORBIT HEIST${practice ? " · Training" : ""}\n${me?.name ?? "Pilot"}: ${me?.score ?? 0} gems in ${room.history.length} rounds.\n${insight.solo} solo landings · ${insight.saved} gems saved by shields.\nOutguess your crew: ${location.origin}/`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setShareError("");
    } catch {
      setShareError(text);
    }
  }
  return (
    <section
      className="replay-panel"
      aria-label="Match replay and pilot debrief"
    >
      <div className="replay-heading">
        <div>
          <span className="eyebrow">THE STORY BEHIND THE SCORE</span>
          <h2>Every heist leaves a trail.</h2>
        </div>
        <Trophy size={24} />
      </div>
      <svg
        className="score-chart"
        viewBox="0 0 620 190"
        role="img"
        aria-label={`Cumulative scores by round. ${scores.map((p) => `${p.name}: ${p.score}`).join(", ")} at round ${chosen}.`}
      >
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line
              x1="35"
              x2="590"
              y1={155 - t * 130}
              y2={155 - t * 130}
              stroke="#ffffff12"
            />
            <text x="27" y={159 - t * 130} textAnchor="end">
              {Math.round(max * t)}
            </text>
          </g>
        ))}
        {Array.from({ length: room.history.length + 1 }, (_, i) => (
          <text
            key={i}
            x={35 + (i * 555) / room.history.length}
            y="181"
            textAnchor="middle"
          >
            {i === 0 ? "START" : `R${i}`}
          </text>
        ))}
        <line
          x1={35 + (chosen * 555) / room.history.length}
          x2={35 + (chosen * 555) / room.history.length}
          y1="16"
          y2="160"
          stroke="#99e8ff60"
          strokeDasharray="3 4"
        />
        {room.players.map((p) => {
          const points = Array.from(
            { length: chosen + 1 },
            (_, i) =>
              `${35 + (i * 555) / room.history.length},${155 - ((replayAt(room, i).find((v) => v.id === p.id)?.score ?? 0) / max) * 130}`,
          ).join(" ");
          return (
            <g key={p.id}>
              <polyline
                points={points}
                fill="none"
                stroke={p.color}
                strokeWidth="2.5"
              />
              <circle
                cx={35 + (chosen * 555) / room.history.length}
                cy={
                  155 -
                  ((scores.find((v) => v.id === p.id)?.score ?? 0) / max) * 130
                }
                r="4"
                fill={p.color}
              />
            </g>
          );
        })}
      </svg>
      <div className="replay-controls">
        <button
          className="icon-button"
          aria-label="Previous replay round"
          disabled={chosen <= 1}
          onClick={() => setRound(chosen - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <label>
          ROUND {chosen} / {room.history.length}
          <input
            aria-label="Replay round"
            type="range"
            min="1"
            max={room.history.length}
            value={chosen}
            onChange={(e) => setRound(Number(e.target.value))}
          />
        </label>
        <button
          className="icon-button"
          aria-label="Next replay round"
          disabled={chosen >= room.history.length}
          onClick={() => setRound(chosen + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="replay-pilots" aria-live="polite">
        {scores.map((p) => {
          const gain = result.gains.find((g) => g.playerId === p.id);
          return (
            <div key={p.id}>
              <i style={{ background: p.color }} />
              <strong>{p.name}</strong>
              <span>
                {gain?.sectorId != null
                  ? room.sectors.find((s) => s.id === gain.sectorId)?.name
                  : "Missed move"}
                {gain?.shield && <Shield size={12} />}
              </span>
              <b>
                +{gain?.gain ?? 0}
                <small>{p.score} total</small>
              </b>
            </div>
          );
        })}
      </div>
      <div className="pilot-debrief">
        <div>
          <span className="eyebrow">YOUR PILOT PROFILE</span>
          <h3>{insight.title}</h3>
          <p>{insight.tip}</p>
        </div>
        <div className="debrief-stats">
          <span>
            <b>{insight.solo}</b>solo landings
          </span>
          <span>
            <b>{insight.saved}</b>gems shielded
          </span>
        </div>
      </div>
      <button
        className="secondary-button share-result"
        onClick={() => void share()}
      >
        {copied ? <Check size={16} /> : <Share2 size={16} />}
        {copied ? "Result copied" : "Copy my flight report"}
      </button>
      <p className="share-note">
        Copies a text summary and game link. You choose where to share it.
      </p>
      {shareError && (
        <p className="share-fallback" role="status">
          {shareError}
        </p>
      )}
    </section>
  );
}
