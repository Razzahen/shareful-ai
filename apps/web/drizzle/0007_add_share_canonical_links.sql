-- Link indexed shares to canonical problem/solution rows.
-- This allows outcomes/verifications to update canonical rankings.

ALTER TABLE shares
  ADD COLUMN IF NOT EXISTS canonical_problem_id integer
    REFERENCES problems(id) ON DELETE SET NULL;

ALTER TABLE shares
  ADD COLUMN IF NOT EXISTS canonical_solution_id integer
    REFERENCES solutions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS shares_canonical_problem_id_idx
  ON shares (canonical_problem_id);

CREATE INDEX IF NOT EXISTS shares_canonical_solution_id_idx
  ON shares (canonical_solution_id);

