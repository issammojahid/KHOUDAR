import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePlayer, SKINS } from "@/context/PlayerContext";
import { PlayerAvatar } from "@/components/PlayerAvatar";

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const { player, buySkin, setSkin } = usePlayer();

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : 0;

  const handleSkin = (skinId: string, price: number) => {
    const owned = player.ownedSkins.includes(skinId);
    if (owned) {
      setSkin(skinId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    }
    if (player.coins < price) {
      Alert.alert("عملات غير كافية", `تحتاج ${price} عملة للشراء`);
      return;
    }
    Alert.alert("شراء الشخصية", `هل تريد شراء هذه الشخصية بـ ${price} عملة؟`, [
      { text: "إلغاء", style: "cancel" },
      {
        text: "شراء",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          buySkin(skinId);
        },
      },
    ]);
  };

  return (
    <LinearGradient colors={["#0D0625", "#1A0D40", "#2D1B69"]} style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset + 16 }]}>
        <Ionicons name="bag" size={28} color={Colors.secondary} />
        <Text style={styles.title}>المتجر</Text>
      </View>

      <View style={styles.coinsBar}>
        <Ionicons name="star" size={18} color={Colors.gold} />
        <Text style={styles.coinsText}>{player.coins} عملة</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.grid,
          { paddingBottom: bottomInset + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>اختر شخصيتك</Text>
        <View style={styles.skinGrid}>
          {SKINS.map((skin) => {
            const owned = player.ownedSkins.includes(skin.id);
            const active = player.currentSkin === skin.id;
            return (
              <SkinCard
                key={skin.id}
                skin={skin}
                owned={owned}
                active={active}
                canAfford={player.coins >= skin.price}
                onPress={() => handleSkin(skin.id, skin.price)}
              />
            );
          })}
        </View>

        <View style={styles.howToEarnCard}>
          <Text style={styles.earnTitle}>كيف تكسب العملات؟</Text>
          <EarnRow icon="trophy" color={Colors.gold} text="المركز الأول: +50 عملة" />
          <EarnRow icon="medal" color={Colors.silver} text="المركز الثاني: +30 عملة" />
          <EarnRow icon="star" color={Colors.bronze} text="المركز الثالث: +20 عملة" />
          <EarnRow icon="checkmark-circle" color={Colors.accent} text="المشاركة: +10 عملات" />
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function SkinCard({
  skin,
  owned,
  active,
  canAfford,
  onPress,
}: {
  skin: (typeof SKINS)[0];
  owned: boolean;
  active: boolean;
  canAfford: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.skinCard,
        active && styles.skinCardActive,
        pressed && styles.skinCardPressed,
      ]}
    >
      {active && (
        <View style={styles.activeBadge}>
          <Ionicons name="checkmark" size={12} color="#fff" />
        </View>
      )}
      <PlayerAvatar skinId={skin.id} size={64} />
      <Text style={styles.skinName}>{skin.name}</Text>
      {owned ? (
        <View style={[styles.skinStatus, active ? styles.skinStatusActive : styles.skinStatusOwned]}>
          <Text style={styles.skinStatusText}>{active ? "مفعّل" : "مملوك"}</Text>
        </View>
      ) : (
        <View style={[styles.skinPrice, !canAfford && styles.skinPriceLocked]}>
          <Ionicons name="star" size={12} color={canAfford ? Colors.gold : Colors.textMuted} />
          <Text style={[styles.skinPriceText, !canAfford && styles.skinPriceMuted]}>
            {skin.price}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function EarnRow({ icon, color, text }: { icon: any; color: string; text: string }) {
  return (
    <View style={styles.earnRow}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.earnText}>{text}</Text>
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
    paddingBottom: 8,
  },
  title: { color: Colors.text, fontSize: 26, fontFamily: "Inter_700Bold" },
  coinsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.gold + "40",
    marginBottom: 16,
  },
  coinsText: { color: Colors.gold, fontSize: 18, fontFamily: "Inter_700Bold" },
  grid: { paddingHorizontal: 20, gap: 16 },
  sectionLabel: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "right",
    marginBottom: -8,
  },
  skinGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "space-between",
  },
  skinCard: {
    width: "47%",
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 16,
    alignItems: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  skinCardActive: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.cardLight,
  },
  skinCardPressed: { opacity: 0.8 },
  activeBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  skinName: { color: Colors.text, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  skinStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: Colors.border,
  },
  skinStatusActive: { backgroundColor: Colors.secondary + "40" },
  skinStatusOwned: { backgroundColor: Colors.accent + "30" },
  skinStatusText: { color: Colors.text, fontSize: 12, fontFamily: "Inter_500Medium" },
  skinPrice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.gold + "20",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  skinPriceLocked: { backgroundColor: Colors.border },
  skinPriceText: { color: Colors.gold, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  skinPriceMuted: { color: Colors.textMuted },
  howToEarnCard: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
  },
  earnTitle: {
    color: Colors.secondary,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  earnRow: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "flex-end" },
  earnText: {
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
    textAlign: "right",
  },
});
