BEGIN;
CREATE TABLE IF NOT EXISTS planner_documents (
  name text PRIMARY KEY CHECK (name IN ('seed', 'settings', 'accounts')),
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
