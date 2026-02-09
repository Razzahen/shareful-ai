ALTER TABLE repos ADD COLUMN trust_score integer NOT NULL DEFAULT 0;
ALTER TABLE repos ADD COLUMN owner_verified integer NOT NULL DEFAULT 0;

CREATE TABLE moderation_actions (
  id serial PRIMARY KEY,
  target_type varchar(16) NOT NULL,
  target_id integer NOT NULL,
  action varchar(16) NOT NULL,
  reason text,
  moderator varchar(128) NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX moderation_actions_target_idx ON moderation_actions (target_type, target_id);

CREATE TABLE index_events (
  id serial PRIMARY KEY,
  event_type varchar(32) NOT NULL,
  owner varchar(128) NOT NULL,
  repo varchar(128) NOT NULL,
  slug varchar(64),
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX idx_index_events_created ON index_events (created_at);
CREATE INDEX idx_index_events_owner_repo ON index_events (owner, repo);
