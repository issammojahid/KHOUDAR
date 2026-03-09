import pg from "pg";

const hasDB = !!process.env.DATABASE_URL;
if (!hasDB) {
  console.warn("⚠️ DATABASE_URL not set. Leaderboard will be disabled (read-only empty).");
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  // Only connect if we have a URL to avoid immediate crash
  max: hasDB ? 10 : 0,
});

export async function getTopLeaderboard(limit = 50): Promise<any[]> {
  if (!hasDB) return [];
  try {
    const result = await pool.query(
      `SELECT player_name, skin, best_score, total_wins, total_games, last_played
       FROM leaderboard
       ORDER BY best_score DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (err) {
    console.error("DB Query error:", err);
    return [];
  }
}

export async function upsertLeaderboard(entry: {
  playerName: string;
  skin: string;
  score: number;
  won: boolean;
}): Promise<void> {
  if (!hasDB) return;
  try {
    await pool.query(
      `INSERT INTO leaderboard (player_name, skin, best_score, total_wins, total_games, last_played)
       VALUES ($1, $2, $3, $4, 1, NOW())
       ON CONFLICT (player_name) DO UPDATE SET
         skin = $2,
         best_score = GREATEST(leaderboard.best_score, $3),
         total_wins = leaderboard.total_wins + $4,
         total_games = leaderboard.total_games + 1,
         last_played = NOW()`,
      [entry.playerName, entry.skin, entry.score, entry.won ? 1 : 0]
    );
  } catch (err) {
    console.error("DB Upsert error:", err);
  }
}

export default pool;
