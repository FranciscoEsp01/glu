-- Run after enabling pg_cron in Supabase Integrations → Cron.
-- The named schedule can be reapplied without creating duplicate schedules.
select cron.schedule('glu-cleanup-processing-results', '17 * * * *',
  $$select public.cleanup_service_results();$$);
select cron.schedule('glu-refresh-operations-alerts', '*/5 * * * *',
  $$select public.refresh_operations_alerts();$$);
