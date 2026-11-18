-- M08 live-source-only discovery. Archive rather than erase historical selections.
-- Public inspiration recommendations must no longer read static seed records.
ALTER TABLE frontline.design_sources
  ADD COLUMN IF NOT EXISTS is_live_discovered boolean NOT NULL DEFAULT false;
ALTER TABLE frontline.design_sources
  ADD COLUMN IF NOT EXISTS source_provider text NOT NULL DEFAULT '';
ALTER TABLE frontline.design_sources
  ADD COLUMN IF NOT EXISTS source_kind text NOT NULL DEFAULT '';
ALTER TABLE frontline.design_sources
  ADD COLUMN IF NOT EXISTS source_indexed_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_frontline_source_indexed
  ON frontline.design_sources(source_indexed_at DESC)
  WHERE active=true AND is_live_discovered=true;
UPDATE frontline.design_sources
 SET active=false,updated_at=NOW()
 WHERE is_live_discovered=false AND active=true;
-- No DELETE: preserves old per-project rows and avoids breaking foreign keys.
-- Old sources are never returned or advertised as live source results.
