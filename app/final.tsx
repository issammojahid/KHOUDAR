import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Animated,
  Dimensions,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePlayer } from "@/context/PlayerContext";
import { playWinSound, playLoseSound } from "@/lib/sounds";
import { PlayerAvatar } from "@/components/PlayerAvatar";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CONFETTI_COUNT = 24;

interface PlayerResult {
  playerId: string;
  playerName: string;
  skin: string;
  roundScore: number;
  totalScore: number;
}

function getRankMessage(rank: number): string {
  switch (rank) {
    case 0: return "مبروك! أنت البطل!";
    case 1: return "أداء رائع!";
    case 2: return "جيد جداً!";
    default: return "حظ أوفر!";
  }
}

function ConfettiParticle({ delay, isWinner }: { delay: number; isWinner: boolean }) {
  const translateY = useRef(new Animated.Value(-60)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0)).current;

  const startX = Math.random() * SCREEN_WIDTH;
  const drift = (Math.random() - 0.5) * 120;
  const duration = 2800 + Math.random() * 1500;
  const size = 14 + Math.random() * 14;
  const particleColors = isWinner
    ? ["#FFD700", "#FF6B35", "#4ECDC4", "#F5A623", "#FFE066", "#FFF"]
    : ["#C0C0C0", "#8899AA", "#667788", "#AABBCC"];
  const color = particleColors[Math.floor(Math.random() * particleColors.length)];
  const symbols = isWinner ? ["★", "✦", "◆", "●", "✧"] : ["●", "◆", "✧"];
  const symbol = symbols[Math.floor(Math.random() * symbols.length)];

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(translateY, { toValue: SCREEN_HEIGHT + 60, duration, useNativeDriver: true }),
            Animated.timing(translateX, { toValue: drift, duration, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
              Animated.timing(opacity, { toValue: 1, duration: duration - 600, useNativeDriver: true }),
              Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
            ]),
            Animated.timing(rotate, { toValue: 1, duration, useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
              Animated.timing(scale, { toValue: 1, duration: duration - 200, useNativeDriver: true }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(translateY, { toValue: -60, duration: 0, useNativeDriver: true }),
            Animated.timing(translateX, { toValue: 0, duration: 0, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 0, useNativeDriver: true }),
            Animated.timing(rotate, { toValue: 0, duration: 0, useNativeDriver: true }),
            Animated.timing(scale, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        ])
      ).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "720deg"] });

  return (
    <Animated.Text
      style={{
        position: "absolute",
        left: startX,
        top: 0,
        fontSize: size,
        color,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate: spin }, { scale }],
      }}
      pointerEvents="none"
    >
      {symbol}
    </Animated.Text>
  );
}

function AnimatedCoinCounter({ target }: { target: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 5 }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ])
    ).start();

    let current = 0;
    const step = Math.max(1, Math.floor(target / 30));
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(interval);
        if (Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      }
      setDisplayValue(current);
    }, 40);
    return () => clearInterval(interval);
  }, [target]);

  return (
    <Animated.View style={[styles.coinsEarned, { transform: [{ scale: scaleAnim }] }]}>
      <Animated.View style={{ opacity: glowAnim }}>
        <MaterialCommunityIcons name="star-four-points" size={26} color={Colors.gold} />
      </Animated.View>
      <Text style={styles.coinsEarnedText}>+{displayValue}</Text>
      <Ionicons name="star" size={18} color={Colors.gold} />
    </Animated.View>
  );
}

function AnimatedPodiumSpot({ player, rank, delay }: { player: PlayerResult; rank: number; delay: number }) {
  const podiumHeights = [110, 85, 68];
  const rankColors = [Colors.gold, Colors.silver, Colors.bronze];
  const color = rankColors[rank];

  const heightAnim = useRef(new Animated.Value(0)).current;
  const avatarScale = useRef(new Animated.Value(0)).current;
  const scoreOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.sequence([
        Animated.spring(avatarScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 7 }),
        Animated.parallel([
          Animated.spring(heightAnim, { toValue: 1, useNativeDriver: false, tension: 40, friction: 8 }),
          Animated.timing(scoreOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
      ]).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  const animatedHeight = heightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, podiumHeights[rank]],
  });

  return (
    <View style={styles.podiumSpot}>
      <Animated.View style={{ transform: [{ scale: avatarScale }] }}>
        <PlayerAvatar skinId={player.skin} size={rank === 0 ? 52 : 44} showName name={player.playerName} />
      </Animated.View>
      <Animated.Text style={[styles.podiumScore, { color, opacity: scoreOpacity }]}>
        {player.totalScore}
      </Animated.Text>
      <Animated.View
        style={[
          styles.podiumBlock,
          {
            height: animatedHeight,
            backgroundColor: color + "30",
            borderColor: color + "60",
          },
        ]}
      >
        <Text style={[styles.podiumRank, { color }]}>{rank + 1}</Text>
      </Animated.View>
    </View>
  );
}

function AnimatedRankRow({ r, i, delay }: { r: PlayerResult; i: number; delay: number }) {
  const slideAnim = useRef(new Animated.Value(80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const rankColors = [Colors.gold, Colors.silver, Colors.bronze];

  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 50, friction: 9 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
    }, delay);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <Animated.View
      style={[
        styles.rankRow,
        i < 3 && { borderColor: rankColors[i] + "40" },
        { transform: [{ translateX: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <Text style={[styles.rankNum, { color: i < 3 ? rankColors[i] : Colors.textMuted }]}>
        {i + 1}
      </Text>
      <PlayerAvatar skinId={r.skin} size={40} />
      <Text style={styles.rankName}>{r.playerName}</Text>
      <Text style={[styles.rankScore, { color: i < 3 ? rankColors[i] : Colors.text }]}>
        {r.totalScore}
      </Text>
    </Animated.View>
  );
}

export default function FinalScreen() {
  const insets = useSafeAreaInsets();
  const { player } = usePlayer();
  const params = useLocalSearchParams();

  let finalScores: PlayerResult[] = [];
  try {
    finalScores = JSON.parse((params.finalScores as string) || "[]");
  } catch {
    finalScores = [];
  }
  const coinsEarned = parseInt((params.coinsEarned as string) || "10");

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const bounceAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const messageAnim = useRef(new Animated.Value(0)).current;
  const shareAnim = useRef(new Animated.Value(0)).current;

  const myRank = finalScores.findIndex(
    (r) => r.playerName === player.name || r.playerId === (params.myPlayerId as string)
  );
  const isWinner = myRank === 0;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (isWinner) {
      playWinSound();
    } else {
      playLoseSound();
    }
    Animated.spring(bounceAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 40,
      friction: 6,
    }).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(rotateAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();
    Animated.sequence([
      Animated.delay(600),
      Animated.spring(messageAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 6 }),
    ]).start();
    Animated.sequence([
      Animated.delay(1800),
      Animated.spring(shareAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
    ]).start();
  }, []);

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["-5deg", "5deg"] });

  const rankMessage = getRankMessage(myRank);
  const rankLabel = myRank >= 0 ? `#${myRank + 1}` : "";

  return (
    <LinearGradient colors={["#0D0625", "#0D1A50", "#0D2580"]} style={styles.container}>
      {(isWinner || myRank <= 2) && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
            <ConfettiParticle key={i} delay={i * 120} isWinner={isWinner} />
          ))}
        </View>
      )}

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 20, paddingBottom: bottomInset + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.trophySection,
            { transform: [{ scale: bounceAnim }, { rotate: spin }] },
          ]}
        >
          <Ionicons
            name={isWinner ? "trophy" : myRank <= 2 ? "medal" : "game-controller"}
            size={80}
            color={isWinner ? Colors.gold : myRank === 1 ? Colors.silver : myRank === 2 ? Colors.bronze : Colors.accent}
          />
        </Animated.View>

        <Text style={styles.gameOverTitle}>انتهت اللعبة!</Text>

        <Animated.View
          style={[
            styles.rankMessageContainer,
            {
              transform: [{ scale: messageAnim }],
              opacity: messageAnim,
              backgroundColor: isWinner ? Colors.gold + "20" : Colors.card,
              borderColor: isWinner ? Colors.gold + "50" : Colors.border,
            },
          ]}
        >
          {isWinner && <Ionicons name="trophy" size={20} color={Colors.gold} />}
          <Text
            style={[
              styles.rankMessageText,
              { color: isWinner ? Colors.gold : myRank <= 2 ? Colors.accent : Colors.textSecondary },
            ]}
          >
            {rankMessage}
          </Text>
        </Animated.View>

        <AnimatedCoinCounter target={coinsEarned} />

        <View style={styles.podium}>
          {finalScores.length > 1 && (
            <AnimatedPodiumSpot player={finalScores[1]} rank={1} delay={400} />
          )}
          {finalScores.length > 0 && (
            <AnimatedPodiumSpot player={finalScores[0]} rank={0} delay={200} />
          )}
          {finalScores.length > 2 && (
            <AnimatedPodiumSpot player={finalScores[2]} rank={2} delay={600} />
          )}
        </View>

        <Text style={styles.allRankingsTitle}>الترتيب النهائي</Text>
        <View style={styles.rankingsList}>
          {finalScores.map((r, i) => (
            <AnimatedRankRow key={r.playerId} r={r} i={i} delay={800 + i * 150} />
          ))}
        </View>

        {myRank >= 0 && (
          <Animated.View
            style={[
              styles.shareSection,
              { transform: [{ scale: shareAnim }], opacity: shareAnim },
            ]}
          >
            <View style={styles.shareCard}>
              <Text style={styles.shareRank}>{rankLabel}</Text>
              <Text style={styles.shareLabel}>ترتيبي في اللعبة</Text>
              <View style={styles.shareDivider} />
              <Text style={styles.shareScore}>
                {finalScores[myRank]?.totalScore ?? 0} نقطة
              </Text>
            </View>
          </Animated.View>
        )}

        <Pressable
          onPress={() => router.replace("/(tabs)")}
          style={({ pressed }) => [styles.homeBtn, pressed && { opacity: 0.85 }]}
        >
          <LinearGradient
            colors={["#F5A623", "#FF6B35"]}
            style={styles.homeBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="home" size={22} color="#fff" />
            <Text style={styles.homeBtnText}>العودة للرئيسية</Text>
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={() => router.replace("/lobby")}
          style={({ pressed }) => [styles.replayBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.replayBtnText}>لعب مرة أخرى</Text>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, alignItems: "center", gap: 20 },
  trophySection: { alignItems: "center" },
  gameOverTitle: {
    color: Colors.text,
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  rankMessageContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  rankMessageText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  coinsEarned: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.gold + "40",
  },
  coinsEarnedText: { color: Colors.gold, fontSize: 24, fontFamily: "Inter_700Bold" },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingHorizontal: 8,
    marginTop: 10,
  },
  podiumSpot: { flex: 1, alignItems: "center", gap: 6 },
  podiumScore: { fontSize: 16, fontFamily: "Inter_700Bold" },
  podiumBlock: {
    width: "100%",
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  podiumRank: { fontSize: 24, fontFamily: "Inter_700Bold" },
  allRankingsTitle: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    alignSelf: "flex-end",
  },
  rankingsList: { width: "100%", gap: 8 },
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
  rankNum: { fontSize: 18, fontFamily: "Inter_700Bold", width: 24, textAlign: "center" },
  rankName: { flex: 1, color: Colors.text, fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  rankScore: { fontSize: 20, fontFamily: "Inter_700Bold" },
  shareSection: { width: "100%", alignItems: "center" },
  shareCard: {
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 18,
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
    width: "100%",
  },
  shareRank: { fontSize: 40, fontFamily: "Inter_700Bold", color: Colors.gold },
  shareLabel: { fontSize: 14, color: Colors.textSecondary, fontFamily: "Inter_600SemiBold" },
  shareDivider: { width: 40, height: 2, backgroundColor: Colors.border, marginVertical: 8, borderRadius: 1 },
  shareScore: { fontSize: 18, color: Colors.text, fontFamily: "Inter_700Bold" },
  homeBtn: { borderRadius: 16, overflow: "hidden", width: "100%" },
  homeBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  homeBtnText: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  replayBtn: { paddingVertical: 12 },
  replayBtnText: { color: Colors.accent, fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
