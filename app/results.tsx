import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Animated,
  ActivityIndicator,
  Easing,
  Dimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePlayer } from "@/context/PlayerContext";
import { useSocket } from "@/context/SocketContext";
import { playSubmitSound } from "@/lib/sounds";
import { PlayerAvatar } from "@/components/PlayerAvatar";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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

function AnimatedScoreCounter({ target, style, duration = 1200 }: { target: number; style?: any; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const animRef = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const listenerId = animRef.addListener(({ value }) => {
      setDisplayValue(Math.round(value));
    });
    Animated.timing(animRef, {
      toValue: target,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => {
      animRef.removeAllListeners();
    };
  }, [target]);

  return <Text style={style}>{displayValue}</Text>;
}

function AnimatedRankRow({ result, rank, isMe, delay }: { result: PlayerResult; rank: number; isMe: boolean; delay: number }) {
  const slideAnim = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        delay,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        delay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const rankColors = [Colors.gold, Colors.silver, Colors.bronze];
  const rankColor = rank < 3 ? rankColors[rank] : Colors.textMuted;

  return (
    <Animated.View style={{ transform: [{ translateX: slideAnim }], opacity: opacityAnim }}>
      <View style={[styles.rankRow, isMe && styles.rankRowMe]}>
        <View style={[styles.rankBadge, rank < 3 && { backgroundColor: rankColor + "25" }]}>
          <Text style={[styles.rankNum, { color: rankColor }]}>{rank + 1}</Text>
        </View>
        <PlayerAvatar skinId={result.skin} size={40} />
        <Text style={styles.rankName}>
          {result.playerName}
          {isMe ? " " : ""}
          {isMe && <Ionicons name="checkmark-circle" size={14} color={Colors.accent} />}
        </Text>
        <View style={styles.rankScores}>
          <View style={styles.roundScoreBadge}>
            <Text style={[styles.rankRoundScorePrefix, { color: rankColor }]}>+</Text>
            <AnimatedScoreCounter target={result.roundScore} style={[styles.rankRoundScore, { color: rankColor }]} duration={800 + delay} />
          </View>
          <AnimatedScoreCounter target={result.totalScore} style={styles.rankTotalScore} duration={1000 + delay} />
        </View>
      </View>
    </Animated.View>
  );
}

function AnimatedPointPopup({ points, status }: { points: number; status: string }) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 150,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  const color = status === "correct" ? Colors.success : status === "duplicate" ? Colors.duplicate : Colors.textMuted;

  return (
    <Animated.View style={[styles.pointPopup, { transform: [{ scale: scaleAnim }], opacity: opacityAnim, backgroundColor: color + "20", borderColor: color + "40" }]}>
      <Text style={[styles.pointPopupText, { color }]}>
        +{points}
      </Text>
    </Animated.View>
  );
}

function WinnerCelebration({ playerName }: { playerName: string }) {
  const sparkles = useRef(
    Array.from({ length: 12 }, () => ({
      anim: new Animated.Value(0),
      x: Math.random() * (SCREEN_WIDTH - 80),
      delay: Math.random() * 600,
      char: ["★", "✦", "✧", "⭐", "✨", "◆"][Math.floor(Math.random() * 6)],
    }))
  ).current;

  useEffect(() => {
    sparkles.forEach((s) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(s.anim, {
            toValue: 1,
            duration: 1500 + Math.random() * 1000,
            delay: s.delay,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(s.anim, {
            toValue: 0,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={styles.celebrationContainer}>
      {sparkles.map((s, i) => (
        <Animated.Text
          key={i}
          style={[
            styles.sparkle,
            {
              left: s.x,
              top: 5 + (i % 3) * 15,
              opacity: s.anim,
              transform: [
                {
                  translateY: s.anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -20],
                  }),
                },
                {
                  scale: s.anim.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: [0.3, 1.2, 0.8],
                  }),
                },
              ],
            },
          ]}
        >
          {s.char}
        </Animated.Text>
      ))}
    </View>
  );
}

function AnswerDetail({ result, animDelay }: { result: PlayerResult; animDelay: number }) {
  const slideAnim = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        delay: animDelay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 350,
        delay: animDelay,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
    <Animated.View style={{ transform: [{ translateY: slideAnim }], opacity: opacityAnim }}>
      <View style={styles.answerCard}>
        <View style={styles.answerCardHeader}>
          <PlayerAvatar skinId={result.skin} size={36} />
          <Text style={styles.answerCardName}>{result.playerName}</Text>
          <View style={styles.answerCardScoreBadge}>
            <AnimatedScoreCounter target={result.roundScore} style={styles.answerCardTotal} duration={1000 + animDelay} />
            <Text style={styles.answerCardTotalLabel}> نقطة</Text>
          </View>
        </View>
        <View style={styles.answerList}>
          {Object.entries(result.answers).map(([cat, answer]) => (
            <View key={cat} style={styles.answerRow}>
              <AnimatedPointPopup points={answer.points} status={answer.status} />
              <View style={styles.answerCatLabel}>
                <Ionicons
                  name={statusIcon[answer.status]}
                  size={14}
                  color={statusColor[answer.status]}
                />
              </View>
              <Text style={[styles.answerText, !answer.text && styles.answerEmpty]}>
                {answer.text || "-"}
              </Text>
              <Text style={styles.answerCat}>{cat}</Text>
            </View>
          ))}
        </View>
      </View>
    </Animated.View>
  );
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

  const headerAnim = useRef(new Animated.Value(0)).current;
  const winnerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(200, [
      Animated.spring(headerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 60,
        friction: 8,
      }),
      Animated.spring(winnerAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }),
    ]).start();

    if (results.length > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      playSubmitSound();
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleGameStarted = (gameData: any) => {
      setWaitingNext(false);
      const playersList = results.map((r: PlayerResult) => ({
        id: r.playerId,
        name: r.playerName,
        skin: r.skin,
      }));
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
          players: JSON.stringify(playersList),
        },
      });
    };

    const handleGameFinished = ({ finalScores }: { finalScores: PlayerResult[] }) => {
      const myId = socket.id;
      const myResult = finalScores?.find((r: PlayerResult) => r.playerId === myId);
      const myRank = finalScores?.findIndex((r: PlayerResult) => r.playerId === myId);

      let coinsEarned = 10;
      if (myRank === 0) coinsEarned = 50;
      else if (myRank === 1) coinsEarned = 30;
      else if (myRank === 2) coinsEarned = 20;

      addCoins(coinsEarned);
      recordGame(myResult?.totalScore || 0, myRank === 0);

      router.replace({
        pathname: "/final",
        params: {
          finalScores: JSON.stringify(finalScores),
          coinsEarned: String(coinsEarned),
          roomCode,
          myPlayerId: myId || "",
        },
      });
    };

    socket.on("game_started", handleGameStarted);
    socket.on("game_finished", handleGameFinished);

    return () => {
      socket.off("game_started", handleGameStarted);
      socket.off("game_finished", handleGameFinished);
    };
  }, [socket]);

  const handleNextRound = () => {
    setWaitingNext(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    socket?.emit("next_round", { roomCode });
  };

  const handleFinishGame = () => {
    setWaitingNext(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    socket?.emit("next_round", { roomCode });
  };

  const mySocketId = socket?.id || "";
  const topPlayer = results[0];

  return (
    <LinearGradient colors={["#0D0625", "#1A0D40", "#2D1B69"]} style={styles.container}>
      <View style={styles.innerContainer}>
        <Animated.View
          style={[
            styles.header,
            { paddingTop: topInset + 12 },
            {
              opacity: headerAnim,
              transform: [
                {
                  translateY: headerAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-30, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.headerContent}>
            <Text style={styles.roundLabel}>
              نتائج الجولة {round}/{maxRounds}
            </Text>
            <View style={styles.letterBadge}>
              <Text style={styles.letterBadgeText}>حرف: {letter}</Text>
            </View>
          </View>
        </Animated.View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {topPlayer && (
            <Animated.View
              style={{
                opacity: winnerAnim,
                transform: [
                  {
                    scale: winnerAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0.8, 1.05, 1],
                    }),
                  },
                ],
              }}
            >
              <View style={styles.winnerCard}>
                <WinnerCelebration playerName={topPlayer.playerName} />
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
                      <View style={styles.winnerScoreRow}>
                        <AnimatedScoreCounter
                          target={topPlayer.roundScore}
                          style={styles.winnerScoreNum}
                          duration={1500}
                        />
                        <Text style={styles.winnerScore}> نقطة هذه الجولة</Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </View>
            </Animated.View>
          )}

          <Text style={styles.sectionTitle}>ترتيب اللاعبين</Text>
          <View style={styles.rankingList}>
            {results.map((r, i) => (
              <AnimatedRankRow
                key={r.playerId}
                result={r}
                rank={i}
                isMe={r.playerId === mySocketId || r.playerName === player.name}
                delay={300 + i * 150}
              />
            ))}
          </View>

          {results.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>تفاصيل الإجابات</Text>
              {results.map((r, i) => (
                <AnswerDetail
                  key={r.playerId}
                  result={r}
                  animDelay={600 + results.length * 150 + i * 200}
                />
              ))}
            </>
          )}
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: bottomInset + 16 }]}>
          {isLastRound && isHost ? (
            <Pressable
              onPress={handleFinishGame}
              disabled={waitingNext}
              style={({ pressed }) => [styles.actionBtn, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient
                colors={["#F5A623", "#FF6B35"]}
                style={styles.actionBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {waitingNext ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="flag" size={22} color="#fff" />
                    <Text style={styles.actionBtnText}>إنهاء اللعبة</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          ) : isLastRound && !isHost ? (
            <View style={styles.waitingBar}>
              <ActivityIndicator color={Colors.secondary} />
              <Text style={styles.waitingText}>في انتظار المضيف لإنهاء اللعبة...</Text>
            </View>
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
      </View>
    </LinearGradient>
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
  winnerCard: { borderRadius: 20, overflow: "hidden", position: "relative" },
  celebrationContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    zIndex: 10,
    pointerEvents: "none",
  },
  sparkle: {
    position: "absolute",
    fontSize: 16,
    color: Colors.gold,
  },
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
  winnerScoreRow: { flexDirection: "row", alignItems: "center" },
  winnerScoreNum: { color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_700Bold" },
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
  rankRowMe: { borderColor: Colors.accent + "80", backgroundColor: Colors.accent + "10" },
  rankBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  rankNum: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  rankName: { flex: 1, color: Colors.text, fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  rankScores: { alignItems: "flex-end" },
  roundScoreBadge: { flexDirection: "row", alignItems: "center" },
  rankRoundScorePrefix: { fontSize: 14, fontFamily: "Inter_700Bold" },
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
  answerCardScoreBadge: { flexDirection: "row", alignItems: "center" },
  answerCardTotal: { color: Colors.secondary, fontSize: 15, fontFamily: "Inter_700Bold" },
  answerCardTotalLabel: { color: Colors.secondary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  answerList: { gap: 6 },
  answerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  answerCat: { color: Colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular", width: 60, textAlign: "right" },
  answerText: { flex: 1, color: Colors.text, fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "right" },
  answerEmpty: { color: Colors.textMuted, fontStyle: "italic" },
  answerCatLabel: { flexDirection: "row", alignItems: "center", gap: 4 },
  pointPopup: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 30,
    alignItems: "center",
  },
  pointPopupText: { fontSize: 12, fontFamily: "Inter_700Bold" },
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
