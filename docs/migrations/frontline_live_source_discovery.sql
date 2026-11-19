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
-- Deployment is two-phase: do NOT deactivate legacy rows in this
-- backwards-compatible schema migration. The old production server needs
-- them until the search provider and new code are ready for deployment.
-- The new server filters is_live_discovered=true and will NOT suggest old rows.
-- Once deployed and verified, operators can separately archive old rows
-- with the explicit post-launch archive SQL. Historical selections remain intact.
