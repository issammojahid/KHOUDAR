import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Colors from "@/constants/colors";
import { PlayerAvatar } from "@/components/PlayerAvatar";

interface LeaderboardEntry {
  name: string;
  skin: string;
  score: number;
  wins: number;
  games: number;
  date: string;
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : 0;

  useFocusEffect(
    useCallback(() => {
      AsyncStorage.getItem("leaderboard").then((data) => {
        if (data) setEntries(JSON.parse(data));
        else setEntries([]);
      });
    }, [])
  );

  return (
    <LinearGradient colors={["#0D0625", "#1A0D40", "#2D1B69"]} style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset + 16 }]}>
        <Ionicons name="trophy" size={28} color={Colors.gold} />
        <Text style={styles.title}>المتصدرون</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: bottomInset + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {entries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>لا توجد بيانات بعد</Text>
            <Text style={styles.emptyText}>العب لعبة واحدة على الأقل لتظهر هنا</Text>
          </View>
        ) : (
          entries.map((entry, index) => (
            <LeaderboardRow key={index} entry={entry} rank={index} />
          ))
        )}
      </ScrollView>
    </LinearGradient>
  );
}

function LeaderboardRow({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const rankColors = [Colors.gold, Colors.silver, Colors.bronze];
  const rankColor = rank < 3 ? rankColors[rank] : Colors.textMuted;
  const isTop = rank < 3;

  return (
    <View style={[styles.row, isTop && styles.topRow]}>
      <View style={[styles.rankCircle, { borderColor: rankColor }]}>
        <Text style={[styles.rankNum, { color: rankColor }]}>{rank + 1}</Text>
      </View>
      <PlayerAvatar skinId={entry.skin} size={48} />
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{entry.name}</Text>
        <View style={styles.rowMeta}>
          <Text style={styles.rowMeta2}>{entry.games} لعبة</Text>
          <Text style={styles.rowMeta2}> • </Text>
          <Text style={styles.rowMeta2}>{entry.wins} فوز</Text>
        </View>
      </View>
      <View style={styles.scoreArea}>
        <Text style={[styles.scoreNum, { color: rankColor }]}>{entry.score}</Text>
        <Text style={styles.scoreLabel}>نقطة</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  list: { paddingHorizontal: 20, paddingTop: 8, gap: 10 },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topRow: {
    borderColor: Colors.gold + "40",
    backgroundColor: Colors.cardLight,
  },
  rankCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  rankNum: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  rowInfo: { flex: 1, gap: 2 },
  rowName: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    textAlign: "right",
  },
  rowMeta: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  rowMeta2: {
    color: Colors.textMuted,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  scoreArea: { alignItems: "center" },
  scoreNum: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
  },
  scoreLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
