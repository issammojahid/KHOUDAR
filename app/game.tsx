import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  Platform,
  Animated,
  KeyboardAvoidingView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useSocket } from "@/context/SocketContext";
import { usePlayer } from "@/context/PlayerContext";
import { ChatOverlay, ChatButton } from "@/components/ChatOverlay";

const CATEGORY_ICONS: Record<string, any> = {
  "اسم بنت": "rose-outline",
  "اسم ولد": "person-outline",
  "حيوان": "paw-outline",
  "فاكهة": "nutrition-outline",
  "خضار": "leaf-outline",
  "جماد": "cube-outline",
  "مدينة": "business-outline",
  "دولة": "earth-outline",
};

const CATEGORY_COLORS: Record<string, string> = {
  "اسم بنت": "#FF69B4",
  "اسم ولد": "#4ECDC4",
  "حيوان": "#27AE60",
  "فاكهة": "#FF6B35",
  "خضار": "#2ECC71",
  "جماد": "#9B59B6",
  "مدينة": "#3498DB",
  "دولة": "#E74C3C",
};

export default function GameScreen() {
  const insets = useSafeAreaInsets();
  const { socket } = useSocket();
  const { player } = usePlayer();
  const params = useLocalSearchParams();

  const roomCode = params.roomCode as string;
  const letter = params.letter as string;
  const categories: string[] = JSON.parse((params.categories as string) || "[]");
  const timeLimit = parseInt((params.timeLimit as string) || "120");
  const round = parseInt((params.round as string) || "1");
  const maxRounds = parseInt((params.maxRounds as string) || "3");

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [submitted, setSubmitted] = useState(false);
  const [submittedPlayers, setSubmittedPlayers] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerAnim = useRef(new Animated.Value(1)).current;
  const submitCountRef = useRef(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (timeLeft <= 15 && timeLeft > 0) {
      Animated.sequence([
        Animated.timing(timerAnim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
        Animated.timing(timerAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]).start();
      if (timeLeft <= 10) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    }
  }, [timeLeft]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (!submitted) {
            handleSubmit(true);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onPlayerSubmitted = ({ playerId }: { playerId: string }) => {
      setSubmittedPlayers((prev) => [...prev, playerId]);
    };

    const onChatMessage = () => {
      setChatUnread((p) => p + 1);
    };

    const onRoundEnded = ({ results, letter: l, round: r, hostId }: any) => {
      if (timerRef.current) clearInterval(timerRef.current);
      router.replace({
        pathname: "/results",
        params: {
          results: JSON.stringify(results),
          letter: l,
          round: String(r),
          maxRounds: String(maxRounds),
          roomCode,
          hostId: hostId || "",
        },
      });
    };

    socket.on("player_submitted", onPlayerSubmitted);
    socket.on("chat_message", onChatMessage);
    socket.on("round_ended", onRoundEnded);

    return () => {
      socket.off("player_submitted", onPlayerSubmitted);
      socket.off("round_ended", onRoundEnded);
      socket.off("chat_message", onChatMessage);
    };
  }, [socket]);

  const handleSubmit = useCallback(
    (auto = false) => {
      if (submitted) return;
      if (!auto) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      setSubmitted(true);
      if (timerRef.current) clearInterval(timerRef.current);
      socket?.emit("submit_answers", { roomCode, answers });
    },
    [submitted, answers, roomCode, socket]
  );

  const timerColor =
    timeLeft > 30 ? Colors.success : timeLeft > 15 ? Colors.secondary : Colors.error;

  const progressWidth = `${(timeLeft / timeLimit) * 100}%`;

  return (
    <LinearGradient colors={["#0D0625", "#1A0D40", "#2D1B69"]} style={styles.container}>
      <View style={[styles.topBar, { paddingTop: topInset + 8 }]}>
        <View style={styles.roundBadge}>
          <Text style={styles.roundText}>
            الجولة {round}/{maxRounds}
          </Text>
        </View>

        <Animated.View style={[styles.letterContainer, { transform: [{ scale: pulseAnim }] }]}>
          <LinearGradient
            colors={["#F5A623", "#FF6B35"]}
            style={styles.letterCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.letter}>{letter}</Text>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={[styles.timerBox, { transform: [{ scale: timerAnim }] }]}>
          <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}</Text>
        </Animated.View>
      </View>

      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: progressWidth as any, backgroundColor: timerColor },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={[styles.formContent, { paddingBottom: bottomInset + 100 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {categories.map((cat) => (
            <CategoryInput
              key={cat}
              category={cat}
              letter={letter}
              value={answers[cat] || ""}
              onChange={(v) => setAnswers((prev) => ({ ...prev, [cat]: v }))}
              disabled={submitted}
            />
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.bottomActions, { paddingBottom: bottomInset + 16 }]}>
        {submittedPlayers.length > 0 && (
          <Text style={styles.submittedCount}>
            {submittedPlayers.length} لاعب أرسل إجاباته
          </Text>
        )}
        <View style={styles.bottomRow}>
          <View style={styles.chatBtnWrap}>
            <ChatButton
              onPress={() => { setChatOpen(!chatOpen); setChatUnread(0); }}
              unreadCount={chatUnread}
            />
          </View>
          <Pressable
            onPress={() => handleSubmit(false)}
            disabled={submitted}
            style={({ pressed }) => [
              styles.submitBtn,
              submitted && styles.submitBtnDone,
              pressed && !submitted && { opacity: 0.85 },
            ]}
          >
            <LinearGradient
              colors={submitted ? ["#27AE60", "#1E8449"] : ["#F5A623", "#FF6B35"]}
              style={styles.submitBtnGrad}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons
                name={submitted ? "checkmark-circle" : "send"}
                size={22}
                color="#fff"
              />
              <Text style={styles.submitBtnText}>
                {submitted ? "تم الإرسال!" : "أرسل الإجابات"}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      <ChatOverlay roomCode={roomCode} visible={chatOpen} onClose={() => setChatOpen(false)} />
    </LinearGradient>
  );
}

function CategoryInput({
  category,
  letter,
  value,
  onChange,
  disabled,
}: {
  category: string;
  letter: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  const icon = CATEGORY_ICONS[category] || "help-circle-outline";
  const color = CATEGORY_COLORS[category] || Colors.accent;
  const isValid = value.trim().startsWith(letter);
  const [isListening, setIsListening] = useState(false);

  const handleMic = () => {
    if (disabled || isListening) return;
    if (Platform.OS !== "web") {
      Alert.alert("ميكروفون", "الإدخال الصوتي متاح فقط على المتصفح");
      return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      Alert.alert("غير مدعوم", "متصفحك لا يدعم الإدخال الصوتي");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ar";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) onChange(transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View style={[styles.inputCard, disabled && styles.inputCardDisabled]}>
      <View style={styles.inputCardHeader}>
        <Pressable onPress={handleMic} disabled={disabled} hitSlop={8}>
          <Ionicons
            name={isListening ? "mic" : "mic-outline"}
            size={20}
            color={isListening ? Colors.error : Colors.textMuted}
          />
        </Pressable>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={[styles.inputCardLabel, { color }]}>{category}</Text>
        {value.trim() && (
          <Ionicons
            name={isValid ? "checkmark-circle" : "close-circle"}
            size={16}
            color={isValid ? Colors.success : Colors.error}
          />
        )}
      </View>
      <TextInput
        style={[
          styles.inputField,
          disabled && styles.inputFieldDisabled,
          value.trim() && isValid && styles.inputFieldValid,
          isListening && { borderColor: Colors.error + "80" },
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={`اكتب ${category} يبدأ بـ ${letter}`}
        placeholderTextColor={Colors.textMuted}
        editable={!disabled}
        textAlign="right"
        maxLength={30}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  roundBadge: {
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  roundText: { color: Colors.textSecondary, fontSize: 13, fontFamily: "Inter_600SemiBold" },
  letterContainer: {
    shadowColor: "#F5A623",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 16,
  },
  letterCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  letter: { fontSize: 40, color: "#fff", fontFamily: "Inter_700Bold", lineHeight: 48 },
  timerBox: {
    backgroundColor: Colors.card,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.border,
  },
  timerText: { fontSize: 22, fontFamily: "Inter_700Bold" },
  progressBar: {
    height: 4,
    backgroundColor: Colors.border,
    marginHorizontal: 20,
    borderRadius: 2,
    marginBottom: 12,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2 },
  formContent: { paddingHorizontal: 16, gap: 10 },
  inputCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputCardDisabled: { opacity: 0.6 },
  inputCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "flex-end" },
  inputCardLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "right" },
  inputField: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputFieldDisabled: { opacity: 0.6 },
  inputFieldValid: { borderColor: Colors.success + "80" },
  bottomActions: {
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: "rgba(13,6,37,0.8)",
  },
  submittedCount: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: "center",
    fontFamily: "Inter_400Regular",
  },
  bottomRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  chatBtnWrap: {},
  submitBtn: { borderRadius: 16, overflow: "hidden", flex: 1 },
  submitBtnDone: {},
  submitBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  submitBtnText: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
});
