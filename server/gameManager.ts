import { CATEGORIES, getRandomLetter, getAIAnswer, arabicWordsDB } from "./arabicWords";

export type Difficulty = "easy" | "normal" | "hard";

export interface Player {
  id: string;
  name: string;
  skin: string;
  score: number;
  totalScore: number;
  ready: boolean;
  answers: Record<string, string>;
  coins: number;
  isAI: boolean;
}

export interface Room {
  id: string;
  code: string;
  hostId: string;
  players: Player[];
  status: "waiting" | "playing" | "results" | "finished";
  currentLetter: string;
  round: number;
  maxRounds: number;
  timeLimit: number;
  roundStartTime: number | null;
  submittedCount: number;
  roundResults: RoundResult[] | null;
  difficulty: Difficulty;
  hasAI: boolean;
}

export interface RoundResult {
  playerId: string;
  playerName: string;
  skin: string;
  isAI: boolean;
  answers: Record<string, { text: string; points: number; status: "correct" | "duplicate" | "empty" }>;
  roundScore: number;
  totalScore: number;
}

const rooms = new Map<string, Room>();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  if (rooms.has(code)) return generateRoomCode();
  return code;
}

export function createRoom(
  hostId: string,
  hostName: string,
  hostSkin: string,
  difficulty: Difficulty = "normal",
  withAI: boolean = false
): Room {
  const code = generateRoomCode();
  const room: Room = {
    id: code,
    code,
    hostId,
    players: [
      {
        id: hostId,
        name: hostName,
        skin: hostSkin,
        score: 0,
        totalScore: 0,
        ready: false,
        answers: {},
        coins: 0,
        isAI: false,
      },
    ],
    status: "waiting",
    currentLetter: "",
    round: 0,
    maxRounds: 3,
    timeLimit: difficulty === "easy" ? 150 : difficulty === "hard" ? 90 : 120,
    roundStartTime: null,
    submittedCount: 0,
    roundResults: null,
    difficulty,
    hasAI: withAI,
  };

  if (withAI) {
    const aiNames: Record<Difficulty, string> = {
      easy: "روبوت مبتدئ",
      normal: "روبوت ذكي",
      hard: "روبوت خبير",
    };
    const aiSkins: Record<Difficulty, string> = {
      easy: "default",
      normal: "scholar",
      hard: "legend",
    };
    room.players.push({
      id: "AI_BOT",
      name: aiNames[difficulty],
      skin: aiSkins[difficulty],
      score: 0,
      totalScore: 0,
      ready: true,
      answers: {},
      coins: 0,
      isAI: true,
    });
  }

  rooms.set(code, room);
  return room;
}

export function joinRoom(
  roomCode: string,
  playerId: string,
  playerName: string,
  playerSkin: string
): { success: boolean; room?: Room; error?: string } {
  const room = rooms.get(roomCode.toUpperCase());
  if (!room) return { success: false, error: "الغرفة غير موجودة" };
  if (room.status !== "waiting") return { success: false, error: "اللعبة بدأت بالفعل" };
  if (room.players.filter((p) => !p.isAI).length >= 8) return { success: false, error: "الغرفة ممتلئة" };
  if (room.players.find((p) => p.id === playerId)) {
    return { success: true, room };
  }

  room.players.push({
    id: playerId,
    name: playerName,
    skin: playerSkin,
    score: 0,
    totalScore: 0,
    ready: false,
    answers: {},
    coins: 0,
    isAI: false,
  });

  return { success: true, room };
}

export function leaveRoom(roomCode: string, playerId: string): Room | null {
  const room = rooms.get(roomCode);
  if (!room) return null;
  room.players = room.players.filter((p) => p.id !== playerId);
  if (room.players.filter((p) => !p.isAI).length === 0) {
    rooms.delete(roomCode);
    return null;
  }
  if (room.hostId === playerId) {
    const human = room.players.find((p) => !p.isAI);
    if (human) room.hostId = human.id;
  }
  return room;
}

export function startGame(roomCode: string): { success: boolean; room?: Room; error?: string } {
  const room = rooms.get(roomCode);
  if (!room) return { success: false, error: "الغرفة غير موجودة" };
  const humanCount = room.players.filter((p) => !p.isAI).length;
  if (humanCount < 1) return { success: false, error: "لا يوجد لاعبون بشريون" };

  room.status = "playing";
  room.round = 1;
  room.currentLetter = getRandomLetter(room.difficulty);
  room.roundStartTime = Date.now();
  room.submittedCount = 0;

  room.players.forEach((p) => {
    p.answers = {};
    p.score = 0;
  });

  return { success: true, room };
}

export function generateAIAnswers(room: Room): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const cat of CATEGORIES) {
    answers[cat] = getAIAnswer(room.currentLetter, cat, room.difficulty);
  }
  return answers;
}

export function submitAnswers(
  roomCode: string,
  playerId: string,
  answers: Record<string, string>
): { allSubmitted: boolean; room: Room } {
  const room = rooms.get(roomCode)!;
  const player = room.players.find((p) => p.id === playerId);
  if (player && Object.keys(player.answers).length === 0) {
    player.answers = answers;
    room.submittedCount++;
  }
  const allSubmitted = room.submittedCount >= room.players.length;
  return { allSubmitted, room };
}

export function calculateResults(roomCode: string): { room: Room; results: RoundResult[] } {
  const room = rooms.get(roomCode)!;
  const results: RoundResult[] = [];

  for (const player of room.players) {
    const playerResult: RoundResult = {
      playerId: player.id,
      playerName: player.name,
      skin: player.skin,
      isAI: player.isAI,
      answers: {},
      roundScore: 0,
      totalScore: 0,
    };

    for (const category of CATEGORIES) {
      const answer = (player.answers[category] || "").trim();
      if (!answer) {
        playerResult.answers[category] = { text: "", points: 0, status: "empty" };
        continue;
      }

      const firstChar = answer[0];
      const startsWithLetter = firstChar === room.currentLetter;

      if (!startsWithLetter) {
        playerResult.answers[category] = { text: answer, points: 0, status: "empty" };
        continue;
      }

      const dbWords = arabicWordsDB[room.currentLetter]?.[category] || [];
      const isInDB = dbWords.some(
        (w) => w.trim().toLowerCase() === answer.toLowerCase()
      );

      if (!isInDB) {
        playerResult.answers[category] = { text: answer, points: 0, status: "empty" };
        continue;
      }

      const isDuplicate = room.players.some(
        (other) =>
          other.id !== player.id &&
          (other.answers[category] || "").trim().toLowerCase() === answer.toLowerCase()
      );

      if (isDuplicate) {
        playerResult.answers[category] = { text: answer, points: 0, status: "duplicate" };
      } else {
        playerResult.answers[category] = { text: answer, points: 3, status: "correct" };
        playerResult.roundScore += 3;
      }
    }

    player.totalScore += playerResult.roundScore;
    playerResult.totalScore = player.totalScore;
    results.push(playerResult);
  }

  results.sort((a, b) => b.totalScore - a.totalScore);

  room.roundResults = results;
  room.status = "results";

  return { room, results };
}

export function nextRound(roomCode: string): { finished: boolean; room: Room } {
  const room = rooms.get(roomCode)!;

  if (room.round >= room.maxRounds) {
    room.status = "finished";
    return { finished: true, room };
  }

  room.round++;
  room.currentLetter = getRandomLetter(room.difficulty);
  room.roundStartTime = Date.now();
  room.submittedCount = 0;
  room.status = "playing";

  room.players.forEach((p) => {
    p.answers = {};
    p.score = 0;
  });

  return { finished: false, room };
}

export function getRoom(roomCode: string): Room | undefined {
  return rooms.get(roomCode);
}

export function getRoomPublicData(room: Room) {
  return {
    code: room.code,
    hostId: room.hostId,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      skin: p.skin,
      totalScore: p.totalScore,
      ready: p.ready,
      isAI: p.isAI,
    })),
    status: room.status,
    currentLetter: room.currentLetter,
    round: room.round,
    maxRounds: room.maxRounds,
    timeLimit: room.timeLimit,
    roundResults: room.roundResults,
    difficulty: room.difficulty,
    hasAI: room.hasAI,
  };
}
