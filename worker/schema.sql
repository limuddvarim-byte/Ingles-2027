-- Banco D1 do servidor de sincronização da tríade "Inglês".
CREATE TABLE IF NOT EXISTS records (
  c TEXT NOT NULL,            -- coleção: phrases | launcher | watch | draft | settings
  id TEXT NOT NULL,
  u INTEGER NOT NULL,         -- updatedAt do cliente (Last-Write-Wins)
  d INTEGER NOT NULL DEFAULT 0, -- excluído (tombstone)
  data TEXT NOT NULL,
  ts INTEGER NOT NULL,        -- cursor do servidor (ordem de chegada)
  PRIMARY KEY (c, id)
);
CREATE INDEX IF NOT EXISTS records_ts ON records (ts);

CREATE TABLE IF NOT EXISTS audio (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  data BLOB NOT NULL,
  created INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL);
INSERT OR IGNORE INTO meta (k, v) VALUES ('clock', 0);
