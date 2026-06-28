import { adminFetch } from './api';

export interface EmailTemplateRow {
  id: string;
  slug: string;
  name: string;
  subject: string;
  body_html: string;
  body_text?: string | null;
  is_active?: boolean;
  updated_at?: string;
}

export function listEmailTemplates(token: string | null) {
  return adminFetch<{ templates: EmailTemplateRow[] }>('/notifications/email-templates', { token });
}

export function createEmailTemplate(
  token: string | null,
  body: { slug: string; name: string; subject: string; body_html: string; body_text?: string; is_active?: boolean },
) {
  return adminFetch('/notifications/email-templates', { method: 'POST', token, body });
}

export function patchEmailTemplate(token: string | null, id: string, body: Partial<EmailTemplateRow>) {
  return adminFetch(`/notifications/email-templates/${encodeURIComponent(id)}`, { method: 'PATCH', token, body });
}

export function deleteEmailTemplate(token: string | null, id: string) {
  return adminFetch(`/notifications/email-templates/${encodeURIComponent(id)}`, { method: 'DELETE', token, body: {} });
}

export function pushBroadcast(
  token: string | null,
  body: { title: string; message: string; target?: 'all' | 'verified' },
) {
  return adminFetch<{ sent: number; totalUsers: number }>('/notifications/push-broadcast', {
    method: 'POST',
    token,
    body,
  });
}
