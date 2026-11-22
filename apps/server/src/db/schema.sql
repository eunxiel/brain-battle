CREATE TABLE IF NOT EXISTS players (
  id              UUID PRIMARY KEY,
  username        TEXT        NOT NULL,
  avatar_id       TEXT        NOT NULL,
  xp              INTEGER     NOT NULL DEFAULT 0,
  level           INTEGER     NOT NULL DEFAULT 1,
  total_matches   INTEGER     NOT NULL DEFAULT 0,
  wins            INTEGER     NOT NULL DEFAULT 0,
  losses          INTEGER     NOT NULL DEFAULT 0,
  draws           INTEGER     NOT NULL DEFAULT 0,
  best_score      INTEGER     NOT NULL DEFAULT 0,
  total_correct   INTEGER     NOT NULL DEFAULT 0,
  total_wrong     INTEGER     NOT NULL DEFAULT 0,
  avg_response_ms INTEGER     NOT NULL DEFAULT 0,
  achievements    TEXT[]      NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches (
  id            UUID PRIMARY KEY,
  mode          TEXT        NOT NULL,
  solo          BOOLEAN     NOT NULL DEFAULT false,
  rounds_played INTEGER     NOT NULL,
  played_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS match_players (
  match_id          UUID        NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id         UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  score             INTEGER     NOT NULL,
  correct           INTEGER     NOT NULL,
  wrong             INTEGER     NOT NULL,
  best_streak       INTEGER     NOT NULL,
  avg_response_ms   INTEGER     NOT NULL,
  lives_left        INTEGER     NOT NULL,
  outcome           TEXT        NOT NULL,
  opponent_name     TEXT        NOT NULL,
  opponent_avatar   TEXT        NOT NULL,
  xp_gained         INTEGER     NOT NULL,
  played_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);

CREATE TABLE IF NOT EXISTS daily_runs (
  player_id  UUID        NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  date_key   DATE        NOT NULL,
  best_score INTEGER     NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, date_key)
);

CREATE INDEX IF NOT EXISTS match_players_player_idx ON match_players (player_id, played_at DESC);
CREATE INDEX IF NOT EXISTS match_players_score_idx  ON match_players (played_at DESC, score DESC);
