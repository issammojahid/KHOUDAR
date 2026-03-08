import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function getTopLeaderboard(limit = 50): Promise<any[]> {
  const result = await pool.query(
    `SELECT player_name, skin, best_score, total_wins, total_games, last_played
     FROM leaderboard
     ORDER BY best_score DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function upsertLeaderboard(entry: {
  playerName: string;
  skin: string;
  score: number;
  won: boolean;
}): Promise<void> {
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
}

export default pool;
