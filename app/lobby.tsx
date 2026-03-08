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
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { usePlayer } from "@/context/PlayerContext";
import { useSocket } from "@/context/SocketContext";
import { PlayerAvatar } from "@/components/PlayerAvatar";

interface RoomPlayer {
  id: string;
  name: string;
  skin: string;
  totalScore: number;
  ready: boolean;
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
}

export default function LobbyScreen() {
  const insets = useSafeAreaInsets();
  const { player } = usePlayer();
  const { socket, isConnected } = useSocket();
  const [mode, setMode] = useState<"menu" | "create" | "join" | "room">("menu");
  const [joinCode, setJoinCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const socketIdRef = useRef<string>("");

  const topInset = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    if (!socket) return;

    socket.on("connect", () => {
      socketIdRef.current = socket.id || "";
    });

    socket.on("room_created", ({ room: r }) => {
      setRoom(r);
      setMode("room");
      setIsLoading(false);
    });

    socket.on("room_joined", ({ room: r }) => {
      setRoom(r);
      setMode("room");
      setIsLoading(false);
    });

    socket.on("room_updated", ({ room: r }) => {
      setRoom(r);
    });

    socket.on("game_started", (gameData) => {
      router.replace({
        pathname: "/game",
        params: {
          roomCode: room?.code || "",
          letter: gameData.letter,
          categories: JSON.stringify(gameData.categories),
          timeLimit: String(gameData.timeLimit),
          round: String(gameData.round),
          maxRounds: String(gameData.maxRounds),
        },
      });
    });

    socket.on("error", ({ message }) => {
      setIsLoading(false);
      Alert.alert("خطأ", message);
    });

    if (socket.id) socketIdRef.current = socket.id;

    return () => {
      socket.off("room_created");
      socket.off("room_joined");
      socket.off("room_updated");
      socket.off("game_started");
      socket.off("error");
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
    socket?.emit("create_room", {
      playerName: player.name,
      playerSkin: player.currentSkin,
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
    if (room.players.length < 2) {
      Alert.alert("لاعبون غير كافيون", "تحتاج لاعبين على الأقل لبدء اللعبة");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    socket?.emit("start_game", { roomCode: room.code });
  };

  const handleLeaveRoom = () => {
    if (room) {
      socket?.emit("leave_room", { roomCode: room.code });
    }
    setRoom(null);
    setMode("menu");
  };

  const myId = socket?.id || socketIdRef.current;
  const isHost = room?.hostId === myId;

  if (mode === "room" && room) {
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

        <View style={styles.roundInfo}>
          <Ionicons name="refresh" size={16} color={Colors.textMuted} />
          <Text style={styles.roundInfoText}>{room.maxRounds} جولات</Text>
          <Ionicons name="time" size={16} color={Colors.textMuted} />
          <Text style={styles.roundInfoText}>{room.timeLimit} ثانية</Text>
        </View>

        <Text style={styles.playersTitle}>اللاعبون ({room.players.length}/8)</Text>

        <ScrollView
          contentContainerStyle={styles.playersList}
          showsVerticalScrollIndicator={false}
        >
          {room.players.map((p) => (
            <PlayerRow key={p.id} player={p} isHost={p.id === room.hostId} isMe={p.id === myId} />
          ))}

          <View style={styles.waitingBox}>
            <Ionicons name="people-outline" size={20} color={Colors.textMuted} />
            <Text style={styles.waitingText}>
              {room.players.length < 2
                ? "في انتظار المزيد من اللاعبين..."
                : "جاهز للبدء!"}
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
          {isHost ? (
            <Pressable
              onPress={handleStartGame}
              disabled={room.players.length < 2}
              style={({ pressed }) => [
                styles.startBtn,
                pressed && { opacity: 0.85 },
                room.players.length < 2 && styles.startBtnDisabled,
              ]}
            >
              <LinearGradient
                colors={room.players.length >= 2 ? ["#F5A623", "#FF6B35"] : ["#555", "#555"]}
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

      <View style={styles.centerContent}>
        {!isConnected && (
          <View style={styles.connectionBadge}>
            <ActivityIndicator size="small" color={Colors.error} />
            <Text style={styles.connectionText}>جارٍ الاتصال...</Text>
          </View>
        )}

        {mode === "menu" && (
          <View style={styles.menuOptions}>
            <Pressable
              onPress={() => { setMode("create"); handleCreateRoom(); }}
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
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="add-circle" size={32} color="#fff" />
                )}
                <Text style={styles.menuBtnText}>إنشاء غرفة</Text>
                <Text style={styles.menuBtnSub}>أنت المضيف</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={() => setMode("join")}
              style={({ pressed }) => [
                styles.menuBtn,
                styles.menuBtnJoin,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Ionicons name="enter" size={32} color={Colors.accent} />
              <Text style={styles.menuBtnText}>الانضمام لغرفة</Text>
              <Text style={[styles.menuBtnSub, { color: Colors.textSecondary }]}>أدخل كود الغرفة</Text>
            </Pressable>
          </View>
        )}

        {mode === "join" && (
          <View style={styles.joinContainer}>
            <Text style={styles.joinTitle}>أدخل كود الغرفة</Text>
            <TextInput
              style={styles.codeInput}
              value={joinCode}
              onChangeText={(t) => setJoinCode(t.toUpperCase())}
              placeholder="مثال: ABCD"
              placeholderTextColor={Colors.textMuted}
              maxLength={4}
              autoCapitalize="characters"
              textAlign="center"
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
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.joinBtnText}>انضم الآن</Text>
                  )}
                </LinearGradient>
              </Pressable>
              <Pressable onPress={() => setMode("menu")} style={styles.cancelBtn}>
                <Text style={styles.cancelBtnText}>إلغاء</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </LinearGradient>
  );
}

function PlayerRow({
  player,
  isHost,
  isMe,
}: {
  player: RoomPlayer;
  isHost: boolean;
  isMe: boolean;
}) {
  return (
    <View style={[styles.playerRow, isMe && styles.playerRowMe]}>
      <PlayerAvatar skinId={player.skin} size={44} />
      <Text style={styles.playerRowName}>
        {player.name}
        {isMe ? " (أنت)" : ""}
      </Text>
      {isHost && (
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
    paddingBottom: 16,
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
  centerContent: { flex: 1, paddingHorizontal: 20, justifyContent: "center" },
  connectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.error + "30",
    padding: 10,
    borderRadius: 12,
    marginBottom: 20,
  },
  connectionText: { color: Colors.error, fontSize: 14, fontFamily: "Inter_500Medium" },
  menuOptions: { gap: 20 },
  menuBtn: { borderRadius: 24, overflow: "hidden" },
  menuBtnGrad: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  menuBtnJoin: {
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.accent + "60",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 8,
  },
  menuBtnText: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  menuBtnSub: { color: "rgba(255,255,255,0.7)", fontSize: 14, fontFamily: "Inter_400Regular" },
  joinContainer: { alignItems: "center", gap: 20 },
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
    width: 200,
    textAlign: "center",
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
  roundInfo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    marginBottom: 4,
  },
  roundInfoText: { color: Colors.textMuted, fontSize: 13, fontFamily: "Inter_400Regular" },
  playersTitle: {
    color: Colors.text,
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 20,
    marginBottom: 8,
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
  playerRowName: { flex: 1, color: Colors.text, fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "right" },
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
  waitingBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  waitingText: { color: Colors.textMuted, fontSize: 14, fontFamily: "Inter_400Regular" },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  startBtn: { borderRadius: 16, overflow: "hidden" },
  startBtnDisabled: { opacity: 0.5 },
  startBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: 10,
  },
  startBtnText: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  waitingForHost: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  waitingForHostText: { color: Colors.textMuted, fontSize: 15, fontFamily: "Inter_400Regular" },
});
