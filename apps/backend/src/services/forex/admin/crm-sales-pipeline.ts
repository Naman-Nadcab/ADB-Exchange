/**
 * Sales pipeline read model — authoritative counts from CRM leads (no fabricated KPIs).
 */
import { db } from '../../../lib/database.js';

export type ForexCrmPipelineStageRow = {
  stage_id: string;
  label: string;
  sort_order: number;
  lead_count: number;
  open_count: number;
  converted_count: number;
};

export type ForexCrmPipelineSnapshot = {
  stages: ForexCrmPipelineStageRow[];
  totals: { leads: number; open: number; converted: number };
  source: 'forex_crm_leads';
  calculated_at: string;
};

export async function buildForexCrmSalesPipelineSnapshot(): Promise<ForexCrmPipelineSnapshot> {
  try {
  const res = await db.query<{
    stage_id: string;
    label: string;
    sort_order: number;
    lead_count: string;
    open_count: string;
    converted_count: string;
  }>(
    `SELECT s.stage_id, s.label, s.sort_order,
       COUNT(l.lead_id)::text AS lead_count,
       COUNT(l.lead_id) FILTER (WHERE l.status = 'open')::text AS open_count,
       COUNT(l.lead_id) FILTER (WHERE l.status = 'converted')::text AS converted_count
     FROM forex_crm_lead_stages s
     LEFT JOIN forex_crm_leads l ON l.stage_id = s.stage_id
     GROUP BY s.stage_id, s.label, s.sort_order
     ORDER BY s.sort_order, s.stage_id`,
  );

  const stages: ForexCrmPipelineStageRow[] = res.rows.map((r) => ({
    stage_id: String(r.stage_id),
    label: String(r.label),
    sort_order: Number(r.sort_order) || 0,
    lead_count: Number.parseInt(String(r.lead_count), 10) || 0,
    open_count: Number.parseInt(String(r.open_count), 10) || 0,
    converted_count: Number.parseInt(String(r.converted_count), 10) || 0,
  }));

  const totals = stages.reduce(
    (acc, s) => ({
      leads: acc.leads + s.lead_count,
      open: acc.open + s.open_count,
      converted: acc.converted + s.converted_count,
    }),
    { leads: 0, open: 0, converted: 0 },
  );

  return {
    stages,
    totals,
    source: 'forex_crm_leads',
    calculated_at: new Date().toISOString(),
  };
  } catch {
    return {
      stages: [],
      totals: { leads: 0, open: 0, converted: 0 },
      source: 'forex_crm_leads',
      calculated_at: new Date().toISOString(),
    };
  }
}
