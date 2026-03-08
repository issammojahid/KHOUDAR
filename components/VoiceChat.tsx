import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useSocket } from "@/context/SocketContext";

interface PeerConnection {
  pc: RTCPeerConnection;
  peerId: string;
}

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export function VoiceChat({ roomCode }: { roomCode: string }) {
  const { socket } = useSocket();
  const [isMicOn, setIsMicOn] = useState(false);
  const [activePeers, setActivePeers] = useState<string[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const isMicOnRef = useRef(false);

  const isWebPlatform = Platform.OS === "web";

  const cleanupPeer = useCallback((peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      pc.close();
      peersRef.current.delete(peerId);
    }
    setActivePeers((prev) => prev.filter((id) => id !== peerId));
  }, []);

  const createPeerConnection = useCallback(
    (peerId: string): RTCPeerConnection => {
      const existing = peersRef.current.get(peerId);
      if (existing) {
        existing.close();
        peersRef.current.delete(peerId);
      }
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket?.emit("voice_ice_candidate", {
            roomCode,
            targetId: peerId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play().catch(() => {});
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
          cleanupPeer(peerId);
        }
      };

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      peersRef.current.set(peerId, pc);
      setActivePeers((prev) => [...prev.filter((id) => id !== peerId), peerId]);
      return pc;
    },
    [socket, roomCode, cleanupPeer]
  );

  const startVoice = useCallback(async () => {
    if (!isWebPlatform) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setIsMicOn(true);
      isMicOnRef.current = true;
      socket?.emit("voice_join", { roomCode });
    } catch {
      setIsMicOn(false);
      isMicOnRef.current = false;
    }
  }, [socket, roomCode, isWebPlatform]);

  const stopVoice = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    setActivePeers([]);
    setIsMicOn(false);
    isMicOnRef.current = false;
    socket?.emit("voice_leave", { roomCode });
  }, [socket, roomCode]);

  useEffect(() => {
    if (!socket || !isWebPlatform) return;

    const onPeerJoined = async ({ peerId }: { peerId: string }) => {
      if (!isMicOnRef.current) return;
      const pc = createPeerConnection(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit("voice_offer", { roomCode, targetId: peerId, offer });
    };

    const onVoiceOffer = async ({ senderId, offer }: any) => {
      if (!isMicOnRef.current) {
        await startVoice();
      }
      const pc = createPeerConnection(senderId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit("voice_answer", { roomCode, targetId: senderId, answer });
    };

    const onVoiceAnswer = async ({ senderId, answer }: any) => {
      const pc = peersRef.current.get(senderId);
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const onIceCandidate = async ({ senderId, candidate }: any) => {
      const pc = peersRef.current.get(senderId);
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const onPeerLeft = ({ peerId }: { peerId: string }) => {
      cleanupPeer(peerId);
    };

    socket.on("voice_peer_joined", onPeerJoined);
    socket.on("voice_offer", onVoiceOffer);
    socket.on("voice_answer", onVoiceAnswer);
    socket.on("voice_ice_candidate", onIceCandidate);
    socket.on("voice_peer_left", onPeerLeft);

    return () => {
      socket.off("voice_peer_joined", onPeerJoined);
      socket.off("voice_offer", onVoiceOffer);
      socket.off("voice_answer", onVoiceAnswer);
      socket.off("voice_ice_candidate", onIceCandidate);
      socket.off("voice_peer_left", onPeerLeft);
      stopVoice();
    };
  }, [socket, isWebPlatform]);

  const toggleMic = () => {
    if (isMicOn) {
      stopVoice();
    } else {
      startVoice();
    }
  };

  if (!isWebPlatform) return null;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={toggleMic}
        style={[styles.micButton, isMicOn && styles.micButtonActive]}
      >
        <Ionicons
          name={isMicOn ? "mic" : "mic-off-outline"}
          size={20}
          color={isMicOn ? "#fff" : Colors.textMuted}
        />
      </Pressable>
      {activePeers.length > 0 && (
        <View style={styles.peersBadge}>
          <Text style={styles.peersText}>{activePeers.length}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonActive: {
    backgroundColor: "#E74C3C",
    borderColor: "#E74C3C",
  },
  peersBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    backgroundColor: Colors.success,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  peersText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
});
