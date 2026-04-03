export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type CardRank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'Joker';

export type UnoColor = 'red' | 'blue' | 'green' | 'yellow' | 'wild';
export type UnoValue = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'draw4';

export interface UnoCard {
  id: string;
  color: UnoColor;
  value: UnoValue;
}

export interface Card {
  id: string;
  suit?: CardSuit;
  rank: CardRank;
  value: number;
  isWild?: boolean;
}

export interface Player {
  uid: string;
  displayName: string;
  photoURL?: string;
  hand: Card[];
  score: number;
  totalScore: number;
  isBot: boolean;
  isReady: boolean;
  isAway: boolean;
  isInRound: boolean;
  lastActionAt: number;
  hasDiscarded: boolean;
  xpGained?: number;
}

export interface CallBreakPlayer extends Player {
  call: number;
  tricksWon: number;
  roundScores: number[];
}

export interface UnoPlayer extends Player {
  hand: any[]; // Using any[] temporarily to avoid conflict with Player.hand which is Card[]
  unoHand: UnoCard[];
  hasSaidUno: boolean;
}

export interface CallBreakGame {
  roomId: string;
  hostId: string;
  status: 'waiting' | 'bidding' | 'playing' | 'trickEnd' | 'roundEnd' | 'ended';
  players: CallBreakPlayer[];
  config: {
    rounds: number;
    maxPlayers: number;
    turnTimer: number;
  };
  currentRound: number;
  turnIndex: number;
  dealerIndex: number;
  leadSuit: CardSuit | null;
  currentTrick: { playerUid: string; card: Card }[];
  lastTrick?: { playerUid: string; card: Card }[];
  lastTrickWinnerId?: string;
  winnerId?: string;
  logs: string[];
  turnStartedAt: number;
}

export interface GameConfig {
  maxPlayers: number;
  callLimit: number;
  eliminationLimit: number;
  penaltyValue: number;
  turnTimer: number;
}

export interface GameState {
  roomId: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'showdown' | 'ended';
  players: Player[];
  deck: Card[];
  discardPile: Card[];
  tempDiscardPile: Card[];
  turnIndex: number;
  wildRank: CardRank | null;
  jokerCard: Card | null;
  lastRoundWinnerId: string | null;
  lastRoundCallerId: string | null;
  lastRoundCaughtId: string | null;
  config: GameConfig;
  winnerId: string | null;
  roundNumber: number;
  roundScores: { round: number; scores: Record<string, number> }[];
  logs: string[];
  turnStartedAt: number;
}

export interface RoundScore {
  round: number;
  scores: Record<string, number>;
}

export interface MatchHistory {
  id: string;
  roomId: string;
  participants: { uid: string; displayName: string; photoURL?: string; score: number }[];
  winnerId: string;
  endedAt: number;
  roundScores: RoundScore[];
}

export interface UnoGame {
  roomId: string;
  hostId: string;
  status: 'waiting' | 'playing' | 'ended';
  players: UnoPlayer[];
  deck: UnoCard[];
  discardPile: UnoCard[];
  turnIndex: number;
  direction: 1 | -1;
  currentColor: UnoColor;
  currentValue: UnoValue;
  winnerId: string | null;
  logs: string[];
  turnStartedAt: number;
  pendingDrawCount: number;
  config: {
    maxPlayers: number;
    turnTimer: number;
    scoreLimit: number;
  };
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL?: string;
  wins: number;
  losses: number;
  xp: number;
  level: number;
  matchHistory: MatchHistory[];
  following: string[];
  createdAt: number;
}

export interface Sound {
  id: string;
  label: string;
  icon: string;
  createdAt: number;
}
