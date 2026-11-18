-- Post-release ONLY: run AFTER the Frontline live-source build is
-- verified in production. Archive the old 15 seeded website suggestions.
-- Keeps historical project selections for audit and rollback.
UPDATE frontline.design_sources
 SET active=false,updated_at=NOW()
 WHERE is_live_discovered=false AND active=true;
