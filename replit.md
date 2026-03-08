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
  lobby.tsx         # Game lobby (create/join rooms)
  game.tsx          # Active gameplay screen
  results.tsx       # Round results
  final.tsx         # Final game results
  _layout.tsx       # Root layout with all providers

context/
  PlayerContext.tsx  # Player data (name, coins, skins, stats)
  SocketContext.tsx  # Socket.io connection management

server/
  index.ts          # Express server setup
  routes.ts         # Socket.io game event handlers
  gameManager.ts    # Room/game state management
  arabicWords.ts    # Arabic word database + letters

components/
  PlayerAvatar.tsx  # Reusable character avatar
  ErrorBoundary.tsx # Error boundary wrapper
```

## Game Flow

1. Player sets name in Settings
2. Player creates or joins a room via Lobby
3. Host starts game (min 2 players, max 8)
4. A random Arabic letter is shown — 120 second timer starts
5. Players fill in 8 categories (name, animal, fruit, etc.)
6. On submit or timer end: scores calculated
   - Correct (starts with letter, unique) = 3 pts
   - Duplicate = 0 pts
   - Empty/wrong letter = 0 pts
7. After 3 rounds: final leaderboard shown, coins awarded
8. Coins used to buy character skins in the Shop

## Socket Events

Client → Server: `create_room`, `join_room`, `start_game`, `submit_answers`, `next_round`, `leave_room`

Server → Client: `room_created`, `room_joined`, `room_updated`, `game_started`, `round_ended`, `game_finished`, `error`

## Design

- Theme: Deep indigo/purple with gold accents, cartoon game aesthetic
- Font: Inter (pre-loaded)
- RTL: Arabic text uses `textAlign: "right"` throughout
