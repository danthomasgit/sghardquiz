export interface Question {
  question: string;
  answer: string;
}

export interface Player {
  id: string;
  name: string;
  subject: string;
  score: number;
  buzzed: boolean;
  hasBuzzed: boolean;
  isOnline: boolean;
  lastSeen: any; // Firebase Timestamp
  questions: Question[];
}

export interface GameState {
  id: string;
  players: Player[];
  isActive: boolean;
  status: 'waiting' | 'in_progress' | 'completed';
  currentQuestion?: {
    question: string;
    answer: string;
    playerId: string;
    timeRemaining: number;
    buzzedPlayerId: string | null;
    answerStatus: 'pending' | 'correct' | 'incorrect' | 'steal' | null;
    stealPlayerId: string | null;
  };
  currentPlayerIndex: string;
  currentQuestionIndex: number;
} 