-- ============================================================
-- Hierarchical RLS performance benchmark (Phase 1 sanity check)
-- ============================================================
-- Purpose: confirm the recursive CTE in fa_can_view_data_of() stays
-- fast enough at Victory's expected scale (200 FAs, 1000 clients).
--
-- How to run:
--   1. Open Supabase Dashboard → SQL Editor → New query
--   2. Paste this whole file
--   3. Click Run
--   4. Read the EXPLAIN ANALYZE output blocks at the bottom
--   5. Whole script runs inside a transaction and ROLLBACKs at the
--      end — no permanent rows added to your DB.
--
-- What "good" looks like:
--   - Ultra-as-viewer query: < 5ms total
--   - Pro-as-viewer query: < 2ms total
--   - Basic-as-viewer query: < 1ms total
--   - Clients SELECT with RLS for Ultra: < 50ms for 1000 rows
--
-- If any of those are 10x slower, switch fa_can_view_data_of to a
-- materialized closure table (separate migration). Notes at bottom.
-- ============================================================

BEGIN;

-- ── Synthetic FA tree (mirrors fa_profiles structure, no FK to auth.users) ──
CREATE TEMP TABLE perf_fa (
  user_id      uuid PRIMARY KEY,
  tier         text NOT NULL,
  team_lead_id uuid REFERENCES perf_fa(user_id)
);

CREATE INDEX ON perf_fa(team_lead_id);

-- 8 Ultras (no team lead)
INSERT INTO perf_fa (user_id, tier, team_lead_id)
SELECT gen_random_uuid(), 'ultra', NULL
FROM generate_series(1, 8);

-- 24 Pros, randomly distributed under the 8 Ultras (avg 3 each)
INSERT INTO perf_fa (user_id, tier, team_lead_id)
SELECT
  gen_random_uuid(),
  'pro',
  (SELECT user_id FROM perf_fa
    WHERE tier = 'ultra'
    ORDER BY random() LIMIT 1)
FROM generate_series(1, 24);

-- 168 Basics, randomly distributed under the 24 Pros (avg 7 each)
INSERT INTO perf_fa (user_id, tier, team_lead_id)
SELECT
  gen_random_uuid(),
  'basic',
  (SELECT user_id FROM perf_fa
    WHERE tier = 'pro'
    ORDER BY random() LIMIT 1)
FROM generate_series(1, 168);

-- Synthetic clients (5 per FA = 1000 rows)
CREATE TEMP TABLE perf_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fa_user_id uuid NOT NULL REFERENCES perf_fa(user_id)
);

INSERT INTO perf_clients (fa_user_id)
SELECT user_id FROM perf_fa, generate_series(1, 5);

CREATE INDEX ON perf_clients(fa_user_id);

ANALYZE perf_fa;
ANALYZE perf_clients;

-- Sanity counts
SELECT 'Tree shape' as label,
       (SELECT count(*) FROM perf_fa WHERE tier = 'ultra') as ultras,
       (SELECT count(*) FROM perf_fa WHERE tier = 'pro')   as pros,
       (SELECT count(*) FROM perf_fa WHERE tier = 'basic') as basics,
       (SELECT count(*) FROM perf_clients)                 as clients;


-- ============================================================
-- Bench 1: recursive CTE alone — Ultra viewer
-- ============================================================
-- Picks one Ultra at random and walks their entire descendant tree.
-- Expect ~22 rows returned (1 self + ~3 pros + ~21 basics roughly).
DO $$
DECLARE
  ultra_id uuid;
BEGIN
  SELECT user_id INTO ultra_id FROM perf_fa WHERE tier = 'ultra' LIMIT 1;
  RAISE NOTICE 'Bench 1 viewer (ultra) = %', ultra_id;
  PERFORM set_config('perf.ultra_id', ultra_id::text, true);
END $$;

EXPLAIN (ANALYZE, BUFFERS, TIMING)
WITH RECURSIVE descendants(id) AS (
  SELECT current_setting('perf.ultra_id')::uuid
  UNION ALL
  SELECT fp.user_id
  FROM perf_fa fp
  JOIN descendants d ON fp.team_lead_id = d.id
)
SELECT count(*) FROM descendants;


-- ============================================================
-- Bench 2: recursive CTE alone — Pro viewer
-- ============================================================
DO $$
DECLARE
  pro_id uuid;
BEGIN
  SELECT user_id INTO pro_id FROM perf_fa WHERE tier = 'pro' LIMIT 1;
  RAISE NOTICE 'Bench 2 viewer (pro) = %', pro_id;
  PERFORM set_config('perf.pro_id', pro_id::text, true);
END $$;

EXPLAIN (ANALYZE, BUFFERS, TIMING)
WITH RECURSIVE descendants(id) AS (
  SELECT current_setting('perf.pro_id')::uuid
  UNION ALL
  SELECT fp.user_id
  FROM perf_fa fp
  JOIN descendants d ON fp.team_lead_id = d.id
)
SELECT count(*) FROM descendants;


-- ============================================================
-- Bench 3: recursive CTE alone — Basic viewer
-- ============================================================
-- Should return exactly 1 row (just themselves).
DO $$
DECLARE
  basic_id uuid;
BEGIN
  SELECT user_id INTO basic_id FROM perf_fa WHERE tier = 'basic' LIMIT 1;
  RAISE NOTICE 'Bench 3 viewer (basic) = %', basic_id;
  PERFORM set_config('perf.basic_id', basic_id::text, true);
END $$;

EXPLAIN (ANALYZE, BUFFERS, TIMING)
WITH RECURSIVE descendants(id) AS (
  SELECT current_setting('perf.basic_id')::uuid
  UNION ALL
  SELECT fp.user_id
  FROM perf_fa fp
  JOIN descendants d ON fp.team_lead_id = d.id
)
SELECT count(*) FROM descendants;


-- ============================================================
-- Bench 4: full RLS-shaped query — Ultra reading clients
-- ============================================================
-- This simulates what happens on /clients for an Ultra: SELECT * FROM
-- clients filtered by the recursive descendants. Should be the slowest
-- of the four because it joins clients (1000 rows) against the CTE.
EXPLAIN (ANALYZE, BUFFERS, TIMING)
WITH RECURSIVE descendants(id) AS (
  SELECT current_setting('perf.ultra_id')::uuid
  UNION ALL
  SELECT fp.user_id
  FROM perf_fa fp
  JOIN descendants d ON fp.team_lead_id = d.id
)
SELECT c.*
FROM perf_clients c
WHERE c.fa_user_id IN (SELECT id FROM descendants);


-- ============================================================
-- Bench 5: full RLS-shaped query — Pro reading clients
-- ============================================================
EXPLAIN (ANALYZE, BUFFERS, TIMING)
WITH RECURSIVE descendants(id) AS (
  SELECT current_setting('perf.pro_id')::uuid
  UNION ALL
  SELECT fp.user_id
  FROM perf_fa fp
  JOIN descendants d ON fp.team_lead_id = d.id
)
SELECT c.*
FROM perf_clients c
WHERE c.fa_user_id IN (SELECT id FROM descendants);


-- ============================================================
-- Bench 6: stress test — Ultra reading clients 100 times
-- ============================================================
-- Single ANALYZE timing per call doesn't tell us about variance under
-- load. This wraps Bench 4 in a 100-iteration loop and reports total
-- elapsed time. Divide by 100 for per-call avg.
DO $$
DECLARE
  start_ts timestamptz;
  elapsed interval;
  ultra_id uuid := current_setting('perf.ultra_id')::uuid;
BEGIN
  start_ts := clock_timestamp();
  FOR i IN 1..100 LOOP
    PERFORM count(*)
    FROM perf_clients c
    WHERE c.fa_user_id IN (
      WITH RECURSIVE descendants(id) AS (
        SELECT ultra_id
        UNION ALL
        SELECT fp.user_id
        FROM perf_fa fp
        JOIN descendants d ON fp.team_lead_id = d.id
      )
      SELECT id FROM descendants
    );
  END LOOP;
  elapsed := clock_timestamp() - start_ts;
  RAISE NOTICE '100x Ultra-clients-with-CTE took: % (avg per call: %)',
    elapsed, elapsed / 100;
END $$;

ROLLBACK;

-- ============================================================
-- Interpretation guide
-- ============================================================
-- Read the "Execution Time" line at the bottom of each EXPLAIN block.
--
-- BENCH 1 (Ultra recursive CTE alone): expect 0.5-3ms
-- BENCH 2 (Pro recursive CTE alone): expect 0.2-1ms
-- BENCH 3 (Basic recursive CTE alone): expect 0.1-0.3ms
-- BENCH 4 (Ultra clients with CTE): expect 5-30ms for 1000 clients
-- BENCH 5 (Pro clients with CTE): expect 1-10ms
-- BENCH 6 (100x stress): expect total < 3 seconds (=> ~30ms/call avg)
--
-- IF you see 10x worse:
--   - 100ms+ on Bench 4 → consider materialized closure table
--   - Open issue + ping me to swap fa_can_view_data_of()
--
-- The materialized closure table option (NOT applied yet, just sketch):
--   CREATE TABLE fa_descendants_closure (
--     ancestor_id uuid, descendant_id uuid, depth int,
--     PRIMARY KEY (ancestor_id, descendant_id)
--   );
--   -- refreshed by trigger on fa_profiles.team_lead_id changes
-- This trades write cost for O(1) read on the closure lookup.
