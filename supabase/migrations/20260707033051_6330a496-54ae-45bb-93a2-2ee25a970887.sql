
-- Per-user notification preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  push_enabled boolean NOT NULL DEFAULT true,
  toast_enabled boolean NOT NULL DEFAULT true,
  sound_enabled boolean NOT NULL DEFAULT true,
  event_order_placed boolean NOT NULL DEFAULT true,
  event_confirmed boolean NOT NULL DEFAULT true,
  event_preparing boolean NOT NULL DEFAULT true,
  event_ready_for_pickup boolean NOT NULL DEFAULT true,
  event_picked_up boolean NOT NULL DEFAULT true,
  event_on_the_way boolean NOT NULL DEFAULT true,
  event_awaiting_confirmation boolean NOT NULL DEFAULT true,
  event_delivered boolean NOT NULL DEFAULT true,
  event_cancelled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification prefs"
  ON public.notification_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Global admin toggles
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS notifications_sound_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_toast_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_push_enabled boolean NOT NULL DEFAULT true;

-- Allow anyone to read the global notification toggles (they gate UI behaviour)
-- Existing platform_settings SELECT policy already handles this if it's public; skip if not needed.
