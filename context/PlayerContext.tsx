import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const SKINS = [
  { id: "default", name: "المبتدئ", color: "#4ECDC4", icon: "star", price: 0 },
  { id: "prince", name: "الأمير", color: "#FFD700", icon: "crown", price: 100 },
  { id: "explorer", name: "المستكشف", color: "#27AE60", icon: "compass", price: 150 },
  { id: "scholar", name: "العالم", color: "#9B59B6", icon: "book", price: 200 },
  { id: "champion", name: "البطل", color: "#E74C3C", icon: "trophy", price: 300 },
  { id: "royal", name: "الملكي", color: "#2E86AB", icon: "shield", price: 500 },
  { id: "wizard", name: "الساحر", color: "#F39C12", icon: "sparkles", price: 750 },
  { id: "legend", name: "الأسطوري", color: "#C0392B", icon: "fire", price: 1000 },
];

export type Difficulty = "easy" | "normal" | "hard";

export interface PlayerData {
  name: string;
  coins: number;
  currentSkin: string;
  ownedSkins: string[];
  totalWins: number;
  totalGames: number;
  bestScore: number;
  difficulty: Difficulty;
  claimedTrialReward: boolean;
}

interface PlayerContextValue {
  player: PlayerData;
  setName: (name: string) => void;
  addCoins: (amount: number) => void;
  spendCoins: (amount: number) => boolean;
  setSkin: (skinId: string) => void;
  buySkin: (skinId: string) => boolean;
  recordGame: (score: number, won: boolean) => void;
  setDifficulty: (d: Difficulty) => void;
  claimTrialReward: () => boolean;
  isLoaded: boolean;
}

const TRIAL_REWARD_AMOUNT = 200;

const defaultPlayer: PlayerData = {
  name: "",
  coins: 50,
  currentSkin: "default",
  ownedSkins: ["default"],
  totalWins: 0,
  totalGames: 0,
  bestScore: 0,
  difficulty: "normal",
  claimedTrialReward: false,
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<PlayerData>(defaultPlayer);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem("playerData")
      .then((data) => {
        if (data) {
          setPlayer(JSON.parse(data));
        }
      })
      .finally(() => setIsLoaded(true));
  }, []);

  const updatePlayer = (updater: (prev: PlayerData) => PlayerData) => {
    setPlayer((prev) => {
      const next = updater(prev);
      AsyncStorage.setItem("playerData", JSON.stringify(next));
      return next;
    });
  };

  const setName = (name: string) => {
    updatePlayer((prev) => ({ ...prev, name }));
  };

  const addCoins = (amount: number) => {
    updatePlayer((prev) => ({ ...prev, coins: prev.coins + amount }));
  };

  const spendCoins = (amount: number): boolean => {
    if (player.coins < amount) return false;
    updatePlayer((prev) => ({ ...prev, coins: prev.coins - amount }));
    return true;
  };

  const setSkin = (skinId: string) => {
    if (player.ownedSkins.includes(skinId)) {
      updatePlayer((prev) => ({ ...prev, currentSkin: skinId }));
    }
  };

  const buySkin = (skinId: string): boolean => {
    const skin = SKINS.find((s) => s.id === skinId);
    if (!skin || player.ownedSkins.includes(skinId)) return false;
    if (player.coins < skin.price) return false;
    updatePlayer((prev) => ({
      ...prev,
      coins: prev.coins - skin.price,
      ownedSkins: [...prev.ownedSkins, skinId],
      currentSkin: skinId,
    }));
    return true;
  };

  const recordGame = (score: number, won: boolean) => {
    updatePlayer((prev) => ({
      ...prev,
      totalGames: prev.totalGames + 1,
      totalWins: prev.totalWins + (won ? 1 : 0),
      bestScore: Math.max(prev.bestScore, score),
    }));
  };

  const setDifficulty = (d: Difficulty) => {
    updatePlayer((prev) => ({ ...prev, difficulty: d }));
  };

  const claimTrialReward = (): boolean => {
    if (player.claimedTrialReward) return false;
    updatePlayer((prev) => ({ ...prev, coins: prev.coins + TRIAL_REWARD_AMOUNT, claimedTrialReward: true }));
    return true;
  };

  const value = useMemo(
    () => ({ player, setName, addCoins, spendCoins, setSkin, buySkin, recordGame, setDifficulty, claimTrialReward, isLoaded }),
    [player, isLoaded]
  );

  return <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
