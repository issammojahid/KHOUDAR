import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Animated,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePlayer } from "@/context/PlayerContext";
import { PlayerAvatar } from "@/components/PlayerAvatar";

interface PlayerResult {
  playerId: string;
  playerName: string;
  skin: string;
  roundScore: number;
  totalScore: number;
}

export default function FinalScreen() {
  const insets = useSafeAreaInsets();
  const { player } = usePlayer();
  const params = useLocalSearchParams();

  const finalScores: PlayerResult[] = JSON.parse((params.finalScores as string) || "[]");
  const coinsEarned = parseInt((params.coinsEarned as string) || "10");

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const bounceAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
  }, []);

  const winner = finalScores[0];
  const myRank = finalScores.findIndex((r) => r.playerName === player.name);
  const isWinner = myRank === 0;

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["-5deg", "5deg"] });

  const rankColors = [Colors.gold, Colors.silver, Colors.bronze];

  return (
    <LinearGradient colors={["#0D0625", "#0D1A50", "#0D2580"]} style={styles.container}>
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
          <Text style={styles.trophyEmoji}>
            {isWinner ? "🏆" : "🎮"}
          </Text>
        </Animated.View>

        <Text style={styles.gameOverTitle}>انتهت اللعبة!</Text>

        {isWinner && (
          <View style={styles.winnerAnnounce}>
            <Ionicons name="trophy" size={20} color={Colors.gold} />
            <Text style={styles.winnerAnnounceText}>مبروك! أنت الفائز!</Text>
          </View>
        )}

        <View style={styles.coinsEarned}>
          <Ionicons name="star" size={22} color={Colors.gold} />
          <Text style={styles.coinsEarnedText}>ربحت {coinsEarned} عملة!</Text>
        </View>

        <View style={styles.podium}>
          {finalScores.slice(0, 3).map((player, i) => (
            <PodiumSpot key={player.playerId} player={player} rank={i} />
          ))}
        </View>

        <Text style={styles.allRankingsTitle}>الترتيب النهائي</Text>
        <View style={styles.rankingsList}>
          {finalScores.map((r, i) => (
            <View
              key={r.playerId}
              style={[
                styles.rankRow,
                i < 3 && { borderColor: rankColors[i] + "40" },
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
            </View>
          ))}
        </View>

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

function PodiumSpot({ player, rank }: { player: PlayerResult; rank: number }) {
  const podiumHeights = [100, 80, 65];
  const rankColors = [Colors.gold, Colors.silver, Colors.bronze];
  const color = rankColors[rank];

  return (
    <View style={styles.podiumSpot}>
      <PlayerAvatar skinId={player.skin} size={44} showName name={player.playerName} />
      <Text style={[styles.podiumScore, { color }]}>{player.totalScore}</Text>
      <View style={[styles.podiumBlock, { height: podiumHeights[rank], backgroundColor: color + "30", borderColor: color + "60" }]}>
        <Text style={[styles.podiumRank, { color }]}>{rank + 1}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, alignItems: "center", gap: 20 },
  trophySection: { alignItems: "center" },
  trophyEmoji: { fontSize: 80 },
  gameOverTitle: {
    color: Colors.text,
    fontSize: 32,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  winnerAnnounce: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.gold + "20",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.gold + "40",
  },
  winnerAnnounceText: { color: Colors.gold, fontSize: 18, fontFamily: "Inter_700Bold" },
  coinsEarned: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.card,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.gold + "40",
  },
  coinsEarnedText: { color: Colors.gold, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  podium: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingHorizontal: 8,
  },
  podiumSpot: { flex: 1, alignItems: "center", gap: 6 },
  podiumScore: { fontSize: 16, fontFamily: "Inter_700Bold" },
  podiumBlock: {
    width: "100%",
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
