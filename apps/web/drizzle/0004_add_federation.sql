CREATE TABLE index_upstreams (
  id serial PRIMARY KEY,
  name varchar(128) NOT NULL UNIQUE,
  url text NOT NULL,
  trust_score integer NOT NULL DEFAULT 50,
  last_synced_at timestamp with time zone,
  cursor text,
  status varchar(16) NOT NULL DEFAULT 'active'
);
