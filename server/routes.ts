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
} from "./gameManager";
import { CATEGORIES } from "./arabicWords";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  const io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log("Player connected:", socket.id);

    socket.on("create_room", ({ playerName, playerSkin }) => {
      const room = createRoom(socket.id, playerName || "لاعب", playerSkin || "default");
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
      });

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
      }, result.room.timeLimit * 1000 + 2000);

      (socket as any)._roundTimer = timer;
    });

    socket.on("submit_answers", ({ roomCode, answers }) => {
      const room = getRoom(roomCode);
      if (!room || room.status !== "playing") return;

      const { allSubmitted } = submitAnswers(roomCode, socket.id, answers);

      socket.to(roomCode).emit("player_submitted", { playerId: socket.id });
      socket.emit("answers_received", { success: true });

      if (allSubmitted) {
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
        io.to(roomCode).emit("game_finished", {
          finalScores: updatedRoom.roundResults,
        });
      } else {
        io.to(roomCode).emit("game_started", {
          letter: updatedRoom.currentLetter,
          categories: CATEGORIES,
          timeLimit: updatedRoom.timeLimit,
          round: updatedRoom.round,
          maxRounds: updatedRoom.maxRounds,
        });

        setTimeout(() => {
          const currentRoom = getRoom(roomCode);
          if (currentRoom && currentRoom.status === "playing") {
            const { results } = calculateResults(roomCode);
            io.to(roomCode).emit("round_ended", {
              results,
              letter: currentRoom.currentLetter,
              round: currentRoom.round,
            });
          }
        }, updatedRoom.timeLimit * 1000 + 2000);
      }
    });

    socket.on("disconnect", () => {
      console.log("Player disconnected:", socket.id);
    });

    socket.on("leave_room", ({ roomCode }) => {
      const updatedRoom = leaveRoom(roomCode, socket.id);
      socket.leave(roomCode);
      if (updatedRoom) {
        io.to(roomCode).emit("room_updated", { room: getRoomPublicData(updatedRoom) });
      }
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  return httpServer;
}
