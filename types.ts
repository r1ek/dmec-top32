export interface Participant {
  id: number;
  name: string;
  score: number | null;
  seed: number;
}

export interface Match {
  id: number;
  roundIndex: number;
  matchIndex: number;
  participant1: Participant | null;
  participant2: Participant | null;
  winner: Participant | null;
  nextMatchId: number | null;
}

export type Round = Match[];

export type BracketData = Round[];

export interface ChampionshipStanding {
    id: number;
    name: string;
    pointsPerCompetition: number[];
}

export enum AppPhase {
  CHAMPIONSHIP_VIEW = 'CHAMPIONSHIP_VIEW',
  QUALIFICATION = 'QUALIFICATION',
  BRACKET = 'BRACKET',
  FINISHED = 'FINISHED',
}

export interface ActiveVote {
  voteId: string;
  matchId: number;
  participant1Name: string;
  participant2Name: string;
  votes: ('p1' | 'p2' | 'omt')[];
}

export interface AppState {
  phase: AppPhase;
  standings: ChampionshipStanding[];
  competitionParticipants: Participant[];
  bracket: BracketData;
  thirdPlaceMatch: Match | null;
  totalCompetitions: number | null;
  competitionsHeld: number;
}
