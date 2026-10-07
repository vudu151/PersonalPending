-- Sổ chi tiêu tháng: cấu trúc cơ sở dữ liệu D1 (SQLite)
CREATE TABLE IF NOT EXISTS months (
  ym        TEXT PRIMARY KEY,            -- 'YYYY-MM'
  income    INTEGER NOT NULL DEFAULT 0,  -- thu nhập tháng (đồng)
  save_pct  REAL    NOT NULL DEFAULT 0.2 -- mục tiêu tiết kiệm (0..0.9)
);

CREATE TABLE IF NOT EXISTS budgets (
  ym      TEXT NOT NULL,
  cat     TEXT NOT NULL,                 -- mã danh mục: nha, an, dilai, ...
  amount  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ym, cat)
);

CREATE TABLE IF NOT EXISTS transactions (
  id          TEXT PRIMARY KEY,
  d           TEXT NOT NULL,             -- 'YYYY-MM-DD'
  ym          TEXT NOT NULL,             -- 'YYYY-MM'
  amt         INTEGER NOT NULL,
  cat         TEXT NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tx_ym ON transactions(ym);

CREATE TABLE IF NOT EXISTS goals (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  target    INTEGER NOT NULL,
  saved     INTEGER NOT NULL DEFAULT 0,
  deadline  TEXT NOT NULL DEFAULT ''     -- 'YYYY-MM' hoặc rỗng
);
