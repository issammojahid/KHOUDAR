import type { Express } from "express";
import { createServer, type Server } from "node:http";
import { Server as SocketServer } from "socket.io";
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
  type Difficulty,
} from "./gameManager";
import { CATEGORIES } from "./arabicWords";

const roundTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleRoundEnd(io: SocketServer, roomCode: string, timeLimit: number) {
  if (roundTimers.has(roomCode)) {
    clearTimeout(roundTimers.get(roomCode)!);
  }
  const timer = setTimeout(() => {
    const currentRoom = getRoom(roomCode);
    if (currentRoom && currentRoom.status === "playing") {
      const { results } = calculateResults(roomCode);
      io.to(roomCode).emit("round_ended", {
        results,
        letter: currentRoom.currentLetter,
        round: currentRoom.round,
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
    easy:   [50_000, 90_000],
    normal: [25_000, 55_000],
    hard:   [8_000,  25_000],
  };

  const [minMs, maxMs] = delayRange[difficulty];
  const delay = minMs + Math.random() * (maxMs - minMs);
  const cappedDelay = Math.min(delay, room.timeLimit * 1000 - 2000);

  setTimeout(() => {
    const currentRoom = getRoom(roomCode);
    if (!currentRoom || currentRoom.status !== "playing") return;

    const aiAnswers = generateAIAnswers(currentRoom);
    const { allSubmitted } = submitAnswers(roomCode, "AI_BOT", aiAnswers);

    io.to(roomCode).emit("player_submitted", { playerId: "AI_BOT" });

    if (allSubmitted) {
      if (roundTimers.has(roomCode)) {
        clearTimeout(roundTimers.get(roomCode)!);
        roundTimers.delete(roomCode);
      }
      const { results } = calculateResults(roomCode);
      io.to(roomCode).emit("round_ended", {
        results,
        letter: currentRoom.currentLetter,
        round: currentRoom.round,
      });
    }
  }, cappedDelay);
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

      if (allSubmitted) {
        if (roundTimers.has(roomCode)) {
          clearTimeout(roundTimers.get(roomCode)!);
          roundTimers.delete(roomCode);
        }
        const { results } = calculateResults(roomCode);
        io.to(roomCode).emit("round_ended", {
          results,
          letter: room.currentLetter,
          round: room.round,
        });
      }
    });

    socket.on("next_round", ({ roomCode }) => {
      const room = getRoom(roomCode);
      if (!room || room.hostId !== socket.id) return;

      const { finished, room: updatedRoom } = nextRound(roomCode);

      if (finished) {
        io.to(roomCode).emit("game_finished", { finalScores: updatedRoom.roundResults });
      } else {
        io.to(roomCode).emit("game_started", {
          letter: updatedRoom.currentLetter,
          categories: CATEGORIES,
          timeLimit: updatedRoom.timeLimit,
          round: updatedRoom.round,
          maxRounds: updatedRoom.maxRounds,
          difficulty: updatedRoom.difficulty,
        });

        scheduleRoundEnd(io, roomCode, updatedRoom.timeLimit);
        scheduleAISubmit(io, roomCode, updatedRoom.difficulty);
      }
    });

    socket.on("leave_room", ({ roomCode }) => {
      const updatedRoom = leaveRoom(roomCode, socket.id);
      socket.leave(roomCode);
      if (updatedRoom) {
        io.to(roomCode).emit("room_updated", { room: getRoomPublicData(updatedRoom) });
      }
    });

    socket.on("disconnect", () => {
      console.log("Player disconnected:", socket.id);
    });
  });

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

  return httpServer;
}
