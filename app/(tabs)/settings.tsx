import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePlayer } from "@/context/PlayerContext";
import { PlayerAvatar } from "@/components/PlayerAvatar";

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { player, setName, addCoins } = usePlayer();
  const [nameInput, setNameInput] = useState(player.name);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : 0;

  const saveName = () => {
    if (nameInput.trim().length < 2) {
      Alert.alert("اسم قصير", "يجب أن يكون الاسم حرفين على الأقل");
      return;
    }
    setName(nameInput.trim());
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("تم الحفظ", "تم حفظ اسمك بنجاح");
  };

  return (
    <LinearGradient colors={["#0D0625", "#1A0D40", "#2D1B69"]} style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset + 16 }]}>
        <Ionicons name="settings" size={28} color={Colors.accent} />
        <Text style={styles.title}>الإعدادات</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: bottomInset + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <PlayerAvatar skinId={player.currentSkin} size={80} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{player.name || "لم يتم تعيين اسم"}</Text>
            <View style={styles.coinsRow}>
              <Ionicons name="star" size={16} color={Colors.gold} />
              <Text style={styles.coinsText}>{player.coins} عملة</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>تغيير الاسم</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder="أدخل اسمك"
              placeholderTextColor={Colors.textMuted}
              maxLength={20}
              textAlign="right"
            />
            <Pressable
              onPress={saveName}
              style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.8 }]}
            >
              <LinearGradient
                colors={["#4ECDC4", "#2ECC71"]}
                style={styles.saveBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="checkmark" size={20} color="#fff" />
              </LinearGradient>
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>إحصائياتك</Text>
          <View style={styles.statsGrid}>
            <StatCard icon="trophy" label="انتصارات" value={player.totalWins} color={Colors.gold} />
            <StatCard icon="game-controller" label="الألعاب" value={player.totalGames} color={Colors.accent} />
            <StatCard icon="star" label="أعلى نقاط" value={player.bestScore} color={Colors.secondary} />
            <StatCard icon="wallet" label="العملات" value={player.coins} color={Colors.success} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>معلومات اللعبة</Text>
          <InfoRow icon="people" text="من 2 إلى 8 لاعبين في كل غرفة" />
          <InfoRow icon="time" text="120 ثانية لكل جولة" />
          <InfoRow icon="ribbon" text="3 جولات في كل لعبة" />
          <InfoRow icon="checkmark-done" text="إجابة صحيحة = 3 نقاط" />
          <InfoRow icon="copy" text="إجابة مكررة = 0 نقاط" />
        </View>

        <Pressable
          onPress={() => {
            Alert.alert("ملاحظة", "ستحصل على 100 عملة للتجربة", [
              { text: "رائع!", onPress: () => addCoins(100) },
            ]);
          }}
          style={({ pressed }) => [styles.bonusBtn, pressed && { opacity: 0.8 }]}
        >
          <LinearGradient
            colors={["#F5A623", "#FF6B35"]}
            style={styles.bonusBtnGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="gift" size={20} color="#fff" />
            <Text style={styles.bonusBtnText}>احصل على مكافأة تجريبية</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </LinearGradient>
  );
}

function StatCard({ icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <View style={[styles.statCard, { borderColor: color + "40" }]}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.accent} />
      <Text style={styles.infoText}>{text}</Text>
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
  title: { color: Colors.text, fontSize: 26, fontFamily: "Inter_700Bold" },
  content: { paddingHorizontal: 20, gap: 20 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { color: Colors.text, fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "right" },
  coinsRow: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "flex-end" },
  coinsText: { color: Colors.gold, fontSize: 16, fontFamily: "Inter_600SemiBold" },
  section: {
    backgroundColor: Colors.card,
    borderRadius: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    color: Colors.secondary,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    textAlign: "right",
    marginBottom: 4,
  },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveBtn: { borderRadius: 14, overflow: "hidden" },
  saveBtnGrad: { padding: 14, alignItems: "center", justifyContent: "center" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: Colors.background,
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
  },
  statValue: { fontSize: 24, fontFamily: "Inter_700Bold" },
  statLabel: { color: Colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "flex-end" },
  infoText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    flex: 1,
    textAlign: "right",
  },
  bonusBtn: { borderRadius: 16, overflow: "hidden" },
  bonusBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  bonusBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
});
