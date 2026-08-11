-- Runs on every startup (no migration-tracking table), so guard on the old
-- column's existence: once dropped, this block is a no-op on later runs.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'definitions' AND column_name = 'examples'
  ) THEN
    ALTER TABLE definitions ADD COLUMN IF NOT EXISTS example TEXT;
    UPDATE definitions SET example = examples[1] WHERE array_length(examples, 1) > 0;
    ALTER TABLE definitions DROP COLUMN examples;
  END IF;
END $$;
