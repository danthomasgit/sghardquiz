"use client";

import { useEffect, useState } from "react";
import styles from "./host.module.css";
import { 
  subscribeToPlayers, 
  resetAllBuzzers, 
  startGame, 
  nextQuestion,
  subscribeToGame,
  updateQuestionTimer,
  updateAnswerStatus,
  restartGame
} from "../services/firebase";
import { Player, GameState } from "../types";

export default function Host() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedStealPlayer, setSelectedStealPlayer] = useState<string | null>(null);

  useEffect(() => {
    const gameId = "default-game";
    // Only subscribe to game for game state and scores
    const unsubscribeGame = subscribeToGame(gameId, (updatedGameState) => {
      setGameState(updatedGameState);
      setIsLoading(false);
      // Debug log for current question and buzzedPlayerId
      if (updatedGameState?.currentQuestion) {
        console.log("[HOST] Current Question:", updatedGameState.currentQuestion);
        console.log("[HOST] buzzedPlayerId:", updatedGameState.currentQuestion.buzzedPlayerId);
      }
    });
    return () => {
      unsubscribeGame();
      if (timer) {
        clearInterval(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (
      gameState?.status === 'in_progress' &&
      gameState.currentQuestion &&
      !gameState.currentQuestion.buzzedPlayerId // Only run timer if no one has buzzed
    ) {
      if (timer) clearInterval(timer); // Always clear any existing timer
      const newTimer = setInterval(async () => {
        const timeRemaining = (gameState.currentQuestion?.timeRemaining || 0) - 1;
        if (timeRemaining <= 0) {
          clearInterval(newTimer); // Clear timer before moving to next question
          setTimer(null);
          await nextQuestion("default-game");
        } else {
          await updateQuestionTimer("default-game", timeRemaining);
        }
      }, 1000);
      setTimer(newTimer);
    } else {
      if (timer) {
        clearInterval(timer);
        setTimer(null);
      }
    }
    return () => {
      if (timer) {
        clearInterval(timer);
        setTimer(null);
      }
    };
  }, [gameState?.status, gameState?.currentQuestion]);

  const handleStartGame = async () => {
    try {
      await startGame("default-game");
    } catch (error) {
      console.error("Error starting game:", error);
    }
  };

  const handleNextQuestion = async () => {
    try {
      await nextQuestion("default-game");
      setSelectedStealPlayer(null);
    } catch (error) {
      console.error("Error moving to next question:", error);
    }
  };

  const handleResetBuzzers = async () => {
    try {
      await resetAllBuzzers("default-game");
    } catch (error) {
      console.error("Error resetting buzzers:", error);
    }
  };

  const handleAnswerStatus = async (status: 'correct' | 'incorrect' | 'steal') => {
    try {
      await updateAnswerStatus('default-game', status);
      // Move to next question after answer is processed
      await nextQuestion('default-game');
    } catch (err) {
      console.error('Error updating answer status:', err);
    }
  };

  const handleRestartGame = async () => {
    try {
      await restartGame("default-game");
    } catch (error) {
      console.error("Error restarting game:", error);
    }
  };

  // For the scores list:
  const players = gameState?.players || [];
  const scoresArray = gameState && gameState.scores && players.length > 0
    ? players.map(p => ({ ...p, score: gameState.scores[p.id] ?? 0 }))
    : [];
  const sortedPlayers = [...scoresArray].sort((a, b) => b.score - a.score);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <p>Loading players...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>Host Dashboard</h1>
        <div className={styles.controls}>
          {gameState?.status === 'waiting' && (
            <button 
              className={styles.startButton}
              onClick={handleStartGame}
            >
              Start Game
            </button>
          )}
          {gameState?.status === 'in_progress' && (
            <>
              <button 
                className={styles.nextButton}
                onClick={handleNextQuestion}
              >
                Next Question
              </button>
              <button 
                className={styles.resetButton}
                onClick={handleResetBuzzers}
              >
                Reset Buzzers
              </button>
            </>
          )}
          <button 
            className={styles.restartButton}
            onClick={handleRestartGame}
          >
            Restart Game
          </button>
        </div>
      </header>

      {gameState?.status === 'in_progress' && gameState.currentQuestion && (
        <div className={styles.currentQuestion}>
          <h2>Current Question</h2>
          <p className={styles.question}>{gameState.currentQuestion.question}</p>
          <p className={styles.answer}>Answer: {gameState.currentQuestion.answer}</p>
          <p className={styles.timer}>Time Remaining: {gameState.currentQuestion.timeRemaining}s</p>
          <p className={styles.currentPlayer}>
            Current Player: {players.find(p => p.id === gameState.currentQuestion?.playerId)?.name}
          </p>
          
          {gameState.currentQuestion.buzzedPlayerId && (
            <div className={styles.answerControls}>
              <h3>Player Buzzed In!</h3>
              <p>
                {players.find(p => p.id === gameState.currentQuestion?.buzzedPlayerId)?.name}
              </p>
              
              <div className={styles.answerButtons}>
                <button onClick={() => handleAnswerStatus('correct')} className={styles.correctButton}>
                  Correct
                </button>
                <button onClick={() => handleAnswerStatus('incorrect')} className={styles.incorrectButton}>
                  Incorrect
                </button>
                <button onClick={() => handleAnswerStatus('steal')} className={styles.stealButton}>
                  Steal
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className={styles.playersGrid}>
        {sortedPlayers.map(player => (
          <div 
            key={player.id} 
            className={`${styles.playerCard} ${player.buzzed ? styles.buzzed : ''}`}
          >
            <div className={styles.playerHeader}>
              <h2>{player.name}</h2>
            </div>
            <p className={styles.subject}>Specialist in: {player.subject}</p>
            <p className={styles.score}>Score: {player.score}</p>
            {player.buzzed && (
              <div className={styles.buzzedIndicator}>
                BUZZED IN!
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 