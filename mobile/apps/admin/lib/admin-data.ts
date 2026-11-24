import { supabase } from './supabase';

export type DashboardMetrics = {
  total_students: number;
  new_students_last_24h: number;
  waiting_competitions: number;
  active_competitions: number;
  library_events_last_24h: number;
  open_security_events: number;
};

function asMetrics(input: unknown): DashboardMetrics | null {
  const row = Array.isArray(input) ? input[0] : input;
  if (!row || typeof row !== 'object') return null;
  const record = row as Record<string, unknown>;
  const number = (key: keyof DashboardMetrics) => Number(record[key]) || 0;
  return { total_students: number('total_students'), new_students_last_24h: number('new_students_last_24h'), waiting_competitions: number('waiting_competitions'), active_competitions: number('active_competitions'), library_events_last_24h: number('library_events_last_24h'), open_security_events: number('open_security_events') };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.rpc('admin_dashboard_metrics');
  if (error) throw error;
  const metrics = asMetrics(data);
  if (!metrics) throw new Error('No dashboard metrics were returned.');
  return metrics;
}
