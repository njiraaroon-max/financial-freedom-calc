-- ============================================================
-- Hierarchical RLS performance benchmark (Phase 1 sanity check)
-- ============================================================
-- Purpose: confirm the recursive CTE in fa_can_view_data_of() stays
-- fast enough at Victory's expected scale (200 FAs, 1000 clients).
--
-- HOW TO RUN
-- ----------
--   1. Open Supabase Dashboard → SQL Editor → New query
--   2. Paste this entire file
--   3. Click Run
--   4. Read the EXPLAIN ANALYZE blocks in the Results panel
--   5. Last statement drops the perf_test schema, so nothing
--      permanent stays in your DB.
--
-- WHY NOT TEMP TABLES
-- -------------------
-- Supabase's SQL Editor auto-commits each statement separately.
-- TEMP tables created in one statement are gone by the next, so
-- bench 2-6 would fail with "relation does not exist". We use a
-- regular schema (perf_test) instead and drop it at the end.
--
-- WHAT "GOOD" LOOKS LIKE
-- ----------------------
--   - Bench 1 (Ultra recursive CTE):    < 5 ms
--   - Bench 2 (Pro recursive CTE):      < 2 ms
--   - Bench 3 (Basic recursive CTE):    < 1 ms
--   - Bench 4 (Ultra clients via CTE):  < 50 ms
--   - Bench 5 (Pro clients via CTE):    < 10 ms
--   - Bench 6 (100x stress):            total < 3 s
--
-- If any benchmark is 10x slower than the target, switch
-- fa_can_view_data_of() to a materialized closure table — see notes
-- at the bottom of this file.
-- ============================================================

-- ── 0. Reset ──────────────────────────────────────────────────
DROP SCHEMA IF EXISTS perf_test CASCADE;
CREATE SCHEMA perf_test;

-- ── 1. Mirror tables (no FK to auth.users) ────────────────────
CREATE TABLE perf_test.fa (
  user_id      uuid PRIMARY KEY,
  tier         text NOT NULL,
  team_lead_id uuid REFERENCES perf_test.fa(user_id)
);
CREATE INDEX ON perf_test.fa(team_lead_id);

CREATE TABLE perf_test.clients (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fa_user_id uuid NOT NULL REFERENCES perf_test.fa(user_id)
);
CREATE INDEX ON perf_test.clients(fa_user_id);

-- ── 2. Seed FA tree: 8 Ultra / 24 Pro / 168 Basic ─────────────

-- 8 Ultras
INSERT INTO perf_test.fa (user_id, tier, team_lead_id)
SELECT gen_random_uuid(), 'ultra', NULL
FROM generate_series(1, 8);

-- 24 Pros (random Ultra parent)
INSERT INTO perf_test.fa (user_id, tier, team_lead_id)
SELECT
  gen_random_uuid(),
  'pro',
  (SELECT user_id FROM perf_test.fa
    WHERE tier = 'ultra'
    ORDER BY random() LIMIT 1)
FROM generate_series(1, 24);

-- 168 Basics (random Pro parent)
INSERT INTO perf_test.fa (user_id, tier, team_lead_id)
SELECT
  gen_random_uuid(),
  'basic',
  (SELECT user_id FROM perf_test.fa
    WHERE tier = 'pro'
    ORDER BY random() LIMIT 1)
FROM generate_series(1, 168);

-- ── 3. Seed clients (5 per FA → ~1000 rows) ──────────────────
INSERT INTO perf_test.clients (fa_user_id)
SELECT user_id
FROM perf_test.fa, generate_series(1, 5);

ANALYZE perf_test.fa;
ANALYZE perf_test.clients;

-- Sanity check
SELECT
  'Tree shape' AS label,
  (SELECT count(*) FROM perf_test.fa WHERE tier = 'ultra') AS ultras,
  (SELECT count(*) FROM perf_test.fa WHERE tier = 'pro')   AS pros,
  (SELECT count(*) FROM perf_test.fa WHERE tier = 'basic') AS basics,
  (SELECT count(*) FROM perf_test.clients)                 AS clients;


-- ============================================================
-- Bench 1: recursive CTE alone — Ultra viewer
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, TIMING)
WITH RECURSIVE descendants(id) AS (
  SELECT user_id FROM perf_test.fa WHERE tier = 'ultra' LIMIT 1
  UNION ALL
  SELECT fp.user_id
  FROM perf_test.fa fp
  JOIN descendants d ON fp.team_lead_id = d.id
)
SELECT count(*) FROM descendants;


-- ============================================================
-- Bench 2: recursive CTE alone — Pro viewer
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, TIMING)
WITH RECURSIVE descendants(id) AS (
  SELECT user_id FROM perf_test.fa WHERE tier = 'pro' LIMIT 1
  UNION ALL
  SELECT fp.user_id
  FROM perf_test.fa fp
  JOIN descendants d ON fp.team_lead_id = d.id
)
SELECT count(*) FROM descendants;


-- ============================================================
-- Bench 3: recursive CTE alone — Basic viewer
-- ============================================================
-- Should return 1 (themselves only).
EXPLAIN (ANALYZE, BUFFERS, TIMING)
WITH RECURSIVE descendants(id) AS (
  SELECT user_id FROM perf_test.fa WHERE tier = 'basic' LIMIT 1
  UNION ALL
  SELECT fp.user_id
  FROM perf_test.fa fp
  JOIN descendants d ON fp.team_lead_id = d.id
)
SELECT count(*) FROM descendants;


-- ============================================================
-- Bench 4: full RLS-shaped query — Ultra reading clients
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, TIMING)
WITH RECURSIVE descendants(id) AS (
  SELECT user_id FROM perf_test.fa WHERE tier = 'ultra' LIMIT 1
  UNION ALL
  SELECT fp.user_id
  FROM perf_test.fa fp
  JOIN descendants d ON fp.team_lead_id = d.id
)
SELECT c.*
FROM perf_test.clients c
WHERE c.fa_user_id IN (SELECT id FROM descendants);


-- ============================================================
-- Bench 5: full RLS-shaped query — Pro reading clients
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, TIMING)
WITH RECURSIVE descendants(id) AS (
  SELECT user_id FROM perf_test.fa WHERE tier = 'pro' LIMIT 1
  UNION ALL
  SELECT fp.user_id
  FROM perf_test.fa fp
  JOIN descendants d ON fp.team_lead_id = d.id
)
SELECT c.*
FROM perf_test.clients c
WHERE c.fa_user_id IN (SELECT id FROM descendants);


-- ============================================================
-- Bench 6: stress test — Ultra reading clients 100 times
-- ============================================================
DO $$
DECLARE
  start_ts timestamptz;
  elapsed  interval;
  ultra_id uuid;
BEGIN
  SELECT user_id INTO ultra_id FROM perf_test.fa WHERE tier = 'ultra' LIMIT 1;
  start_ts := clock_timestamp();
  FOR i IN 1..100 LOOP
    PERFORM count(*)
    FROM perf_test.clients c
    WHERE c.fa_user_id IN (
      WITH RECURSIVE descendants(id) AS (
        SELECT ultra_id
        UNION ALL
        SELECT fp.user_id
        FROM perf_test.fa fp
        JOIN descendants d ON fp.team_lead_id = d.id
      )
      SELECT id FROM descendants
    );
  END LOOP;
  elapsed := clock_timestamp() - start_ts;
  RAISE NOTICE '100x Ultra-clients-with-CTE total: %', elapsed;
  RAISE NOTICE 'Average per call: %', elapsed / 100;
END $$;


-- ── Cleanup ───────────────────────────────────────────────────
-- Drops the perf_test schema and all its tables. Comment this out
-- if you want to inspect the synthetic data after running.
DROP SCHEMA perf_test CASCADE;


-- ============================================================
-- Interpretation guide
-- ============================================================
-- Read the "Execution Time:" line at the bottom of each EXPLAIN block.
--
-- BENCH 1 (Ultra recursive CTE alone):    expect 0.5 - 3 ms
-- BENCH 2 (Pro recursive CTE alone):      expect 0.2 - 1 ms
-- BENCH 3 (Basic recursive CTE alone):    expect 0.1 - 0.3 ms
-- BENCH 4 (Ultra clients with CTE):       expect 5 - 30 ms
-- BENCH 5 (Pro clients with CTE):         expect 1 - 10 ms
-- BENCH 6 (100x stress):                  expect total < 3 s
--                                         (≈ 30 ms per call)
--
-- IF any benchmark is 10x worse than target:
--   - Capture the EXPLAIN output and report it
--   - Likely fix: swap fa_can_view_data_of() for a materialized
--     closure table:
--
--     CREATE TABLE fa_descendants_closure (
--       ancestor_id   uuid NOT NULL,
--       descendant_id uuid NOT NULL,
--       depth         int  NOT NULL,
--       PRIMARY KEY (ancestor_id, descendant_id)
--     );
--     -- refreshed via triggers on fa_profiles when team_lead_id changes
--
--   This trades a small write-time cost for O(1) read performance,
--   which is the right tradeoff because team membership changes
--   far less often than clients are read.
