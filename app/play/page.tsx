"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./play.module.css";
import { Player, GameState } from "../types";
import { addPlayer, updatePlayerBuzzer, updatePlayerOnlineStatus, subscribeToGame, createGame, subscribeToPlayers } from "../services/firebase";
import { getDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { Suspense } from 'react';

function PlayerGame() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [player, setPlayer] = useState<Player | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<{ question: string; timeRemaining: number } | null>(null);
  const [isCurrentPlayer, setIsCurrentPlayer] = useState(false);
  const [canBuzz, setCanBuzz] = useState(false);
  const isCreatingPlayerRef = useRef(false);
  const hasInitializedRef = useRef(false);
  const createdPlayerIdRef = useRef<string | null>(null);
  const gameStateRef = useRef<GameState | null>(null);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    let gameUnsubscribe: (() => void) | undefined;
    const storedPlayerId = localStorage.getItem("playerId");
    const storedPlayerName = localStorage.getItem("playerName");
    const storedPlayerSubject = localStorage.getItem("playerSubject");

    // Get player info from URL params or localStorage
    const playerName = searchParams.get("name") || storedPlayerName;
    const playerSubject = searchParams.get("subject") || storedPlayerSubject;

    const ensurePlayerInGame = async (playerId: string) => {
      // Check if player exists in players collection
      const playerDocRef = doc(db, 'players', playerId);
      const playerDoc = await getDoc(playerDocRef);
      if (!playerDoc.exists()) return null;
      const playerData = playerDoc.data() as Player;

      // Check if player is in the game's players array
      const gameDocRef = doc(db, 'games', 'default-game');
      const gameDoc = await getDoc(gameDocRef);
      if (!gameDoc.exists()) return null;
      const gameData = gameDoc.data() as GameState;
      const foundInGame = gameData.players.some(p => p.id === playerId);
      if (!foundInGame) {
        // Add player to game's players array
        await updateDoc(gameDocRef, {
          players: arrayUnion(playerData)
        });
      }
      return playerData;
    };

    if (playerName && playerSubject) {
      // Store in localStorage for future use
      localStorage.setItem("playerName", playerName);
      localStorage.setItem("playerSubject", playerSubject);

      // Async function for player creation (move here for scope)
      const createAndSetPlayer = async () => {
        try {
          const playerId = await addPlayer("default-game", {
            name: playerName,
            subject: playerSubject,
            score: 0,
            buzzed: false,
            hasBuzzed: false,
            isOnline: true,
            lastSeen: new Date(),
          });
          localStorage.setItem("playerId", playerId);
          createdPlayerIdRef.current = playerId;
          const currentGameState = gameStateRef.current;
          if (currentGameState) {
            const foundPlayer = currentGameState.players.find((p: Player) => p.id === playerId);
            if (foundPlayer) {
              setPlayer(foundPlayer);
              setIsLoading(false);
            }
          }
        } catch (err) {
          setError("Failed to create player. Please try again.");
          setIsLoading(false);
        } finally {
          isCreatingPlayerRef.current = false;
        }
      };

      const checkPlayer = async () => {
        if (hasInitializedRef.current) {
          console.log("Already initialized, skipping...");
          return;
        }
        hasInitializedRef.current = true;

        try {
          console.log("Starting player check...");
          await createGame("default-game");
          console.log("Game created/verified");

          // If we have a stored player ID, ensure player is in both places
          if (storedPlayerId) {
            const playerData = await ensurePlayerInGame(storedPlayerId);
            if (playerData) {
              setPlayer(playerData);
              setIsLoading(false);
            }
          }

          // Subscribe to game updates
          gameUnsubscribe = subscribeToGame("default-game", (gameState: GameState) => {
            gameStateRef.current = gameState;
            setGameState(gameState);
            // If we have a stored player ID, try to find that player
            if (storedPlayerId) {
              const foundPlayer = gameState.players.find(p => p.id === storedPlayerId);
              if (foundPlayer) {
                setPlayer(foundPlayer);
                setIsLoading(false);
                return;
              }
            }
            // Check for newly created player
            if (createdPlayerIdRef.current) {
              const foundPlayer = gameState.players.find(p => p.id === createdPlayerIdRef.current);
              if (foundPlayer) {
                setPlayer(foundPlayer);
                setIsLoading(false);
                return;
              }
            }
            // If we don't have a player yet and we're not already creating one
            if (!player && !isCreatingPlayerRef.current) {
              isCreatingPlayerRef.current = true;
              createAndSetPlayer();
            }
            if (gameState.currentQuestion) {
              setCurrentQuestion({
                question: gameState.currentQuestion.question,
                timeRemaining: gameState.currentQuestion.timeRemaining,
              });
              setIsCurrentPlayer(gameState.currentPlayerIndex === player?.id);
              const canBuzzIn =
                gameState.status === 'in_progress' &&
                !gameState.currentQuestion.buzzedPlayerId &&
                !player?.hasBuzzed;
              setCanBuzz(!!canBuzzIn);
            } else {
              setCurrentQuestion(null);
              setIsCurrentPlayer(false);
              setCanBuzz(false);
            }
          });
        } catch (err) {
          setError("Failed to restore player session. Please try again.");
          setIsLoading(false);
        }
      };
      checkPlayer();
    } else {
      setError("Missing player information. Please return to the home page.");
      setIsLoading(false);
    }

    return () => {
      if (gameUnsubscribe) gameUnsubscribe();
      hasInitializedRef.current = false;
      createdPlayerIdRef.current = null;
      gameStateRef.current = null;
    };
  }, [searchParams]);

  useEffect(() => {
    if (!player) return;

    console.log("Setting up game state subscription for player:", player.id);
    // Subscribe to game state updates
    const unsubscribe = subscribeToGame("default-game", (gameState: GameState) => {
      console.log("Game state updated for player:", player.id, gameState);
      if (gameState.currentQuestion) {
        setCurrentQuestion({
          question: gameState.currentQuestion.question,
          timeRemaining: gameState.currentQuestion.timeRemaining,
        });
        setIsCurrentPlayer(gameState.currentPlayerIndex === player.id);
        
        // Update canBuzz state
        const canBuzzIn = 
          gameState.status === 'in_progress' && 
          !gameState.currentQuestion.buzzedPlayerId && 
          !player.hasBuzzed;
        setCanBuzz(canBuzzIn);
      } else {
        setCurrentQuestion(null);
        setIsCurrentPlayer(false);
        setCanBuzz(false);
      }
    });

    return () => {
      console.log("Cleaning up game state subscription for player:", player.id);
      unsubscribe();
    };
  }, [player]);

  const handleBuzzer = async () => {
    if (!player || !canBuzz) return;
    console.log('[PLAYER] Buzz button pressed by', player.id);
    try {
      await updatePlayerBuzzer(player.id, true);
      console.log('[PLAYER] Buzz update sent for', player.id);
    } catch (err) {
      console.error('[PLAYER] Error updating buzzer:', err);
    }
  };

  // For the scores list:
  const playersList = gameState?.players || [];
  const scoresArray = playersList.length > 0 && gameState && gameState.scores
    ? playersList.map(p => ({ ...p, score: gameState.scores[p.id] ?? 0 }))
    : [];
  const sortedPlayers = [...scoresArray].sort((a, b) => b.score - a.score);

  const subjectOwner =
    gameState?.players?.find(p => p.id === gameState?.currentQuestion?.playerId)?.name;

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <p>Loading player session...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.error}>
          <p>{error}</p>
          <button onClick={() => router.push("/")} className={styles.homeButton}>
            Return Home
          </button>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>
          <p>Waiting for player data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.columns}>
        {/* Left column: Question, subject, timer */}
        <div className={styles.leftColumn}>
          <div className={styles.header}>
            <h1>Welcome, {player.name}!</h1>
            <p className={styles.subject}>Subject: {player.subject}</p>
          </div>
          {currentQuestion && (
            <div className={styles.questionCard}>
              <h2>Current Question</h2>
              <p className={styles.question}>{currentQuestion.question}</p>
              <p className={styles.timer}>Time Remaining: {currentQuestion.timeRemaining}s</p>
              <p className={styles.subjectInfo}>
                {isCurrentPlayer
                  ? "Your subject!"
                  : subjectOwner
                    ? `About ${subjectOwner}'s subject`
                    : "About a player's subject"}
              </p>
            </div>
          )}
        </div>
        {/* Right column: Buzzer and scores */}
        <div className={styles.rightColumn}>
          <div className={styles.buzzerContainer}>
            <button
              onClick={handleBuzzer}
              disabled={!canBuzz}
              className={`${styles.buzzerButton} ${player.hasBuzzed ? styles.buzzed : ""} ${!canBuzz ? styles.disabled : ""}`}
            >
              {player.hasBuzzed ? "Buzzed!" : "Buzz In!"}
            </button>
            {!canBuzz && !player.hasBuzzed && (
              <p className={styles.waitMessage}>
                {currentQuestion ? "Waiting for your turn..." : "Waiting for the game to start..."}
              </p>
            )}
          </div>
          <div className={styles.scoresList}>
            <h2>Scores</h2>
            <ul>
              {sortedPlayers.map(p => (
                <li key={p.id} className={p.id === player.id ? styles.currentPlayerScore : undefined}>
                  {p.name}: <span className={styles.scoreValue}>{p.score}pts</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PlayerGame />
    </Suspense>
  );
} 