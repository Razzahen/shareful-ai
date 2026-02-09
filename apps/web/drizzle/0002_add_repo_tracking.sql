ALTER TABLE repos ADD COLUMN git_sha varchar(40);
ALTER TABLE repos ADD COLUMN last_indexed_at timestamp with time zone;
ALTER TABLE repos ADD COLUMN status varchar(16) NOT NULL DEFAULT 'active';

CREATE TABLE index_jobs (
  id serial PRIMARY KEY,
  owner varchar(128) NOT NULL,
  repo varchar(128) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  processed_at timestamp with time zone,
  error text
);
CREATE INDEX idx_index_jobs_status ON index_jobs (status, created_at);
