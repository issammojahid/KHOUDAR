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
  Modal,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePlayer } from "@/context/PlayerContext";
import { PlayerAvatar } from "@/components/PlayerAvatar";

const { width } = Dimensions.get("window");

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { player, claimTrialReward, isLoaded } = usePlayer();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const [showTrialReward, setShowTrialReward] = useState(false);

  useEffect(() => {
    if (isLoaded && !player.claimedTrialReward) {
      const timer = setTimeout(() => setShowTrialReward(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isLoaded, player.claimedTrialReward]);

  const handleClaimReward = () => {
    claimTrialReward();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowTrialReward(false);
  };

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 1500, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const handlePlay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!player.name) {
      router.push("/settings");
    } else {
      router.push("/lobby");
    }
  };

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : 0;

  return (
    <LinearGradient colors={["#0D0625", "#1A0D40", "#2D1B69"]} style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: topInset + 16, paddingBottom: bottomInset + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.playerInfo}>
            <PlayerAvatar skinId={player.currentSkin} size={52} />
            <View style={styles.playerText}>
              <Text style={styles.playerName}>{player.name || "مجهول"}</Text>
              <View style={styles.coinsRow}>
                <Ionicons name="star" size={14} color={Colors.gold} />
                <Text style={styles.coinsText}>{player.coins}</Text>
              </View>
            </View>
          </View>
          <View style={styles.statsRow}>
            <StatPill icon="trophy" value={player.totalWins} label="فوز" />
            <StatPill icon="game-controller" value={player.totalGames} label="لعبة" />
          </View>
        </View>

        <Animated.View style={[styles.heroSection, { transform: [{ translateY: floatAnim }] }]}>
          <View style={styles.letterCircle}>
            <LinearGradient
              colors={["#F5A623", "#FF6B35"]}
              style={styles.letterGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.heroLetter}>ح</Text>
            </LinearGradient>
          </View>
          <View style={styles.sparkle1}>
            <Ionicons name="sparkles" size={20} color={Colors.gold} />
          </View>
          <View style={styles.sparkle2}>
            <MaterialCommunityIcons name="star-four-points" size={16} color={Colors.accent} />
          </View>
          <View style={styles.sparkle3}>
            <Ionicons name="sparkles" size={14} color="#FF6B35" />
          </View>
        </Animated.View>

        <Text style={styles.gameTitle}>حروف المغرب</Text>
        <Text style={styles.gameSubtitle}>تحدي الكلمات العربية</Text>

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Pressable
            onPress={handlePlay}
            style={({ pressed }) => [styles.playButton, pressed && styles.playButtonPressed]}
          >
            <LinearGradient
              colors={["#F5A623", "#FF6B35"]}
              style={styles.playGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="play" size={28} color="#fff" />
              <Text style={styles.playText}>العب الآن</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>الفئات</Text>
          <View style={styles.categoriesGrid}>
            {CATEGORY_ICONS.map((cat, i) => (
              <CategoryPill key={i} icon={cat.icon} name={cat.name} color={cat.color} />
            ))}
          </View>
        </View>

        <View style={styles.rulesCard}>
          <Text style={styles.rulesTitle}>قواعد اللعبة</Text>
          <RuleRow icon="checkmark-circle" color={Colors.success} text="إجابة صحيحة = 3 نقاط" />
          <RuleRow icon="copy" color={Colors.duplicate} text="إجابة مكررة = 0 نقاط" />
          <RuleRow icon="close-circle" color={Colors.error} text="إجابة فارغة = 0 نقاط" />
          <RuleRow icon="time" color={Colors.accent} text="120 ثانية لكل جولة" />
          <RuleRow icon="people" color={Colors.primary} text="من 2 إلى 8 لاعبين" />
        </View>
      </ScrollView>

      <Modal
        visible={showTrialReward}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <View style={styles.rewardOverlay}>
          <View style={styles.rewardCard}>
            <View style={styles.rewardIconCircle}>
              <Ionicons name="gift" size={48} color="#F5A623" />
            </View>
            <Text style={styles.rewardTitle}>مكافأة ترحيبية!</Text>
            <Text style={styles.rewardDesc}>مرحباً بك في حروف المغرب</Text>
            <View style={styles.rewardCoinsRow}>
              <Ionicons name="star" size={24} color={Colors.gold} />
              <Text style={styles.rewardCoinsText}>200 قطعة نقدية</Text>
            </View>
            <Pressable
              onPress={handleClaimReward}
              style={({ pressed }) => [styles.rewardClaimBtn, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient
                colors={["#F5A623", "#FF6B35"]}
                style={styles.rewardClaimGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.rewardClaimText}>استلم المكافأة</Text>
              </LinearGradient>
            </Pressable>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

function StatPill({ icon, value, label }: { icon: any; value: number; label: string }) {
  return (
    <View style={styles.statPill}>
      <Ionicons name={icon} size={14} color={Colors.secondary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function CategoryPill({ icon, name, color }: { icon: any; name: string; color: string }) {
  return (
    <View style={[styles.catPill, { borderColor: color + "60" }]}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={styles.catName}>{name}</Text>
    </View>
  );
}

function RuleRow({ icon, color, text }: { icon: any; color: string; text: string }) {
  return (
    <View style={styles.ruleRow}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.ruleText}>{text}</Text>
    </View>
  );
}

const CATEGORY_ICONS = [
  { name: "اسم بنت", icon: "rose-outline" as const, color: "#FF69B4" },
  { name: "اسم ولد", icon: "person-outline" as const, color: "#4ECDC4" },
  { name: "حيوان", icon: "paw-outline" as const, color: "#27AE60" },
  { name: "فاكهة", icon: "nutrition-outline" as const, color: "#FF6B35" },
  { name: "خضار", icon: "leaf-outline" as const, color: "#2ECC71" },
  { name: "جماد", icon: "cube-outline" as const, color: "#9B59B6" },
  { name: "مدينة", icon: "business-outline" as const, color: "#3498DB" },
  { name: "دولة", icon: "earth-outline" as const, color: "#E74C3C" },
];

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  playerInfo: { flexDirection: "row", alignItems: "center", gap: 12 },
  playerText: { gap: 2 },
  playerName: {
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  coinsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  coinsText: { color: Colors.gold, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 8 },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.card,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: { color: Colors.text, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  statLabel: { color: Colors.textSecondary, fontSize: 11, fontFamily: "Inter_400Regular" },
  heroSection: {
    alignItems: "center",
    marginVertical: 24,
    position: "relative",
  },
  letterCircle: {
    width: 130,
    height: 130,
    borderRadius: 65,
    overflow: "hidden",
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },
  letterGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroLetter: {
    fontSize: 64,
    color: "#fff",
    fontFamily: "Inter_700Bold",
    lineHeight: 80,
  },
  sparkle1: { position: "absolute", top: -8, right: 20 },
  sparkle2: { position: "absolute", bottom: 5, left: 15 },
  sparkle3: { position: "absolute", top: 10, left: 10 },
  gameTitle: {
    fontSize: 32,
    color: Colors.text,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 6,
  },
  gameSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
    marginBottom: 32,
  },
  playButton: { marginBottom: 32, borderRadius: 24, overflow: "hidden" },
  playButtonPressed: { opacity: 0.85 },
  playGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    paddingHorizontal: 56,
    gap: 10,
  },
  playText: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: 1,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    marginBottom: 12,
    textAlign: "right",
  },
  categoriesSection: { marginBottom: 24 },
  categoriesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  catName: { color: Colors.text, fontSize: 13, fontFamily: "Inter_500Medium" },
  rulesCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rulesTitle: {
    color: Colors.secondary,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  ruleRow: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "flex-end" },
  ruleText: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
    textAlign: "right",
  },
  rewardOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  rewardCard: {
    backgroundColor: "#1A0D40",
    borderRadius: 28,
    padding: 32,
    alignItems: "center",
    gap: 14,
    borderWidth: 2,
    borderColor: "#F5A623",
    width: "100%",
    maxWidth: 340,
  },
  rewardIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(245,166,35,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  rewardTitle: { color: Colors.gold, fontSize: 26, fontFamily: "Inter_700Bold" },
  rewardDesc: { color: Colors.textSecondary, fontSize: 15, fontFamily: "Inter_400Regular", textAlign: "center" },
  rewardCoinsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 4 },
  rewardCoinsText: { color: Colors.gold, fontSize: 22, fontFamily: "Inter_700Bold" },
  rewardClaimBtn: { borderRadius: 16, overflow: "hidden", width: "100%", marginTop: 8 },
  rewardClaimGrad: { alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  rewardClaimText: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
});
