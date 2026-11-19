export type Player = {
  id: string;
  name: string;
  color: string;
  score: number;
  shields: number;
  ready: boolean;
  locked: boolean;
  active: boolean;
};
export type Sector = {
  id: number;
  name: string;
  pool: number;
  risk: number;
  flavor: string;
};
export type Result = {
  round: number;
  stormIds: number[];
  gains: {
    playerId: string;
    sectorId: number | null;
    shield: boolean;
    gain: number;
    storm: boolean;
    share: number;
  }[];
};
export type Room = {
  code: string;
  phase: "lobby" | "choosing" | "reveal" | "finished";
  round: number;
  totalRounds: number;
  deadline: number | null;
  serverNow: number;
  hostId: string;
  youId: string | null;
  revision: number;
  players: Player[];
  sectors: Sector[];
  result: Result | null;
  history: Result[];
  finishReason?: string;
};
