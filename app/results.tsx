import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Animated,
  ActivityIndicator,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";
import { usePlayer } from "@/context/PlayerContext";
import { useSocket } from "@/context/SocketContext";
import { PlayerAvatar } from "@/components/PlayerAvatar";

interface AnswerResult {
  text: string;
  points: number;
  status: "correct" | "duplicate" | "empty";
}

interface PlayerResult {
  playerId: string;
  playerName: string;
  skin: string;
  answers: Record<string, AnswerResult>;
  roundScore: number;
  totalScore: number;
}

export default function ResultsScreen() {
  const insets = useSafeAreaInsets();
  const { socket } = useSocket();
  const { player, addCoins, recordGame } = usePlayer();
  const params = useLocalSearchParams();

  const results: PlayerResult[] = JSON.parse((params.results as string) || "[]");
  const letter = params.letter as string;
  const round = parseInt((params.round as string) || "1");
  const maxRounds = parseInt((params.maxRounds as string) || "3");
  const roomCode = params.roomCode as string;
  const isLastRound = round >= maxRounds;

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const hostId = params.hostId as string;
  const isHost = socket?.id === hostId;
  const [waitingNext, setWaitingNext] = React.useState(false);

  const confettiAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(confettiAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 50,
      friction: 7,
    }).start();

    if (results.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("game_started", (gameData) => {
      setWaitingNext(false);
      router.replace({
        pathname: "/game",
        params: {
          roomCode,
          letter: gameData.letter,
          categories: JSON.stringify(gameData.categories),
          timeLimit: String(gameData.timeLimit),
          round: String(gameData.round),
          maxRounds: String(gameData.maxRounds),
          hostId: gameData.hostId || hostId,
        },
      });
    });

    socket.on("game_finished", ({ finalScores }) => {
      const myResult = finalScores?.find((r: PlayerResult) => r.playerName === player.name);
      const myRank = finalScores?.findIndex((r: PlayerResult) => r.playerName === player.name);

      let coinsEarned = 10;
      if (myRank === 0) coinsEarned = 50;
      else if (myRank === 1) coinsEarned = 30;
      else if (myRank === 2) coinsEarned = 20;

      addCoins(coinsEarned);
      recordGame(myResult?.totalScore || 0, myRank === 0);

      updateLeaderboard({
        name: player.name,
        skin: player.currentSkin,
        score: myResult?.totalScore || 0,
        wins: myRank === 0 ? 1 : 0,
        games: 1,
        date: new Date().toISOString(),
      });

      router.replace({
        pathname: "/final",
        params: {
          finalScores: JSON.stringify(finalScores),
          coinsEarned: String(coinsEarned),
          roomCode,
        },
      });
    });

    return () => {
      socket.off("game_started");
      socket.off("game_finished");
    };
  }, [socket]);

  const handleNextRound = () => {
    setWaitingNext(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    socket?.emit("next_round", { roomCode });
  };

  const handleGoHome = () => {
    router.replace("/(tabs)");
  };

  const myResult = results.find((r) => r.playerName === player.name) || results[0];
  const topPlayer = results[0];

  return (
    <LinearGradient colors={["#0D0625", "#1A0D40", "#2D1B69"]} style={styles.container}>
      <Animated.View
        style={[styles.innerContainer, { transform: [{ scale: confettiAnim }], opacity: confettiAnim }]}
      >
        <View style={[styles.header, { paddingTop: topInset + 12 }]}>
          <View style={styles.headerContent}>
            <Text style={styles.roundLabel}>
              نتائج الجولة {round}/{maxRounds}
            </Text>
            <View style={styles.letterBadge}>
              <Text style={styles.letterBadgeText}>حرف: {letter}</Text>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {topPlayer && (
            <View style={styles.winnerCard}>
              <LinearGradient
                colors={["#FFD700" + "30", "#F5A623" + "20"]}
                style={styles.winnerGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="trophy" size={28} color={Colors.gold} />
                <View style={styles.winnerInfo}>
                  <PlayerAvatar skinId={topPlayer.skin} size={52} />
                  <View>
                    <Text style={styles.winnerName}>{topPlayer.playerName}</Text>
                    <Text style={styles.winnerScore}>{topPlayer.roundScore} نقطة هذه الجولة</Text>
                  </View>
                </View>
              </LinearGradient>
            </View>
          )}

          <Text style={styles.sectionTitle}>ترتيب اللاعبين</Text>
          <View style={styles.rankingList}>
            {results.map((r, i) => (
              <Animated.View key={r.playerId}>
                <RankRow result={r} rank={i} isMe={r.playerName === player.name} />
              </Animated.View>
            ))}
          </View>

          {results.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>تفاصيل الإجابات</Text>
              {results.map((r) => (
                <AnswerDetail key={r.playerId} result={r} />
              ))}
            </>
          )}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: bottomInset + 16 }]}>
          {isLastRound ? (
            <Pressable
              onPress={handleGoHome}
              style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient
                colors={["#F5A623", "#FF6B35"]}
                style={styles.actionBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="home" size={22} color="#fff" />
                <Text style={styles.actionBtnText}>العودة للرئيسية</Text>
              </LinearGradient>
            </Pressable>
          ) : isHost ? (
            <Pressable
              onPress={handleNextRound}
              disabled={waitingNext}
              style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient
                colors={["#4ECDC4", "#27AE60"]}
                style={styles.actionBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {waitingNext ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="play-forward" size={22} color="#fff" />
                    <Text style={styles.actionBtnText}>الجولة التالية</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={styles.waitingBar}>
              <ActivityIndicator color={Colors.secondary} />
              <Text style={styles.waitingText}>في انتظار المضيف لبدء الجولة التالية...</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </LinearGradient>
  );
}

async function updateLeaderboard(entry: {
  name: string;
  skin: string;
  score: number;
  wins: number;
  games: number;
  date: string;
}) {
  try {
    const data = await AsyncStorage.getItem("leaderboard");
    let entries: typeof entry[] = data ? JSON.parse(data) : [];
    const existingIdx = entries.findIndex((e) => e.name === entry.name);
    if (existingIdx >= 0) {
      entries[existingIdx].score = Math.max(entries[existingIdx].score, entry.score);
      entries[existingIdx].wins += entry.wins;
      entries[existingIdx].games += entry.games;
    } else {
      entries.push(entry);
    }
    entries.sort((a, b) => b.score - a.score);
    entries = entries.slice(0, 20);
    await AsyncStorage.setItem("leaderboard", JSON.stringify(entries));
  } catch {}
}

function RankRow({ result, rank, isMe }: { result: PlayerResult; rank: number; isMe: boolean }) {
  const rankColors = [Colors.gold, Colors.silver, Colors.bronze];
  const rankColor = rank < 3 ? rankColors[rank] : Colors.textMuted;

  return (
    <View style={[styles.rankRow, isMe && styles.rankRowMe]}>
      <Text style={[styles.rankNum, { color: rankColor }]}>{rank + 1}</Text>
      <PlayerAvatar skinId={result.skin} size={40} />
      <Text style={styles.rankName}>{result.playerName}{isMe ? " ✓" : ""}</Text>
      <View style={styles.rankScores}>
        <Text style={[styles.rankRoundScore, { color: rankColor }]}>+{result.roundScore}</Text>
        <Text style={styles.rankTotalScore}>{result.totalScore} إجمالي</Text>
      </View>
    </View>
  );
}

function AnswerDetail({ result }: { result: PlayerResult }) {
  const statusColor = {
    correct: Colors.success,
    duplicate: Colors.duplicate,
    empty: Colors.textMuted,
  };

  const statusIcon = {
    correct: "checkmark-circle" as const,
    duplicate: "copy" as const,
    empty: "remove-circle" as const,
  };

  return (
    <View style={styles.answerCard}>
      <View style={styles.answerCardHeader}>
        <PlayerAvatar skinId={result.skin} size={36} />
        <Text style={styles.answerCardName}>{result.playerName}</Text>
        <Text style={styles.answerCardTotal}>{result.roundScore} نقطة</Text>
      </View>
      <View style={styles.answerList}>
        {Object.entries(result.answers).map(([cat, answer]) => (
          <View key={cat} style={styles.answerRow}>
            <View style={styles.answerCatLabel}>
              <Ionicons
                name={statusIcon[answer.status]}
                size={14}
                color={statusColor[answer.status]}
              />
              <Text style={[styles.answerPoints, { color: statusColor[answer.status] }]}>
                +{answer.points}
              </Text>
            </View>
            <Text style={[styles.answerText, !answer.text && styles.answerEmpty]}>
              {answer.text || "-"}
            </Text>
            <Text style={styles.answerCat}>{cat}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  innerContainer: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    alignItems: "center",
  },
  headerContent: { alignItems: "center", gap: 8 },
  roundLabel: { color: Colors.text, fontSize: 20, fontFamily: "Inter_700Bold" },
  letterBadge: {
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.secondary + "60",
  },
  letterBadgeText: { color: Colors.secondary, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  content: { paddingHorizontal: 16, gap: 14 },
  winnerCard: { borderRadius: 20, overflow: "hidden" },
  winnerGrad: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.gold + "40",
    borderRadius: 20,
  },
  winnerInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  winnerName: { color: Colors.gold, fontSize: 18, fontFamily: "Inter_700Bold" },
  winnerScore: { color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_400Regular" },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
    marginBottom: -6,
  },
  rankingList: { gap: 8 },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rankRowMe: { borderColor: Colors.accent + "80" },
  rankNum: { fontSize: 18, fontFamily: "Inter_700Bold", width: 24, textAlign: "center" },
  rankName: { flex: 1, color: Colors.text, fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  rankScores: { alignItems: "flex-end" },
  rankRoundScore: { fontSize: 18, fontFamily: "Inter_700Bold" },
  rankTotalScore: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" },
  answerCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  answerCardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  answerCardName: { flex: 1, color: Colors.text, fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  answerCardTotal: { color: Colors.secondary, fontSize: 15, fontFamily: "Inter_700Bold" },
  answerList: { gap: 6 },
  answerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  answerCat: { color: Colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular", width: 60, textAlign: "right" },
  answerText: { flex: 1, color: Colors.text, fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "right" },
  answerEmpty: { color: Colors.textMuted, fontStyle: "italic" },
  answerCatLabel: { flexDirection: "row", alignItems: "center", gap: 4, width: 36 },
  answerPoints: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: "rgba(13,6,37,0.8)",
  },
  actionBtn: { borderRadius: 16, overflow: "hidden" },
  actionBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  actionBtnText: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  waitingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 14,
  },
  waitingText: { color: Colors.textMuted, fontSize: 14, fontFamily: "Inter_400Regular" },
});
