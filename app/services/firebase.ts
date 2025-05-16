import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp,
  getDoc,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { Player, GameState, Question } from '../types';
import { generateQuestions } from './openai';

const GAMES_COLLECTION = 'games';
const PLAYERS_COLLECTION = 'players';

export const createGame = async (gameId: string): Promise<void> => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  await setDoc(gameRef, {
    id: gameId,
    players: [],
    isActive: true,
    status: 'waiting',
    currentPlayerIndex: 0,
    currentQuestionIndex: 0,
    createdAt: new Date().toISOString(),
    scores: {},
  });
};

export const startGame = async (gameId: string): Promise<void> => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  const gameDoc = await getDoc(gameRef);
  
  if (!gameDoc.exists()) {
    throw new Error('Game not found');
  }

  const gameData = gameDoc.data() as GameState;
  const players = gameData.players;

  if (players.length === 0) {
    throw new Error('No players in game');
  }

  // Get the first player's first question
  const firstPlayer = players[0];
  const firstQuestion = firstPlayer.questions[0];

  await updateDoc(gameRef, {
    status: 'in_progress',
    currentQuestion: {
      question: firstQuestion.question,
      answer: firstQuestion.answer,
      playerId: firstPlayer.id,
      timeRemaining: 30,
    },
    currentPlayerIndex: 0,
    currentQuestionIndex: 0
  });
};

export const nextQuestion = async (gameId: string): Promise<void> => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  const gameDoc = await getDoc(gameRef);
  
  if (!gameDoc.exists()) {
    throw new Error('Game not found');
  }

  const gameData = gameDoc.data() as GameState;
  const players = gameData.players;
  let currentPlayerIndex = parseInt(gameData.currentPlayerIndex, 10);
  let currentQuestionIndex = gameData.currentQuestionIndex;

  // Move to next question for current player
  currentQuestionIndex++;
  
  // If we've gone through all questions for current player, move to next player
  if (currentQuestionIndex >= players[currentPlayerIndex].questions.length) {
    currentPlayerIndex++;
    currentQuestionIndex = 0;
  }

  // If we've gone through all players, end the game
  if (currentPlayerIndex >= players.length) {
    await updateDoc(gameRef, {
      status: 'finished',
      currentQuestion: null
    });
    return;
  }

  const nextPlayer = players[currentPlayerIndex];
  const nextQuestion = nextPlayer.questions[currentQuestionIndex];

  await updateDoc(gameRef, {
    currentQuestion: {
      question: nextQuestion.question,
      answer: nextQuestion.answer,
      playerId: nextPlayer.id,
      timeRemaining: 30,
      buzzedPlayerId: null
    },
    currentPlayerIndex: String(currentPlayerIndex),
    currentQuestionIndex
  });
};

export const updateQuestionTimer = async (gameId: string, timeRemaining: number): Promise<void> => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  await updateDoc(gameRef, {
    'currentQuestion.timeRemaining': timeRemaining
  });
};

export const addPlayer = async (gameId: string, player: Omit<Player, 'id' | 'questions'>): Promise<string> => {
  // First check if a player with this name and subject already exists in this game
  const existingPlayersQuery = query(
    collection(db, PLAYERS_COLLECTION),
    where('gameId', '==', gameId),
    where('name', '==', player.name),
    where('subject', '==', player.subject)
  );

  const existingPlayers = await getDocs(existingPlayersQuery);
  
  if (!existingPlayers.empty) {
    // If player exists, return their ID
    const existingPlayer = existingPlayers.docs[0];
    const playerData = existingPlayer.data() as Player;
    
    // Update their online status and last seen
    await updateDoc(existingPlayer.ref, {
      isOnline: true,
      lastSeen: serverTimestamp()
    });
    
    return existingPlayer.id;
  }

  // If no existing player found, create a new one
  const playerRef = doc(collection(db, PLAYERS_COLLECTION));
  const playerId = playerRef.id;
  
  // Generate questions for the player's subject
  const questions = await generateQuestions(player.subject);
  
  const newPlayer = {
    ...player,
    id: playerId,
    gameId,
    score: 0,
    buzzed: false,
    lastSeen: new Date().toISOString(),
    isOnline: true,
    questions
  };

  // Create the player document
  await setDoc(playerRef, newPlayer);

  // Update the game document to include the new player
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  const gameDoc = await getDoc(gameRef);
  
  if (gameDoc.exists()) {
    const gameData = gameDoc.data() as GameState;
    const updatedPlayers = [...gameData.players, {
      ...newPlayer,
      lastSeen: new Date().toISOString()
    }];
    // Add player to scores map
    const updatedScores = { ...gameData.scores, [playerId]: 0 };
    // Use a transaction to ensure atomic update
    const batch = writeBatch(db);
    batch.update(gameRef, {
      players: updatedPlayers,
      scores: updatedScores
    });
    await batch.commit();
  }

  return playerId;
};

export const updatePlayerBuzzer = async (playerId: string, buzzed: boolean): Promise<void> => {
  const playerRef = doc(db, PLAYERS_COLLECTION, playerId);
  const gameRef = doc(db, GAMES_COLLECTION, 'default-game');

  // Update player's buzzer state
  try {
    await updateDoc(playerRef, { 
      buzzed,
      hasBuzzed: buzzed,
      lastSeen: serverTimestamp(),
      isOnline: true
    });
    console.log('[FIREBASE] Updated player buzzer state for', playerId, 'buzzed:', buzzed);
  } catch (err) {
    console.error('[FIREBASE] Error updating player buzzer state:', err);
  }

  // If buzzing in, update the game state to pause the timer
  if (buzzed) {
    try {
      const gameDoc = await getDoc(gameRef);
      if (gameDoc.exists()) {
        const gameData = gameDoc.data() as GameState;
        if (gameData.currentQuestion) {
          await updateDoc(gameRef, {
            'currentQuestion.buzzedPlayerId': playerId,
            'currentQuestion.answerStatus': 'pending'
          });
          console.log('[FIREBASE] Set buzzedPlayerId in game state:', playerId);
        }
      }
    } catch (err) {
      console.error('[FIREBASE] Error updating buzzedPlayerId in game state:', err);
    }
  }
};

export const updatePlayerOnlineStatus = async (playerId: string, isOnline: boolean): Promise<void> => {
  const playerRef = doc(db, PLAYERS_COLLECTION, playerId);
  await updateDoc(playerRef, { 
    isOnline,
    lastSeen: serverTimestamp()
  });
};

export const resetAllBuzzers = async (gameId: string): Promise<void> => {
  const playersQuery = query(
    collection(db, PLAYERS_COLLECTION),
    where('gameId', '==', gameId)
  );
  
  const snapshot = await getDocs(playersQuery);
  const batch = writeBatch(db);
  
  snapshot.docs.forEach((docSnapshot) => {
    batch.update(docSnapshot.ref, { buzzed: false });
  });
  
  await batch.commit();
};

export const updatePlayerScore = async (playerId: string, score: number): Promise<void> => {
  const playerRef = doc(db, PLAYERS_COLLECTION, playerId);
  await updateDoc(playerRef, { 
    score,
    lastSeen: serverTimestamp(),
    isOnline: true
  });
};

export const subscribeToGame = (
  gameId: string,
  onUpdate: (gameState: GameState) => void
): (() => void) => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  
  return onSnapshot(gameRef, (doc) => {
    if (doc.exists()) {
      onUpdate(doc.data() as GameState);
    }
  });
};

export const subscribeToPlayers = (
  gameId: string,
  onUpdate: (players: Player[]) => void
): (() => void) => {
  const playersQuery = query(
    collection(db, PLAYERS_COLLECTION),
    where('gameId', '==', gameId)
  );
  
  return onSnapshot(playersQuery, (snapshot) => {
    const players = snapshot.docs.map(doc => doc.data() as Player);
    onUpdate(players);
  });
};

export const updateAnswerStatus = async (
  gameId: string,
  status: 'correct' | 'incorrect' | 'steal',
  stealPlayerId?: string
): Promise<void> => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  const gameDoc = await getDoc(gameRef);
  if (!gameDoc.exists()) {
    throw new Error('Game not found');
  }
  const gameData = gameDoc.data() as GameState;
  if (!gameData.currentQuestion) {
    throw new Error('No active question');
  }
  const buzzedPlayerId = gameData.currentQuestion.buzzedPlayerId;
  if (!buzzedPlayerId) {
    throw new Error('No player has buzzed in');
  }
  // Update the scores map
  let updatedScores = { ...gameData.scores };
  if (status === 'correct') {
    updatedScores[buzzedPlayerId] = (updatedScores[buzzedPlayerId] || 0) + 10;
  } else if (status === 'incorrect') {
    updatedScores[buzzedPlayerId] = (updatedScores[buzzedPlayerId] || 0) - 10;
  } else if (status === 'steal' && stealPlayerId) {
    updatedScores[stealPlayerId] = (updatedScores[stealPlayerId] || 0) + 15;
  }
  // Batch update: answer status and scores
  const batch = writeBatch(db);
  batch.update(gameRef, {
    'currentQuestion.answerStatus': status,
    ...(status === 'steal' && stealPlayerId ? { 'currentQuestion.stealPlayerId': stealPlayerId } : {}),
    scores: updatedScores
  });
  // Reset all buzzers
  const playersQuery = query(
    collection(db, PLAYERS_COLLECTION),
    where('gameId', '==', gameId)
  );
  const playersSnapshot = await getDocs(playersQuery);
  playersSnapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { buzzed: false, hasBuzzed: false });
  });
  await batch.commit();
};

export const restartGame = async (gameId: string): Promise<void> => {
  const gameRef = doc(db, GAMES_COLLECTION, gameId);
  const gameDoc = await getDoc(gameRef);
  
  if (!gameDoc.exists()) {
    throw new Error('Game not found');
  }

  const gameData = gameDoc.data() as GameState;
  const players = gameData.players;

  const batch = writeBatch(db);

  // Reset game state
  batch.update(gameRef, {
    status: 'waiting',
    currentQuestion: null,
    currentPlayerIndex: '0',
    currentQuestionIndex: 0
  });

  // Reset all player scores and buzzers
  players.forEach(player => {
    const playerRef = doc(db, PLAYERS_COLLECTION, player.id);
    batch.update(playerRef, {
      score: 0,
      buzzed: false,
      hasBuzzed: false
    });
  });

  await batch.commit();
}; 