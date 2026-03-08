import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { Server as SocketServer, Socket } from "socket.io";
import {
  createRoom,
  joinRoom,
  leaveRoom,
  startGame,
  submitAnswers,
  calculateResults,
  nextRound,
  getRoom,
  getRoomPublicData,
  generateAIAnswers,
  findRoomByPlayer,
  type Difficulty,
} from "./gameManager";
import { CATEGORIES } from "./arabicWords";
import { getTopLeaderboard, upsertLeaderboard } from "./db";

const roundTimers = new Map<string, ReturnType<typeof setTimeout>>();
const aiTimers = new Map<string, ReturnType<typeof setTimeout>>();

interface QueueEntry {
  socketId: string;
  socket: Socket;
  playerName: string;
  playerSkin: string;
  joinedAt: number;
}

const matchmakingQueue: QueueEntry[] = [];

function clearRoomTimers(roomCode: string) {
  if (roundTimers.has(roomCode)) {
    clearTimeout(roundTimers.get(roomCode)!);
    roundTimers.delete(roomCode);
  }
  if (aiTimers.has(roomCode)) {
    clearTimeout(aiTimers.get(roomCode)!);
    aiTimers.delete(roomCode);
  }
}

function forceAISubmitAndCheck(io: SocketServer, roomCode: string) {
  const room = getRoom(roomCode);
  if (!room || !room.hasAI || room.status !== "playing") return;

  const aiPlayer = room.players.find((p) => p.id === "AI_BOT");
  if (!aiPlayer || Object.keys(aiPlayer.answers).length > 0) return;

  if (aiTimers.has(roomCode)) {
    clearTimeout(aiTimers.get(roomCode)!);
    aiTimers.delete(roomCode);
  }

  const aiAnswers = generateAIAnswers(room);
  submitAnswers(roomCode, "AI_BOT", aiAnswers);
  io.to(roomCode).emit("player_submitted", { playerId: "AI_BOT" });
}

function scheduleRoundEnd(io: SocketServer, roomCode: string, timeLimit: number) {
  if (roundTimers.has(roomCode)) {
    clearTimeout(roundTimers.get(roomCode)!);
  }
  const timer = setTimeout(() => {
    const currentRoom = getRoom(roomCode);
    if (currentRoom && currentRoom.status === "playing") {
      forceAISubmitAndCheck(io, roomCode);

      currentRoom.players.forEach((p) => {
        if (Object.keys(p.answers).length === 0) {
          submitAnswers(roomCode, p.id, {});
        }
      });

      const { results } = calculateResults(roomCode);
      io.to(roomCode).emit("round_ended", {
        results,
        letter: currentRoom.currentLetter,
        round: currentRoom.round,
        hostId: currentRoom.hostId,
      });
    }
    roundTimers.delete(roomCode);
  }, timeLimit * 1000 + 1500);
  roundTimers.set(roomCode, timer);
}

function scheduleAISubmit(io: SocketServer, roomCode: string, difficulty: Difficulty) {
  const room = getRoom(roomCode);
  if (!room || !room.hasAI) return;

  const delayRange: Record<Difficulty, [number, number]> = {
    easy: [50_000, 90_000],
    normal: [25_000, 55_000],
    hard: [8_000, 25_000],
  };

  const [minMs, maxMs] = delayRange[difficulty];
  const delay = minMs + Math.random() * (maxMs - minMs);
  const cappedDelay = Math.min(delay, room.timeLimit * 1000 - 2000);

  const timer = setTimeout(() => {
    const currentRoom = getRoom(roomCode);
    if (!currentRoom || currentRoom.status !== "playing") return;

    const aiPlayer = currentRoom.players.find((p) => p.id === "AI_BOT");
    if (aiPlayer && Object.keys(aiPlayer.answers).length > 0) return;

    const aiAnswers = generateAIAnswers(currentRoom);
    const { allSubmitted } = submitAnswers(roomCode, "AI_BOT", aiAnswers);

    io.to(roomCode).emit("player_submitted", { playerId: "AI_BOT" });

    if (allSubmitted) {
      clearRoomTimers(roomCode);
      const { results } = calculateResults(roomCode);
      io.to(roomCode).emit("round_ended", {
        results,
        letter: currentRoom.currentLetter,
        round: currentRoom.round,
        hostId: currentRoom.hostId,
      });
    }
    aiTimers.delete(roomCode);
  }, cappedDelay);
  aiTimers.set(roomCode, timer);
}

function removeFromQueue(socketId: string): boolean {
  const idx = matchmakingQueue.findIndex((e) => e.socketId === socketId);
  if (idx >= 0) {
    matchmakingQueue.splice(idx, 1);
    return true;
  }
  return false;
}

function tryMatchPlayers(io: SocketServer) {
  while (matchmakingQueue.length >= 2) {
    const p1 = matchmakingQueue.shift()!;
    const p2 = matchmakingQueue.shift()!;

    const room = createRoom(p1.socketId, p1.playerName, p1.playerSkin, "normal", false);
    p1.socket.join(room.code);

    const joinResult = joinRoom(room.code, p2.socketId, p2.playerName, p2.playerSkin);
    if (joinResult.success && joinResult.room) {
      p2.socket.join(room.code);

      const roomData = getRoomPublicData(joinResult.room);
      p1.socket.emit("match_found", { room: roomData });
      p2.socket.emit("match_found", { room: roomData });

      setTimeout(() => {
        const currentRoom = getRoom(room.code);
        if (!currentRoom || currentRoom.status !== "waiting") return;
        const humanCount = currentRoom.players.filter((p: any) => !p.isAI).length;
        if (humanCount < 2) {
          currentRoom.players.forEach((p: any) => {
            if (!p.isAI) {
              const s = io.sockets.sockets.get(p.id);
              if (s) {
                s.emit("error", { message: "الخصم غادر قبل بدء اللعبة" });
                s.leave(room.code);
              }
            }
          });
          leaveRoom(room.code, p1.socketId);
          leaveRoom(room.code, p2.socketId);
          return;
        }
        const result = startGame(room.code);
        if (result.success && result.room) {
          io.to(room.code).emit("game_started", {
            roomCode: room.code,
            letter: result.room.currentLetter,
            categories: CATEGORIES,
            timeLimit: result.room.timeLimit,
            round: result.room.round,
            maxRounds: result.room.maxRounds,
            difficulty: result.room.difficulty,
            hostId: result.room.hostId,
          });
          scheduleRoundEnd(io, room.code, result.room.timeLimit);
        }
      }, 3000);
    }
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  const io = new SocketServer(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("create_room", ({ playerName, playerSkin, difficulty, withAI }) => {
      const diff: Difficulty = ["easy", "normal", "hard"].includes(difficulty) ? difficulty : "normal";
      const room = createRoom(socket.id, playerName || "لاعب", playerSkin || "default", diff, !!withAI);
      socket.join(room.code);
      socket.emit("room_created", { room: getRoomPublicData(room) });
    });

    socket.on("join_room", ({ roomCode, playerName, playerSkin }) => {
      const result = joinRoom(roomCode, socket.id, playerName || "لاعب", playerSkin || "default");
      if (!result.success || !result.room) {
        socket.emit("error", { message: result.error });
        return;
      }
      socket.join(result.room.code);
      socket.emit("room_joined", { room: getRoomPublicData(result.room) });
      socket.to(result.room.code).emit("room_updated", { room: getRoomPublicData(result.room) });
    });

    socket.on("find_match", ({ playerName, playerSkin }) => {
      removeFromQueue(socket.id);
      matchmakingQueue.push({
        socketId: socket.id,
        socket,
        playerName: playerName || "لاعب",
        playerSkin: playerSkin || "default",
        joinedAt: Date.now(),
      });
      socket.emit("matchmaking_status", { status: "searching", queueSize: matchmakingQueue.length });
      tryMatchPlayers(io);
    });

    socket.on("cancel_match", () => {
      const wasInQueue = removeFromQueue(socket.id);
      if (wasInQueue) {
        socket.emit("matchmaking_status", { status: "cancelled" });
      }
    });

    socket.on("start_game", ({ roomCode }) => {
      const room = getRoom(roomCode);
      if (!room || room.hostId !== socket.id) {
        socket.emit("error", { message: "ليس لديك صلاحية لبدء اللعبة" });
        return;
      }
      const result = startGame(roomCode);
      if (!result.success || !result.room) {
        socket.emit("error", { message: result.error });
        return;
      }

      io.to(roomCode).emit("game_started", {
        letter: result.room.currentLetter,
        categories: CATEGORIES,
        timeLimit: result.room.timeLimit,
        round: result.room.round,
        maxRounds: result.room.maxRounds,
        difficulty: result.room.difficulty,
        hostId: result.room.hostId,
      });

      scheduleRoundEnd(io, roomCode, result.room.timeLimit);
      scheduleAISubmit(io, roomCode, result.room.difficulty);
    });

    socket.on("submit_answers", ({ roomCode, answers }) => {
      const room = getRoom(roomCode);
      if (!room || room.status !== "playing") return;

      const { allSubmitted } = submitAnswers(roomCode, socket.id, answers);
      socket.to(roomCode).emit("player_submitted", { playerId: socket.id });
      socket.emit("answers_received", { success: true });

      if (room.hasAI) {
        forceAISubmitAndCheck(io, roomCode);
      }

      const updatedRoom = getRoom(roomCode)!;
      const allDone = updatedRoom.submittedCount >= updatedRoom.players.length;

      if (allDone) {
        clearRoomTimers(roomCode);
        const { results } = calculateResults(roomCode);
        io.to(roomCode).emit("round_ended", {
          results,
          letter: updatedRoom.currentLetter,
          round: updatedRoom.round,
          hostId: updatedRoom.hostId,
        });
      }
    });

    socket.on("next_round", ({ roomCode }) => {
      const room = getRoom(roomCode);
      if (!room || room.hostId !== socket.id) return;

      const { finished, room: updatedRoom } = nextRound(roomCode);

      if (finished) {
        const finalScores = updatedRoom.roundResults;
        if (finalScores && finalScores.length > 0) {
          for (let i = 0; i < finalScores.length; i++) {
            const p = finalScores[i];
            if (p.isAI) continue;
            upsertLeaderboard({
              playerName: p.playerName,
              skin: "default",
              score: p.totalScore || 0,
              won: i === 0,
            }).catch((err) => console.error("Leaderboard upsert error:", err));
          }
        }
        io.to(roomCode).emit("game_finished", {
          finalScores,
          hostId: updatedRoom.hostId,
        });
      } else {
        io.to(roomCode).emit("game_started", {
          letter: updatedRoom.currentLetter,
          categories: CATEGORIES,
          timeLimit: updatedRoom.timeLimit,
          round: updatedRoom.round,
          maxRounds: updatedRoom.maxRounds,
          difficulty: updatedRoom.difficulty,
          hostId: updatedRoom.hostId,
        });

        scheduleRoundEnd(io, roomCode, updatedRoom.timeLimit);
        scheduleAISubmit(io, roomCode, updatedRoom.difficulty);
      }
    });

    socket.on("chat_message", ({ roomCode, message, playerName }) => {
      if (!roomCode || typeof message !== "string" || !message.trim()) return;
      const room = getRoom(roomCode);
      if (!room) return;
      const isInRoom = room.players.some((p) => p.id === socket.id);
      if (!isInRoom) return;
      io.to(roomCode).emit("chat_message", {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        playerId: socket.id,
        playerName: playerName || "لاعب",
        message: message.trim().slice(0, 200),
        timestamp: Date.now(),
      });
    });

    socket.on("leave_room", ({ roomCode }) => {
      const updatedRoom = leaveRoom(roomCode, socket.id);
      socket.leave(roomCode);
      if (updatedRoom) {
        io.to(roomCode).emit("room_updated", { room: getRoomPublicData(updatedRoom) });
      }
    });

    socket.on("voice_offer", ({ roomCode, targetId, offer }) => {
      const room = getRoom(roomCode);
      if (!room) return;
      if (!room.players.some((p) => p.id === socket.id)) return;
      if (!room.players.some((p) => p.id === targetId)) return;
      io.to(targetId).emit("voice_offer", { senderId: socket.id, offer });
    });

    socket.on("voice_answer", ({ roomCode, targetId, answer }) => {
      const room = getRoom(roomCode);
      if (!room) return;
      if (!room.players.some((p) => p.id === socket.id)) return;
      if (!room.players.some((p) => p.id === targetId)) return;
      io.to(targetId).emit("voice_answer", { senderId: socket.id, answer });
    });

    socket.on("voice_ice_candidate", ({ roomCode, targetId, candidate }) => {
      const room = getRoom(roomCode);
      if (!room) return;
      if (!room.players.some((p) => p.id === socket.id)) return;
      if (!room.players.some((p) => p.id === targetId)) return;
      io.to(targetId).emit("voice_ice_candidate", { senderId: socket.id, candidate });
    });

    socket.on("voice_join", ({ roomCode }) => {
      const room = getRoom(roomCode);
      if (!room || !room.players.some((p) => p.id === socket.id)) return;
      socket.to(roomCode).emit("voice_peer_joined", { peerId: socket.id });
    });

    socket.on("voice_leave", ({ roomCode }) => {
      const room = getRoom(roomCode);
      if (!room || !room.players.some((p) => p.id === socket.id)) return;
      socket.to(roomCode).emit("voice_peer_left", { peerId: socket.id });
    });

    socket.on("disconnect", () => {
      console.log("Player disconnected:", socket.id);
      removeFromQueue(socket.id);
      const room = findRoomByPlayer(socket.id);
      if (room) {
        socket.to(room.code).emit("voice_peer_left", { peerId: socket.id });
        const updatedRoom = leaveRoom(room.code, socket.id);
        if (updatedRoom) {
          io.to(room.code).emit("room_updated", { room: getRoomPublicData(updatedRoom) });
        } else {
          clearRoomTimers(room.code);
        }
      }
    });
  });

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  app.get("/api/leaderboard", async (_req, res) => {
    try {
      const entries = await getTopLeaderboard(50);
      res.json(entries);
    } catch (err) {
      console.error("Leaderboard fetch error:", err);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });


  return httpServer;
}
