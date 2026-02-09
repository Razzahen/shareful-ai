-- Canonical problem/solution tables + embeddings for high-precision dedupe.
-- Requires pgvector for vector similarity search.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS problems (
  id serial PRIMARY KEY,
  canonical_problem text NOT NULL,
  language varchar(64),
  framework varchar(64),
  error_signature text,
  metadata jsonb,
  problem_embedding vector(1536) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS problems_language_idx ON problems (language);
CREATE INDEX IF NOT EXISTS problems_framework_idx ON problems (framework);

-- Optional: enable approximate nearest neighbor index once table is large enough.
-- CREATE INDEX IF NOT EXISTS problems_embedding_ivfflat_idx
--   ON problems USING ivfflat (problem_embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS solutions (
  id serial PRIMARY KEY,
  canonical_solution text NOT NULL,
  solution_hash varchar(64) NOT NULL,
  metadata jsonb,
  solution_embedding vector(1536) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS solutions_solution_hash_idx
  ON solutions (solution_hash);

-- Optional: enable approximate nearest neighbor index once table is large enough.
-- CREATE INDEX IF NOT EXISTS solutions_embedding_ivfflat_idx
--   ON solutions USING ivfflat (solution_embedding vector_cosine_ops) WITH (lists = 100);

CREATE TABLE IF NOT EXISTS problem_solutions (
  problem_id integer NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
  solution_id integer NOT NULL REFERENCES solutions(id) ON DELETE CASCADE,
  seen_count integer NOT NULL DEFAULT 1,
  success_count integer NOT NULL DEFAULT 0,
  failure_count integer NOT NULL DEFAULT 0,
  verification_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (problem_id, solution_id)
);

CREATE INDEX IF NOT EXISTS problem_solutions_problem_id_idx
  ON problem_solutions (problem_id);

CREATE INDEX IF NOT EXISTS problem_solutions_solution_id_idx
  ON problem_solutions (solution_id);

CREATE TABLE IF NOT EXISTS solution_submissions (
  id serial PRIMARY KEY,
  source varchar(32) NOT NULL DEFAULT 'skill',
  problem_id integer REFERENCES problems(id) ON DELETE SET NULL,
  solution_id integer REFERENCES solutions(id) ON DELETE SET NULL,
  raw_problem text NOT NULL,
  raw_solution text NOT NULL,
  metadata jsonb,
  judge_result jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS solution_submissions_created_idx
  ON solution_submissions (created_at);

