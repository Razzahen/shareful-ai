-- Enable trigram extension for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Alter search_vector column to proper tsvector type
ALTER TABLE shares ALTER COLUMN search_vector TYPE tsvector USING search_vector::tsvector;

-- Create the trigger function that maintains the search_vector column
CREATE OR REPLACE FUNCTION shares_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.problem, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach the trigger to shares table
CREATE TRIGGER shares_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, problem, content
  ON shares
  FOR EACH ROW
  EXECUTE FUNCTION shares_search_vector_update();

-- Backfill existing rows
UPDATE shares SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(problem, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(content, '')), 'D');

-- Trigram GIN indexes for fuzzy matching
CREATE INDEX IF NOT EXISTS shares_title_trgm_idx ON shares USING gin(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS shares_problem_trgm_idx ON shares USING gin(problem gin_trgm_ops);
