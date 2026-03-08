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
  Dimensions,
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
import { VoiceChat } from "@/components/VoiceChat";

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

const URGENCY_MESSAGES = ["أسرع!", "يلا!", "وقتك يضيع!", "بسرعة!"];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

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
  const answersRef = useRef<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [submitted, setSubmitted] = useState(false);
  const submittedRef = useRef(false);
  const [submittedPlayers, setSubmittedPlayers] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const timerAnim = useRef(new Animated.Value(1)).current;
  const submitCountRef = useRef(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);

  interface OpponentInfo { id: string; name: string; skin: string; }
  const playersParam = params.players as string;
  const otherPlayers: OpponentInfo[] = (() => {
    try {
      const all: OpponentInfo[] = JSON.parse(playersParam || "[]");
      return all.filter((p) => p.id !== socket?.id);
    } catch { return []; }
  })();
  const [opponentProgress, setOpponentProgress] = useState<Record<string, { filled: number; submitted: boolean }>>({});

  const [combo, setCombo] = useState(0);
  const lastFillTimeRef = useRef<number>(0);
  const comboAnim = useRef(new Animated.Value(0)).current;
  const comboScaleAnim = useRef(new Animated.Value(0)).current;

  const urgencyOverlayAnim = useRef(new Animated.Value(0)).current;
  const urgencyLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const hurryAnim = useRef(new Animated.Value(0)).current;
  const hurryScaleAnim = useRef(new Animated.Value(1)).current;
  const [hurryMessage, setHurryMessage] = useState("");
  const hurryShownRef = useRef(false);

  const progressGlowAnim = useRef(new Animated.Value(0)).current;

  const submitFlashAnim = useRef(new Animated.Value(0)).current;
  const allFilledRef = useRef(false);

  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const filledCount = categories.filter((cat) => answers[cat]?.trim()).length;
  const totalCount = categories.length;

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
    if (timeLeft <= 10 && timeLeft > 0) {
      if (!urgencyLoopRef.current) {
        const loop = Animated.loop(
          Animated.sequence([
            Animated.timing(urgencyOverlayAnim, { toValue: 0.35, duration: 500, useNativeDriver: true }),
            Animated.timing(urgencyOverlayAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
          ])
        );
        urgencyLoopRef.current = loop;
        loop.start();
      }
    } else {
      if (urgencyLoopRef.current) {
        urgencyLoopRef.current.stop();
        urgencyLoopRef.current = null;
        urgencyOverlayAnim.setValue(0);
      }
    }
  }, [timeLeft]);

  useEffect(() => {
    if (timeLeft <= 30 && timeLeft > 0 && !hurryShownRef.current && !submitted) {
      hurryShownRef.current = true;
      const msg = URGENCY_MESSAGES[Math.floor(Math.random() * URGENCY_MESSAGES.length)];
      setHurryMessage(msg);
      Animated.sequence([
        Animated.parallel([
          Animated.timing(hurryAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.spring(hurryScaleAnim, { toValue: 1.2, useNativeDriver: true, friction: 3 }),
        ]),
        Animated.timing(hurryScaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(hurryAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start(() => {
        setTimeout(() => {
          hurryShownRef.current = false;
        }, 8000);
      });
    }
  }, [timeLeft, submitted]);

  useEffect(() => {
    if (timeLeft <= 10 && timeLeft > 0) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(progressGlowAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
          Animated.timing(progressGlowAnim, { toValue: 0, duration: 400, useNativeDriver: false }),
        ])
      ).start();
    }
  }, [timeLeft <= 10]);

  useEffect(() => {
    if (filledCount === totalCount && totalCount > 0 && !allFilledRef.current) {
      allFilledRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Animated.loop(
        Animated.sequence([
          Animated.timing(submitFlashAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(submitFlashAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        { iterations: 5 }
      ).start();
    } else if (filledCount < totalCount) {
      allFilledRef.current = false;
      submitFlashAnim.setValue(0);
    }
  }, [filledCount, totalCount]);

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
      setOpponentProgress((prev) => ({
        ...prev,
        [playerId]: { filled: categories.length, submitted: true },
      }));
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

    const onPlayerProgress = ({ playerId, filledCount }: { playerId: string; filledCount: number }) => {
      setOpponentProgress((prev) => ({
        ...prev,
        [playerId]: { filled: filledCount, submitted: prev[playerId]?.submitted || false },
      }));
    };

    socket.on("player_submitted", onPlayerSubmitted);
    socket.on("chat_message", onChatMessage);
    socket.on("round_ended", onRoundEnded);
    socket.on("player_progress", onPlayerProgress);

    return () => {
      socket.off("player_submitted", onPlayerSubmitted);
      socket.off("round_ended", onRoundEnded);
      socket.off("chat_message", onChatMessage);
      socket.off("player_progress", onPlayerProgress);
    };
  }, [socket]);

  const triggerCombo = useCallback((newCombo: number) => {
    setCombo(newCombo);
    comboAnim.setValue(0);
    comboScaleAnim.setValue(0.3);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(comboAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(800),
        Animated.timing(comboAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]),
      Animated.spring(comboScaleAnim, { toValue: 1, useNativeDriver: true, friction: 4, tension: 100 }),
    ]).start();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleAnswerChange = useCallback((cat: string, v: string) => {
    setAnswers((prev) => {
      const wasFilled = prev[cat]?.trim();
      const nowFilled = v.trim();
      if (!wasFilled && nowFilled) {
        const now = Date.now();
        const elapsed = now - lastFillTimeRef.current;
        if (lastFillTimeRef.current > 0 && elapsed < 5000) {
          const newCombo = combo + 1;
          triggerCombo(newCombo);
        } else {
          setCombo(0);
        }
        lastFillTimeRef.current = now;
      }
      return { ...prev, [cat]: v };
    });
  }, [combo, triggerCombo]);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const emitProgressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (submittedRef.current || !socket) return;
    if (emitProgressRef.current) clearTimeout(emitProgressRef.current);
    emitProgressRef.current = setTimeout(() => {
      const filled = categories.filter((cat) => answers[cat]?.trim()).length;
      socket.emit("player_progress", { roomCode, filledCount: filled });
    }, 300);
  }, [answers, socket, roomCode]);

  const handleSubmit = useCallback(
    (auto = false) => {
      if (submittedRef.current) return;
      if (!auto) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
      submittedRef.current = true;
      setSubmitted(true);
      if (timerRef.current) clearInterval(timerRef.current);
      socket?.emit("submit_answers", { roomCode, answers: answersRef.current });
    },
    [roomCode, socket]
  );

  const timerColor =
    timeLeft > 30 ? Colors.success : timeLeft > 15 ? Colors.secondary : Colors.error;

  const progressWidth = `${(timeLeft / timeLimit) * 100}%`;

  const progressShadowColor = progressGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(231,76,60,0)", "rgba(231,76,60,0.8)"],
  });

  const progressShadowRadius = progressGlowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  });

  const submitFlashScale = submitFlashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  return (
    <LinearGradient colors={["#0D0625", "#1A0D40", "#2D1B69"]} style={styles.container}>
      {timeLeft <= 10 && timeLeft > 0 && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.urgencyOverlayLeft,
              { opacity: urgencyOverlayAnim },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.urgencyOverlayRight,
              { opacity: urgencyOverlayAnim },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.urgencyOverlayTop,
              { opacity: urgencyOverlayAnim },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.urgencyOverlayBottom,
              { opacity: urgencyOverlayAnim },
            ]}
          />
        </>
      )}

      <Animated.View
        pointerEvents="none"
        style={[
          styles.hurryContainer,
          {
            opacity: hurryAnim,
            transform: [{ scale: hurryScaleAnim }],
          },
        ]}
      >
        <Text style={styles.hurryText}>{hurryMessage}</Text>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.comboContainer,
          {
            opacity: comboAnim,
            transform: [{ scale: comboScaleAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={["#FFD700", "#FF6B35"]}
          style={styles.comboBadge}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="flame" size={20} color="#fff" />
          <Text style={styles.comboText}>+COMBO x{combo}!</Text>
        </LinearGradient>
      </Animated.View>

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

        <Animated.View style={[styles.timerBox, { transform: [{ scale: timerAnim }], borderColor: timerColor }]}>
          <Text style={[styles.timerText, { color: timerColor }]}>{timeLeft}</Text>
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.progressBar,
          timeLeft <= 10 && {
            shadowColor: progressShadowColor as any,
            shadowRadius: progressShadowRadius as any,
            shadowOpacity: 1,
            shadowOffset: { width: 0, height: 0 },
          },
        ]}
      >
        <View
          style={[
            styles.progressFill,
            { width: progressWidth as any, backgroundColor: timerColor },
          ]}
        />
      </Animated.View>

      {otherPlayers.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.opponentStrip} contentContainerStyle={styles.opponentStripContent}>
          {otherPlayers.map((op) => {
            const prog = opponentProgress[op.id];
            const filled = prog?.filled || 0;
            const isSubmitted = prog?.submitted || false;
            const pct = totalCount > 0 ? (filled / totalCount) * 100 : 0;
            return (
              <View key={op.id} style={styles.opponentBubble}>
                <View style={styles.opponentAvatarWrap}>
                  <View style={[styles.opponentAvatar, isSubmitted && styles.opponentAvatarDone]}>
                    <Text style={styles.opponentAvatarText}>{op.name?.[0] || "?"}</Text>
                  </View>
                  {isSubmitted && (
                    <View style={styles.opponentCheckBadge}>
                      <Ionicons name="checkmark" size={10} color="#fff" />
                    </View>
                  )}
                </View>
                <View style={styles.opponentProgressBar}>
                  <View style={[styles.opponentProgressFill, { width: `${pct}%` as any, backgroundColor: isSubmitted ? Colors.success : Colors.accent }]} />
                </View>
                <Text style={styles.opponentProgressText}>
                  {isSubmitted ? "done" : `${filled}/${totalCount}`}
                </Text>
              </View>
            );
          })}
        </ScrollView>
      )}

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
              onChange={(v) => handleAnswerChange(cat, v)}
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
            <VoiceChat roomCode={roomCode} />
          </View>
          <View style={styles.chatBtnWrap}>
            <ChatButton
              onPress={() => { setChatOpen(!chatOpen); setChatUnread(0); }}
              unreadCount={chatUnread}
            />
          </View>
          <Animated.View style={[styles.submitBtn, { transform: [{ scale: submitFlashScale }] }]}>
            <Pressable
              onPress={() => handleSubmit(false)}
              disabled={submitted}
              style={({ pressed }) => [
                styles.submitBtnInner,
                submitted && styles.submitBtnDone,
                pressed && !submitted && { opacity: 0.85 },
              ]}
            >
              <LinearGradient
                colors={submitted ? ["#27AE60", "#1E8449"] : filledCount === totalCount ? ["#FFD700", "#FF6B35"] : ["#F5A623", "#FF6B35"]}
                style={styles.submitBtnGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.filledBadge}>
                  <Text style={styles.filledBadgeText}>{filledCount}/{totalCount}</Text>
                </View>
                <Ionicons
                  name={submitted ? "checkmark-circle" : "send"}
                  size={22}
                  color="#fff"
                />
                <Text style={styles.submitBtnText}>
                  {submitted ? "تم الإرسال!" : "أرسل"}
                </Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
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
  opponentStrip: {
    maxHeight: 70,
    marginBottom: 4,
  },
  opponentStripContent: {
    paddingHorizontal: 12,
    gap: 8,
    alignItems: "center",
  },
  opponentBubble: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 64,
    maxWidth: 90,
    gap: 3,
  },
  opponentAvatarWrap: {
    position: "relative" as const,
  },
  opponentCheckBadge: {
    position: "absolute" as const,
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.success,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  opponentAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  opponentAvatarDone: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  opponentAvatarText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  opponentName: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    maxWidth: 70,
    textAlign: "center" as const,
  },
  opponentProgressText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
  },
  opponentProgressBar: {
    width: "100%" as any,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 2,
    overflow: "hidden" as const,
  },
  opponentProgressFill: {
    height: "100%" as any,
    borderRadius: 2,
  },
  opponentCount: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  bottomRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  chatBtnWrap: {},
  submitBtn: { borderRadius: 16, overflow: "hidden", flex: 1 },
  submitBtnInner: { borderRadius: 16, overflow: "hidden" },
  submitBtnDone: {},
  submitBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 10,
  },
  submitBtnText: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  filledBadge: {
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filledBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  urgencyOverlayLeft: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: 40,
    backgroundColor: "#E74C3C",
    zIndex: 100,
  },
  urgencyOverlayRight: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: 40,
    backgroundColor: "#E74C3C",
    zIndex: 100,
  },
  urgencyOverlayTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: "#E74C3C",
    zIndex: 100,
  },
  urgencyOverlayBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 40,
    backgroundColor: "#E74C3C",
    zIndex: 100,
  },
  hurryContainer: {
    position: "absolute",
    top: "45%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 200,
  },
  hurryText: {
    fontSize: 36,
    fontFamily: "Inter_700Bold",
    color: "#FFD700",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  comboContainer: {
    position: "absolute",
    top: "35%",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 200,
  },
  comboBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  comboText: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
});
