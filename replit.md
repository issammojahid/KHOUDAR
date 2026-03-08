# حروف المغرب - Huroof Al Maghrib

A real-time multiplayer Arabic word challenge game built with Expo React Native + Express + Socket.io.

## Architecture

- **Frontend**: Expo React Native (file-based routing via expo-router)
- **Backend**: Express + Socket.io (port 5000)
- **State**: AsyncStorage for player data; in-memory on server for rooms

## Project Structure

```
app/
  (tabs)/
    _layout.tsx     # Tab navigation (Home, Leaderboard, Shop, Settings)
    index.tsx       # Home screen
    leaderboard.tsx # All-time leaderboard
    shop.tsx        # Character skin shop
    settings.tsx    # Player settings
  lobby.tsx         # Game lobby (create/join rooms, difficulty, AI toggle)
  game.tsx          # Active gameplay screen (with chat)
  results.tsx       # Round results
  final.tsx         # Final game results
  _layout.tsx       # Root layout with all providers

context/
  PlayerContext.tsx  # Player data (name, coins, skins, stats, difficulty)
  SocketContext.tsx  # Socket.io connection management

server/
  index.ts          # Express server setup
  routes.ts         # Socket.io game event handlers + chat
  gameManager.ts    # Room/game state management + AI logic
  arabicWords.ts    # Arabic word database + AI answer generation

components/
  PlayerAvatar.tsx  # Reusable character avatar
  ChatOverlay.tsx   # In-game text chat overlay
  ErrorBoundary.tsx # Error boundary wrapper
```

## Game Flow

1. Player sets name in Settings
2. Player creates or joins a room via Lobby
3. Lobby: choose difficulty (Easy/Normal/Hard) and toggle AI opponent
4. Host starts game
5. A random Arabic letter is shown — timer starts (90/120/150s by difficulty)
6. Players fill in 8 categories (name, animal, fruit, etc.)
7. On submit or timer end: scores calculated
   - Correct (starts with letter, exists in database, unique) = 3 pts
   - Duplicate (same as another player) = 0 pts
   - Empty/wrong letter/not in database = 0 pts
8. After 3 rounds: final leaderboard shown, coins awarded
9. Coins used to buy character skins in the Shop

## AI Opponent

- Toggle in lobby to add AI bot player
- Difficulty affects AI behavior:
  - Easy: 35% correct chance, submits slowly (50-90s delay)
  - Normal: 65% correct chance, medium speed (25-55s delay)
  - Hard: 92% correct chance, fast (8-25s delay)
- When human submits, AI auto-submits immediately (no waiting for timer)
- AI answers drawn from the word database

## Word Validation

- Answers must start with the correct letter AND exist in the database
- Words not in arabicWords.ts are scored as 0 points
- Database covers all Arabic letters across 8 categories

## Chat

- In-game text chat via Socket.io
- Chat button visible during gameplay
- Server validates sender is in the room before broadcasting

## Online Matchmaking

- "Play Online" button in lobby joins a server-side queue
- When 2 players are in queue, server auto-creates a room and starts the game after 3s
- Players see a searching animation while waiting; can cancel anytime
- Matchmaking games use "normal" difficulty by default

## Trial Reward

- One-time welcome bonus of 200 coins shown as a modal on first app open
- Tracked via `claimedTrialReward` in PlayerData (persisted in AsyncStorage)
- Cannot be claimed more than once

## Socket Events

Client -> Server: `create_room`, `join_room`, `find_match`, `cancel_match`, `start_game`, `submit_answers`, `next_round`, `leave_room`, `chat_message`

Server -> Client: `room_created`, `room_joined`, `room_updated`, `game_started`, `round_ended`, `game_finished`, `player_submitted`, `match_found`, `matchmaking_status`, `chat_message`, `error`

## Design

- Theme: Deep indigo/purple with gold accents, cartoon game aesthetic
- Font: Inter (pre-loaded)
- RTL: Arabic text uses `textAlign: "right"` throughout
- Difficulty colors: Easy=green, Normal=gold, Hard=red
