import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  Platform,
  ActivityIndicator,
  Switch,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePlayer } from "@/context/PlayerContext";
import { useSocket } from "@/context/SocketContext";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { Difficulty } from "@/context/PlayerContext";

interface RoomPlayer {
  id: string;
  name: string;
  skin: string;
  totalScore: number;
  ready: boolean;
  isAI?: boolean;
}

interface Room {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  status: string;
  currentLetter: string;
  round: number;
  maxRounds: number;
  timeLimit: number;
  difficulty: Difficulty;
  hasAI: boolean;
}

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; color: string; icon: any; desc: string }> = {
  easy:   { label: "سهل",   color: "#27AE60", icon: "leaf-outline",   desc: "150 ثانية" },
  normal: { label: "عادي",  color: "#F5A623", icon: "flash-outline",  desc: "120 ثانية" },
  hard:   { label: "صعب",   color: "#E74C3C", icon: "flame-outline",  desc: "90 ثانية"  },
};

export default function LobbyScreen() {
  const insets = useSafeAreaInsets();
  const { player, setDifficulty } = usePlayer();
  const { socket, isConnected } = useSocket();

  const [mode, setMode] = useState<"menu" | "join" | "room" | "matchmaking">("menu");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>(player.difficulty || "normal");
  const [withAI, setWithAI] = useState(false);
  const socketIdRef = useRef<string>("");
  const [searchDots, setSearchDots] = useState("");

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (!socket) return;
    if (socket.id) socketIdRef.current = socket.id;

    const onConnect = () => { socketIdRef.current = socket.id || ""; };
    socket.on("connect", onConnect);

    const onRoomCreated = ({ room: r }: any) => {
      setRoom(r);
      setMode("room");
      setIsLoading(false);
    };

    const onRoomJoined = ({ room: r }: any) => {
      setRoom(r);
      setMode("room");
      setIsLoading(false);
    };

    const onRoomUpdated = ({ room: r }: any) => setRoom(r);

    const onGameStarted = (gameData: any) => {
      router.replace({
        pathname: "/game",
        params: {
          roomCode: room?.code || gameData.roomCode || "",
          letter: gameData.letter,
          categories: JSON.stringify(gameData.categories),
          timeLimit: String(gameData.timeLimit),
          round: String(gameData.round),
          maxRounds: String(gameData.maxRounds),
          difficulty: gameData.difficulty || "normal",
          hostId: gameData.hostId || "",
        },
      });
    };

    const onMatchFound = ({ room: r }: any) => {
      setRoom(r);
      setMode("room");
      setIsLoading(false);
    };

    const onMatchStatus = ({ status }: any) => {
      if (status === "cancelled" && !room) {
        setMode("menu");
        setIsLoading(false);
      }
    };

    const onError = ({ message }: any) => {
      setIsLoading(false);
      Alert.alert("خطأ", message);
    };

    socket.on("room_created", onRoomCreated);
    socket.on("room_joined", onRoomJoined);
    socket.on("room_updated", onRoomUpdated);
    socket.on("game_started", onGameStarted);
    socket.on("match_found", onMatchFound);
    socket.on("matchmaking_status", onMatchStatus);
    socket.on("error", onError);

    return () => {
      socket.off("connect", onConnect);
      socket.off("room_created", onRoomCreated);
      socket.off("room_joined", onRoomJoined);
      socket.off("room_updated", onRoomUpdated);
      socket.off("game_started", onGameStarted);
      socket.off("match_found", onMatchFound);
      socket.off("matchmaking_status", onMatchStatus);
      socket.off("error", onError);
    };
  }, [socket, room?.code]);

  const handleCreateRoom = () => {
    if (!player.name) {
      Alert.alert("تحتاج اسم", "يرجى تعيين اسمك في الإعدادات أولاً");
      router.push("/(tabs)/settings");
      return;
    }
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDifficulty(selectedDifficulty);
    socket?.emit("create_room", {
      playerName: player.name,
      playerSkin: player.currentSkin,
      difficulty: selectedDifficulty,
      withAI,
    });
  };

  const handleJoinRoom = () => {
    if (!player.name) {
      Alert.alert("تحتاج اسم", "يرجى تعيين اسمك في الإعدادات أولاً");
      return;
    }
    if (joinCode.trim().length !== 4) {
      Alert.alert("كود خاطئ", "يجب أن يكون الكود 4 أحرف");
      return;
    }
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    socket?.emit("join_room", {
      roomCode: joinCode.trim().toUpperCase(),
      playerName: player.name,
      playerSkin: player.currentSkin,
    });
  };

  const handleStartGame = () => {
    if (!room) return;
    const humanCount = room.players.filter((p) => !p.isAI).length;
    if (humanCount < 1) {
      Alert.alert("خطأ", "لا يوجد لاعبون كافيون");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    socket?.emit("start_game", { roomCode: room.code });
  };

  const handleFindMatch = () => {
    if (!player.name) {
      Alert.alert("تحتاج اسم", "يرجى تعيين اسمك في الإعدادات أولاً");
      router.push("/(tabs)/settings");
      return;
    }
    setMode("matchmaking");
    setIsLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    socket?.emit("find_match", {
      playerName: player.name,
      playerSkin: player.currentSkin,
    });
  };

  const handleCancelMatch = () => {
    socket?.emit("cancel_match");
    setMode("menu");
    setIsLoading(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  useEffect(() => {
    if (mode !== "matchmaking") return;
    const interval = setInterval(() => {
      setSearchDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);
    return () => clearInterval(interval);
  }, [mode]);

  const handleLeaveRoom = () => {
    if (room) socket?.emit("leave_room", { roomCode: room.code });
    setRoom(null);
    setMode("menu");
  };

  const myId = socket?.id || socketIdRef.current;
  const isHost = room?.hostId === myId;

  if (mode === "room" && room) {
    const diffCfg = DIFFICULTY_CONFIG[room.difficulty] || DIFFICULTY_CONFIG.normal;
    return (
      <LinearGradient colors={["#0D0625", "#1A0D40", "#2D1B69"]} style={styles.container}>
        <View style={[styles.roomHeader, { paddingTop: topInset + 12 }]}>
          <Pressable onPress={handleLeaveRoom} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </Pressable>
          <View style={styles.roomCodeBox}>
            <Text style={styles.roomCodeLabel}>كود الغرفة</Text>
            <Text style={styles.roomCode}>{room.code}</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.roomMeta}>
          <View style={[styles.metaBadge, { borderColor: diffCfg.color + "60" }]}>
            <Ionicons name={diffCfg.icon} size={14} color={diffCfg.color} />
            <Text style={[styles.metaText, { color: diffCfg.color }]}>{diffCfg.label}</Text>
          </View>
          <View style={styles.metaBadge}>
            <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>{diffCfg.desc}</Text>
          </View>
          <View style={styles.metaBadge}>
            <Ionicons name="refresh-outline" size={14} color={Colors.textMuted} />
            <Text style={styles.metaText}>{room.maxRounds} جولات</Text>
          </View>
          {room.hasAI && (
            <View style={[styles.metaBadge, { borderColor: Colors.accent + "60" }]}>
              <MaterialCommunityIcons name="robot-outline" size={14} color={Colors.accent} />
              <Text style={[styles.metaText, { color: Colors.accent }]}>ذكاء اصطناعي</Text>
            </View>
          )}
        </View>

        <Text style={styles.playersTitle}>اللاعبون ({room.players.length}/8)</Text>

        <ScrollView contentContainerStyle={styles.playersList} showsVerticalScrollIndicator={false}>
          {room.players.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              isHost={p.id === room.hostId}
              isMe={p.id === myId}
            />
          ))}
          <View style={styles.waitingBox}>
            <Ionicons name="people-outline" size={18} color={Colors.textMuted} />
            <Text style={styles.waitingText}>
              {room.players.filter((p) => !p.isAI).length < 2 && !room.hasAI
                ? "في انتظار المزيد من اللاعبين..."
                : "جاهز للبدء!"}
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
          {isHost ? (
            <Pressable
              onPress={handleStartGame}
              style={({ pressed }) => [styles.startBtn, pressed && { opacity: 0.85 }]}
            >
              <LinearGradient
                colors={["#F5A623", "#FF6B35"]}
                style={styles.startBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="play" size={22} color="#fff" />
                <Text style={styles.startBtnText}>ابدأ اللعبة</Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={styles.waitingForHost}>
              <ActivityIndicator color={Colors.secondary} />
              <Text style={styles.waitingForHostText}>في انتظار المضيف لبدء اللعبة</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={["#0D0625", "#1A0D40", "#2D1B69"]} style={styles.container}>
      <View style={[styles.header, { paddingTop: topInset + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </Pressable>
        <Text style={styles.title}>صالة اللعب</Text>
        <View style={{ width: 40 }} />
      </View>

      {!isConnected && (
        <View style={styles.connectionBadge}>
          <ActivityIndicator size="small" color={Colors.error} />
          <Text style={styles.connectionText}>جارٍ الاتصال...</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {mode === "menu" && (
          <>
            <View style={styles.difficultySection}>
              <Text style={styles.sectionLabel}>مستوى الصعوبة</Text>
              <View style={styles.difficultyRow}>
                {(["easy", "normal", "hard"] as Difficulty[]).map((d) => {
                  const cfg = DIFFICULTY_CONFIG[d];
                  const active = selectedDifficulty === d;
                  return (
                    <Pressable
                      key={d}
                      onPress={() => { setSelectedDifficulty(d); Haptics.selectionAsync(); }}
                      style={[
                        styles.diffBtn,
                        { borderColor: active ? cfg.color : Colors.border },
                        active && { backgroundColor: cfg.color + "25" },
                      ]}
                    >
                      <Ionicons name={cfg.icon} size={22} color={active ? cfg.color : Colors.textMuted} />
                      <Text style={[styles.diffLabel, { color: active ? cfg.color : Colors.textMuted }]}>
                        {cfg.label}
                      </Text>
                      <Text style={[styles.diffDesc, { color: active ? cfg.color + "AA" : Colors.textMuted }]}>
                        {cfg.desc}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.aiSection}>
              <View style={styles.aiRow}>
                <View style={styles.aiInfo}>
                  <MaterialCommunityIcons name="robot-outline" size={22} color={Colors.accent} />
                  <View>
                    <Text style={styles.aiLabel}>العب ضد الذكاء الاصطناعي</Text>
                    <Text style={styles.aiSubLabel}>يُضاف روبوت حسب المستوى المختار</Text>
                  </View>
                </View>
                <Switch
                  value={withAI}
                  onValueChange={(v) => { setWithAI(v); Haptics.selectionAsync(); }}
                  trackColor={{ false: Colors.border, true: Colors.accent + "80" }}
                  thumbColor={withAI ? Colors.accent : Colors.textMuted}
                />
              </View>
            </View>

            <View style={styles.menuOptions}>
              <Pressable
                onPress={handleFindMatch}
                disabled={isLoading}
                style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={["#8E2DE2", "#4A00E0"]}
                  style={styles.menuBtnGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="globe" size={32} color="#fff" />
                  <Text style={styles.menuBtnText}>العب أونلاين</Text>
                  <Text style={styles.menuBtnSub}>ابحث عن خصم تلقائياً</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={handleCreateRoom}
                disabled={isLoading}
                style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={["#F5A623", "#FF6B35"]}
                  style={styles.menuBtnGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="large" />
                  ) : (
                    <Ionicons name="add-circle" size={32} color="#fff" />
                  )}
                  <Text style={styles.menuBtnText}>إنشاء غرفة</Text>
                  <Text style={styles.menuBtnSub}>أنت المضيف</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => setMode("join")}
                style={({ pressed }) => [styles.menuBtnJoin, pressed && { opacity: 0.85 }]}
              >
                <Ionicons name="enter" size={32} color={Colors.accent} />
                <Text style={styles.menuBtnText}>الانضمام لغرفة</Text>
                <Text style={[styles.menuBtnSub, { color: Colors.textSecondary }]}>أدخل كود الغرفة</Text>
              </Pressable>
            </View>
          </>
        )}

        {mode === "join" && (
          <View style={styles.joinContainer}>
            <Text style={styles.joinTitle}>أدخل كود الغرفة</Text>
            <TextInput
              style={styles.codeInput}
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              placeholder="ABCD"
              placeholderTextColor={Colors.textMuted}
              maxLength={4}
              autoCapitalize="characters"
              textAlign="center"
              autoFocus
            />
            <View style={styles.joinActions}>
              <Pressable
                onPress={handleJoinRoom}
                disabled={isLoading}
                style={({ pressed }) => [styles.joinBtn, pressed && { opacity: 0.85 }]}
              >
                <LinearGradient
                  colors={["#4ECDC4", "#27AE60"]}
                  style={styles.joinBtnGrad}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.joinBtnText}>انضم الآن</Text>}
                </LinearGradient>
              </Pressable>
              <Pressable onPress={() => setMode("menu")} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>رجوع</Text>
              </Pressable>
            </View>
          </View>
        )}

        {mode === "matchmaking" && (
          <View style={styles.matchmakingContainer}>
            <View style={styles.matchmakingCircle}>
              <ActivityIndicator size="large" color="#8E2DE2" />
            </View>
            <Text style={styles.matchmakingTitle}>جارٍ البحث عن خصم{searchDots}</Text>
            <Text style={styles.matchmakingSubtitle}>يرجى الانتظار حتى يتم إيجاد لاعب آخر</Text>
            <Pressable
              onPress={handleCancelMatch}
              style={({ pressed }) => [styles.cancelMatchBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.cancelMatchText}>إلغاء البحث</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

function PlayerRow({ player, isHost, isMe }: { player: RoomPlayer; isHost: boolean; isMe: boolean }) {
  return (
    <View style={[styles.playerRow, isMe && styles.playerRowMe]}>
      <PlayerAvatar skinId={player.skin} size={44} />
      <Text style={styles.playerRowName}>
        {player.name}
        {isMe ? " (أنت)" : ""}
      </Text>
      {player.isAI && (
        <View style={styles.aiBadge}>
          <MaterialCommunityIcons name="robot-outline" size={12} color={Colors.accent} />
          <Text style={styles.aiBadgeText}>AI</Text>
        </View>
      )}
      {isHost && !player.isAI && (
        <View style={styles.hostBadge}>
          <Ionicons name="star" size={12} color={Colors.gold} />
          <Text style={styles.hostBadgeText}>مضيف</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: Colors.text, fontSize: 22, fontFamily: "Inter_700Bold" },
  connectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.error + "30",
    padding: 10,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  connectionText: { color: Colors.error, fontSize: 14, fontFamily: "Inter_500Medium" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  difficultySection: { gap: 10 },
  sectionLabel: { color: Colors.textSecondary, fontSize: 14, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  difficultyRow: { flexDirection: "row", gap: 10 },
  diffBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    alignItems: "center",
    gap: 4,
    borderWidth: 2,
  },
  diffLabel: { fontSize: 14, fontFamily: "Inter_700Bold" },
  diffDesc: { fontSize: 11, fontFamily: "Inter_400Regular" },
  aiSection: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  aiRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  aiInfo: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  aiLabel: { color: Colors.text, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  aiSubLabel: { color: Colors.textMuted, fontSize: 12, fontFamily: "Inter_400Regular" },
  menuOptions: { gap: 14 },
  menuBtn: { borderRadius: 24, overflow: "hidden" },
  menuBtnGrad: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    gap: 8,
  },
  menuBtnJoin: {
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.accent + "60",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 28,
    gap: 8,
  },
  menuBtnText: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  menuBtnSub: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular" },
  joinContainer: { alignItems: "center", gap: 20, paddingTop: 20 },
  joinTitle: { color: Colors.text, fontSize: 22, fontFamily: "Inter_700Bold" },
  codeInput: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 18,
    color: Colors.text,
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    letterSpacing: 12,
    borderWidth: 2,
    borderColor: Colors.accent,
    width: 220,
  },
  joinActions: { gap: 12, width: "100%" },
  joinBtn: { borderRadius: 16, overflow: "hidden" },
  joinBtnGrad: { alignItems: "center", justifyContent: "center", paddingVertical: 16 },
  joinBtnText: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  cancelBtn: { alignItems: "center", paddingVertical: 12 },
  cancelBtnText: { color: Colors.textMuted, fontSize: 16, fontFamily: "Inter_500Medium" },
  roomHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  roomCodeBox: { alignItems: "center" },
  roomCodeLabel: { color: Colors.textMuted, fontSize: 11, fontFamily: "Inter_400Regular" },
  roomCode: { color: Colors.secondary, fontSize: 28, fontFamily: "Inter_700Bold", letterSpacing: 4 },
  roomMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 8,
    justifyContent: "center",
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.card,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metaText: { color: Colors.textMuted, fontSize: 12, fontFamily: "Inter_500Medium" },
  playersTitle: {
    color: Colors.text,
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 20,
    marginBottom: 6,
    textAlign: "right",
  },
  playersList: { paddingHorizontal: 20, gap: 10, paddingBottom: 20 },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playerRowMe: { borderColor: Colors.accent + "80" },
  playerRowName: { flex: 1, color: Colors.text, fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "right" },
  hostBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.gold + "20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  hostBadgeText: { color: Colors.gold, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accent + "20",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  aiBadgeText: { color: Colors.accent, fontSize: 11, fontFamily: "Inter_700Bold" },
  waitingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  waitingText: { color: Colors.textMuted, fontSize: 13, fontFamily: "Inter_400Regular" },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  startBtn: { borderRadius: 16, overflow: "hidden" },
  startBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
  },
  startBtnText: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  waitingForHost: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  waitingForHostText: { color: Colors.textMuted, fontSize: 14, fontFamily: "Inter_400Regular" },
  matchmakingContainer: { alignItems: "center", gap: 20, paddingTop: 40 },
  matchmakingCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(142, 45, 226, 0.15)",
    borderWidth: 2,
    borderColor: "rgba(142, 45, 226, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  matchmakingTitle: { color: Colors.text, fontSize: 22, fontFamily: "Inter_700Bold", textAlign: "center" },
  matchmakingSubtitle: { color: Colors.textMuted, fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  cancelMatchBtn: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.error + "60",
    marginTop: 12,
  },
  cancelMatchText: { color: Colors.error, fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
