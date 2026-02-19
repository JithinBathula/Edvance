export type ChallengeStatus = 'pending' | 'accepted' | 'active' | 'completed' | 'declined' | 'expired';
export type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

export interface ChallengeUser {
  id: string;
  name: string;
  email: string;
}

export interface ChallengePuzzle {
  title: string;
  description: string;
  starter_code: string;
}

export interface Challenge {
  id: string;
  challenger_id: string;
  opponent_id: string;
  challenger: ChallengeUser;
  opponent: ChallengeUser;
  difficulty: ChallengeDifficulty;
  puzzle?: ChallengePuzzle | { title: string };
  status: ChallengeStatus;
  winner_id: string | null;
  xp_bonus: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ChallengeDetail extends Challenge {
  puzzle: ChallengePuzzle;
}

export interface OpponentProgress {
  opponent_line_count: number;
  opponent_status: 'coding' | 'submitted' | 'completed';
  my_line_count: number;
  my_status: 'coding' | 'submitted' | 'completed';
  challenge_status: ChallengeStatus;
  winner_id: string | null;
}
