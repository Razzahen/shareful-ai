ALTER TABLE shares ADD COLUMN install_count integer DEFAULT 0 NOT NULL;
ALTER TABLE shares ADD COLUMN first_seen_at timestamp with time zone NOT NULL DEFAULT now();
ALTER TABLE shares ADD COLUMN indexed_by varchar(128) NOT NULL DEFAULT 'shareful.ai';
