'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Loader2, Megaphone, Mail } from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import { OperatorSection } from '@/components/admin-shell/OperatorSection';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { ProtectedAction } from '@/components/rbac/ProtectedAction';
import { ActionAuthModal, type ActionAuthPayload } from '@/components/ops/ActionAuthModal';
import { useAdminToast } from '@/components/admin-shell/AdminToast';
import { formatSaveError } from '@/lib/admin-save-feedback';
import { listEmailTemplates, pushBroadcast } from '@/lib/notifications-api';

export function NotificationTemplatesPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const toast = useAdminToast();
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [target, setTarget] = useState<'all' | 'verified'>('all');

  const templatesQ = useQuery({
    queryKey: ['admin', 'email-templates', token],
    queryFn: () => listEmailTemplates(token),
    enabled: !!token,
  });

  const broadcastMut = useMutation({
    mutationFn: (payload: ActionAuthPayload) =>
      pushBroadcast(token, { title, message, target }),
    onSuccess: () => {
      setBroadcastOpen(false);
      setTitle('');
      setMessage('');
      toast.success('Broadcast sent.');
    },
    onError: (e) => toast.error(formatSaveError(e, 'Broadcast failed.')),
  });

  const templates = templatesQ.data?.data?.templates ?? [];

  return (
    <>
      <OperatorSection
        title="Email templates"
        description="System email templates used for transactional and compliance messages."
        help="Templates support slug-based lookup by the notification service. Edit in database or via API for HTML bodies."
        auditHref="/audit"
        actions={
          <ProtectedAction permission="settings:edit" fallback="disabled">
            <Button variant="ghost" size="sm" onClick={() => setBroadcastOpen(true)} disabled={!title.trim() || !message.trim()}>
              <Megaphone className="mr-1 h-3.5 w-3.5" /> Push broadcast
            </Button>
          </ProtectedAction>
        }
      >
        <div className="mb-4 grid gap-2 rounded-lg border border-admin-border/40 bg-white/[0.02] p-3 sm:grid-cols-2">
          <input className="rounded-lg border border-admin-border bg-admin-surface px-3 py-2 text-sm" placeholder="Broadcast title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="rounded-lg border border-admin-border bg-admin-surface px-3 py-2 text-sm" value={target} onChange={(e) => setTarget(e.target.value as 'all' | 'verified')}>
            <option value="all">All users</option>
            <option value="verified">Verified users only</option>
          </select>
          <textarea className="sm:col-span-2 rounded-lg border border-admin-border bg-admin-surface px-3 py-2 text-sm min-h-[72px]" placeholder="Broadcast message" value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        {templatesQ.isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-admin-muted" />
        ) : templates.length === 0 ? (
          <p className="text-sm text-admin-muted">No email templates in database. Seed templates via migration or POST /notifications/email-templates.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-admin-muted">
                <tr>
                  {['Slug', 'Name', 'Subject', 'Active'].map((h) => (
                    <th key={h} className="pb-2 pr-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-t border-admin-border/30">
                    <td className="py-2 pr-3 font-mono">{t.slug}</td>
                    <td className="py-2 pr-3">{t.name}</td>
                    <td className="py-2 pr-3 max-w-[200px] truncate">{t.subject}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={t.is_active !== false ? 'success' : 'default'} size="sm">
                        {t.is_active !== false ? 'Yes' : 'No'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 flex items-center gap-1 text-[10px] text-admin-muted">
          <Mail className="h-3 w-3" /> SMS templates: same API pattern at /notifications/sms-templates (manage via API if not listed).
        </p>
      </OperatorSection>

      <ActionAuthModal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
        title="Push broadcast"
        actionLabel="Send push broadcast"
        description="Sends an in-app notification to selected users. Cannot be unsent."
        confirmationPhrase="BROADCAST"
        onConfirm={(p) => { void broadcastMut.mutateAsync(p); }}
        isPending={broadcastMut.isPending}
        requireReason
        twofaRequired
        confirmVariant="danger"
      />
    </>
  );
}
