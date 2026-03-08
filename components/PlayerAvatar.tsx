import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { SKINS } from "@/context/PlayerContext";

interface PlayerAvatarProps {
  skinId: string;
  name?: string;
  size?: number;
  showName?: boolean;
  rank?: number;
}

export function PlayerAvatar({ skinId, name, size = 56, showName = false, rank }: PlayerAvatarProps) {
  const skin = SKINS.find((s) => s.id === skinId) || SKINS[0];
  const iconSize = size * 0.45;

  return (
    <View style={styles.wrapper}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: skin.color + "33",
            borderColor: skin.color,
            borderWidth: 2.5,
          },
        ]}
      >
        <SkinIcon iconName={skin.icon} size={iconSize} color={skin.color} />
        {rank !== undefined && (
          <View style={[styles.rankBadge, rank === 0 && styles.rankGold, rank === 1 && styles.rankSilver, rank === 2 && styles.rankBronze]}>
            <Text style={styles.rankText}>{rank + 1}</Text>
          </View>
        )}
      </View>
      {showName && name && (
        <Text style={[styles.name, { maxWidth: size + 16 }]} numberOfLines={1}>
          {name}
        </Text>
      )}
    </View>
  );
}

function SkinIcon({ iconName, size, color }: { iconName: string; size: number; color: string }) {
  switch (iconName) {
    case "crown":
      return <MaterialCommunityIcons name="crown" size={size} color={color} />;
    case "compass":
      return <Ionicons name="compass" size={size} color={color} />;
    case "book":
      return <Ionicons name="book" size={size} color={color} />;
    case "trophy":
      return <Ionicons name="trophy" size={size} color={color} />;
    case "shield":
      return <Ionicons name="shield" size={size} color={color} />;
    case "sparkles":
      return <Ionicons name="sparkles" size={size} color={color} />;
    case "fire":
      return <MaterialCommunityIcons name="fire" size={size} color={color} />;
    default:
      return <Ionicons name="star" size={size} color={color} />;
  }
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
    gap: 4,
  },
  avatar: {
    alignItems: "center",
    justifyContent: "center",
  },
  rankBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#888",
    alignItems: "center",
    justifyContent: "center",
  },
  rankGold: { backgroundColor: "#FFD700" },
  rankSilver: { backgroundColor: "#C0C0C0" },
  rankBronze: { backgroundColor: "#CD7F32" },
  rankText: {
    color: "#1A0D40",
    fontSize: 10,
    fontWeight: "700",
  },
  name: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 11,
    textAlign: "center",
    fontFamily: "Inter_500Medium",
  },
});
