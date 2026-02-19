export type ChallengeStatus = 'pending' | 'accepted' | 'active' | 'completed' | 'declined' | 'expired';

export interface ChallengeUser {
  id: string;
  name: string;
  email: string;
}

export interface Challenge {
  id: string;
  challenger_id: string;
  opponent_id: string;
  challenger: ChallengeUser;
  opponent: ChallengeUser;
  task_id: string;
  status: ChallengeStatus;
  winner_id: string | null;
  xp_bonus: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface ChallengeTask {
  id: string;
  instruction_theory: string;
  coding_requirements: string[];
  hints: string[];
  test_specification: {
    expected_state?: string;
    verification_code?: string;
  };
  starter_code: string | null;
}

export interface ChallengeDetail extends Challenge {
  task: ChallengeTask;
}

export interface OpponentProgress {
  opponent_line_count: number;
  opponent_status: 'coding' | 'submitted' | 'completed';
  my_line_count: number;
  my_status: 'coding' | 'submitted' | 'completed';
  challenge_status: ChallengeStatus;
  winner_id: string | null;
}
