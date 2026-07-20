
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS auto_backup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_backup_interval_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS auto_backup_drive_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_backup_drive_folder_id text,
  ADD COLUMN IF NOT EXISTS auto_backup_github_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_backup_github_owner text,
  ADD COLUMN IF NOT EXISTS auto_backup_github_repo text,
  ADD COLUMN IF NOT EXISTS auto_backup_github_branch text DEFAULT 'main',
  ADD COLUMN IF NOT EXISTS auto_backup_github_path text DEFAULT 'backups',
  ADD COLUMN IF NOT EXISTS auto_backup_last_run_at timestamptz,
  ADD COLUMN IF NOT EXISTS auto_backup_last_status text,
  ADD COLUMN IF NOT EXISTS auto_backup_last_result jsonb;

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
