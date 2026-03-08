import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useSocket } from "@/context/SocketContext";
import { usePlayer } from "@/context/PlayerContext";

interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  message: string;
  timestamp: number;
}

interface ChatOverlayProps {
  roomCode: string;
  visible: boolean;
  onClose: () => void;
}

export function ChatOverlay({ roomCode, visible, onClose }: ChatOverlayProps) {
  const { socket } = useSocket();
  const { player } = usePlayer();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [unread, setUnread] = useState(0);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!socket) return;
    const handler = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
      if (!visible) setUnread((p) => p + 1);
    };
    socket.on("chat_message", handler);
    return () => { socket.off("chat_message", handler); };
  }, [socket, visible]);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: visible ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
    if (visible) setUnread(0);
  }, [visible]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text || !socket) return;
    socket.emit("chat_message", {
      roomCode,
      message: text,
      playerName: player.name || "لاعب",
    });
    setInputText("");
  };

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [600, 0],
  });

  if (!visible) return null;

  return (
    <Animated.View style={[styles.overlay, { transform: [{ translateY }] }]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>الدردشة</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={Colors.text} />
          </Pressable>
        </View>

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isMe = item.playerName === player.name;
            return (
              <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
                <View style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther]}>
                  {!isMe && <Text style={styles.msgName}>{item.playerName}</Text>}
                  <Text style={styles.msgText}>{item.message}</Text>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.msgList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Ionicons name="chatbubbles-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.emptyChatText}>لا توجد رسائل بعد</Text>
            </View>
          }
        />

        <View style={styles.inputRow}>
          <Pressable onPress={handleSend} style={styles.sendBtn}>
            <Ionicons name="send" size={20} color="#fff" />
          </Pressable>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="اكتب رسالة..."
            placeholderTextColor={Colors.textMuted}
            textAlign="right"
            maxLength={200}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

export function ChatButton({ onPress, unreadCount }: { onPress: () => void; unreadCount: number }) {
  return (
    <Pressable onPress={onPress} style={styles.chatFab}>
      <Ionicons name="chatbubble-ellipses" size={22} color="#fff" />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "60%",
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: Colors.accent + "40",
    zIndex: 100,
    elevation: 20,
  },
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { color: Colors.text, fontSize: 18, fontFamily: "Inter_700Bold" },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  msgList: { paddingHorizontal: 16, paddingVertical: 10, flexGrow: 1 },
  msgRow: { marginBottom: 8, alignItems: "flex-start" },
  msgRowMe: { alignItems: "flex-end" },
  msgBubble: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
  },
  msgBubbleMe: {
    backgroundColor: Colors.accent + "40",
    borderBottomRightRadius: 4,
  },
  msgBubbleOther: {
    backgroundColor: Colors.card,
    borderBottomLeftRadius: 4,
  },
  msgName: {
    color: Colors.secondary,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  msgText: { color: Colors.text, fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "right" },
  emptyChat: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingTop: 60 },
  emptyChatText: { color: Colors.textMuted, fontSize: 14, fontFamily: "Inter_400Regular" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  chatFab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
});
