PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS performance_categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE IF NOT EXISTS performance_tags (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER
);

CREATE TABLE IF NOT EXISTS performances (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  started_at_ms INTEGER NOT NULL CHECK (started_at_ms >= 0),
  city TEXT NOT NULL DEFAULT '',
  venue TEXT NOT NULL DEFAULT '',
  remark TEXT NOT NULL DEFAULT '',
  ticket_price_amount TEXT NOT NULL DEFAULT '0',
  ticket_price_currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(ticket_price_currency) = 3),
  paid_price_amount TEXT NOT NULL DEFAULT '0',
  paid_price_currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(paid_price_currency) = 3),
  other_cost_amount TEXT NOT NULL DEFAULT '0',
  other_cost_currency TEXT NOT NULL DEFAULT 'CNY' CHECK (length(other_cost_currency) = 3),
  seat TEXT NOT NULL DEFAULT '',
  rating REAL NOT NULL DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
  status INTEGER NOT NULL DEFAULT 0 CHECK (status IN (0, 1, 2, 3)),
  category_id TEXT REFERENCES performance_categories(id) ON UPDATE CASCADE ON DELETE SET NULL,
  latitude REAL,
  longitude REAL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  deleted_at_ms INTEGER,
  CHECK ((latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS performance_tag_links (
  performance_id TEXT NOT NULL REFERENCES performances(id) ON UPDATE CASCADE ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES performance_tags(id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at_ms INTEGER NOT NULL,
  PRIMARY KEY (performance_id, tag_id)
);

CREATE TABLE IF NOT EXISTS performance_facets (
  performance_id TEXT NOT NULL REFERENCES performances(id) ON UPDATE CASCADE ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('artist', 'guest', 'play', 'channel', 'friend', 'company')),
  value TEXT NOT NULL CHECK (length(trim(value)) > 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (performance_id, kind, value)
);

CREATE TABLE IF NOT EXISTS performance_songs (
  id TEXT PRIMARY KEY NOT NULL,
  performance_id TEXT NOT NULL REFERENCES performances(id) ON UPDATE CASCADE ON DELETE CASCADE,
  artist_name TEXT NOT NULL DEFAULT '',
  titles_json TEXT NOT NULL DEFAULT '[]',
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY NOT NULL,
  performance_id TEXT NOT NULL REFERENCES performances(id) ON UPDATE CASCADE ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('poster', 'poster_thumb', 'ticket_original', 'ticket_thumb')),
  relative_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  sha256 TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  created_at_ms INTEGER NOT NULL,
  UNIQUE (performance_id, kind)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_performances_started_at
  ON performances(started_at_ms);

CREATE INDEX IF NOT EXISTS idx_performances_status_started_at
  ON performances(status, started_at_ms);

CREATE INDEX IF NOT EXISTS idx_performances_category
  ON performances(category_id, started_at_ms);

CREATE INDEX IF NOT EXISTS idx_performance_tag_links_tag
  ON performance_tag_links(tag_id, performance_id);

CREATE INDEX IF NOT EXISTS idx_performance_facets_kind_value
  ON performance_facets(kind, value, performance_id);

CREATE INDEX IF NOT EXISTS idx_media_assets_performance
  ON media_assets(performance_id);
