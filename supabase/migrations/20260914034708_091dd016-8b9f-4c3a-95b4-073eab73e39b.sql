CREATE OR REPLACE FUNCTION public.trigger_send_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text := 'https://kbhyflhxyqvkrstoyava.supabase.co/functions/v1/send-push';
  _anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtiaHlmbGh4eXF2a3JzdG95YXZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYzMDU5MDIsImV4cCI6MjA4MTg4MTkwMn0.N3aLjvOMGBnL9tQJ_E2BAIrQUBfjjeBl93oqHZciASE';
BEGIN
  PERFORM net.http_post(
    url := _url,
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'title', NEW.title,
      'message', NEW.message,
      'type', NEW.type,
      'data', NEW.data
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', _anon,
      'Authorization', 'Bearer ' || _anon
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'send-push dispatch failed: %', SQLERRM;
  RETURN NEW;
END;
$$;