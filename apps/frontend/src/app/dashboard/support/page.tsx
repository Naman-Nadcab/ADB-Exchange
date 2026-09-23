'use client';

/**
 * User-facing support tickets page.
 *
 * Three views in one component (kept flat on purpose to avoid route churn):
 *   - list:   all of user's tickets
 *   - create: compose a new ticket
 *   - detail: view ticket conversation + reply
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, HelpCircle, Loader2, MessageCircle, Plus, Send } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { notifyError } from '@/lib/notifyError';
import { ErrorState } from '@/components/ui/ErrorState';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';

type View = 'list' | 'create' | 'detail';

interface TicketSummary {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

interface TicketMessage {
  id: string;
  sender_type: 'user' | 'admin';
  message: string;
  created_at: string;
}

interface TicketDetail {
  id: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
}

const CATEGORY_VALUES = [
  'general',
  'account',
  'deposit',
  'withdrawal',
  'trading',
  'kyc',
  'security',
  'other',
] as const;

const PRIORITY_VALUES = ['low', 'medium', 'high', 'urgent'] as const;

const STATUS_STYLE: Record<string, string> = {
  open: 'bg-primary/15 text-primary',
  in_progress: 'bg-warning/15 text-warning',
  waiting_user: 'bg-accent text-foreground',
  resolved: 'bg-success/15 text-success',
  closed: 'bg-muted text-muted-foreground',
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function SupportPage() {
  const t = useTranslations('account.supportPage');
  const { fromApi } = useApiErrorMessage();
  const { accessToken } = useAuthStore();
  const apiUrl = useMemo(() => getApiBaseUrl(), []);

  const formatStatus = (s: string) => {
    try {
      return t(`statuses.${s}` as Parameters<typeof t>[0]);
    } catch {
      return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    }
  };

  const categoryLabel = (value: string) => {
    try {
      return t(`categories.${value}` as Parameters<typeof t>[0]);
    } catch {
      return value;
    }
  };

  const priorityLabel = (value: string) => {
    try {
      return t(`priorities.${value}` as Parameters<typeof t>[0]);
    } catch {
      return value;
    }
  };

  const [view, setView] = useState<View>('list');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // List
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);

  // Create
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('medium');
  const [message, setMessage] = useState('');
  const [creating, setCreating] = useState(false);

  // Detail
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replying, setReplying] = useState(false);

  const authHeaders = useMemo((): Record<string, string> => {
    if (!accessToken) return {};
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const fetchList = async () => {
    if (!accessToken) return;
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/support/tickets`, { headers: authHeaders });
      const json = await res.json();
      if (res.ok && json?.success) {
        setTickets(json.data?.tickets || []);
      } else {
        const message = fromApi(json, 'generic.unknown') || t('loadTicketsFailed');
        setListError(message);
        notifyError(message);
      }
    } catch {
      const message = t('loadTicketsFailed');
      setListError(message);
      notifyError(message);
    } finally {
      setListLoading(false);
    }
  };

  const fetchDetail = async (id: string) => {
    if (!accessToken) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`${apiUrl}/api/v1/support/tickets/${id}`, { headers: authHeaders });
      const json = await res.json();
      if (res.ok && json?.success) {
        setDetail(json.data.ticket);
        setMessages(json.data.messages || []);
      } else {
        const message = fromApi(json, 'generic.unknown') || t('loadTicketFailed');
        setDetailError(message);
        notifyError(message);
      }
    } catch {
      const message = t('loadTicketFailed');
      setDetailError(message);
      notifyError(message);
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
     
  }, [accessToken]);

  useEffect(() => {
    if (view === 'detail' && selectedId) fetchDetail(selectedId);
     
  }, [view, selectedId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    if (subject.trim().length < 3 || message.trim().length < 5) {
      notifyError(t('subjectTooShort'));
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/support/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          subject: subject.trim(),
          category,
          priority,
          message: message.trim(),
        }),
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setSubject('');
        setMessage('');
        setCategory('general');
        setPriority('medium');
        setSelectedId(json.data.id);
        await fetchList();
        setView('detail');
      } else {
        notifyError(fromApi(json, 'generic.unknown') || t('createTicketFailed'));
      }
    } catch {
      notifyError(t('createTicketFailed'));
    } finally {
      setCreating(false);
    }
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !selectedId || replyText.trim().length === 0) return;
    setReplying(true);
    try {
      const res = await fetch(`${apiUrl}/api/v1/support/tickets/${selectedId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ message: replyText.trim() }),
      });
      const json = await res.json();
      if (res.ok && json?.success) {
        setReplyText('');
        await fetchDetail(selectedId);
      } else {
        notifyError(fromApi(json, 'generic.unknown') || t('sendReplyFailed'));
      }
    } catch {
      notifyError(t('sendReplyFailed'));
    } finally {
      setReplying(false);
    }
  };

  // ================= RENDER =================

  const Header = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      {view === 'list' && (
        <button
          onClick={() => setView('create')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition"
        >
          <Plus className="w-4 h-4" /> {t('newTicket')}
        </button>
      )}
    </div>
  );

  if (view === 'create') {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        {Header}

        <button
          onClick={() => setView('list')}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-4 h-4" /> {t('backToTickets')}
        </button>

        <form onSubmit={handleCreate} className="bg-card border border-border rounded-2xl p-6 space-y-5">
          <div>
            <label className="text-sm font-semibold text-foreground">{t('subject')}</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t('subjectPlaceholder')}
              maxLength={200}
              className="mt-2 w-full px-4 py-3 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-foreground">{t('category')}</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-2 w-full px-4 py-3 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              >
                {CATEGORY_VALUES.map((value) => (
                  <option key={value} value={value}>{categoryLabel(value)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-semibold text-foreground">{t('priority')}</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="mt-2 w-full px-4 py-3 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              >
                {PRIORITY_VALUES.map((value) => (
                  <option key={value} value={value}>{priorityLabel(value)}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-foreground">{t('message')}</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('messagePlaceholder')}
              rows={8}
              maxLength={5000}
              className="mt-2 w-full px-4 py-3 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">{t('charCount', { count: message.length })}</p>
          </div>

          <div className="flex items-center justify-between">
            <Link href="/dashboard/help" className="text-sm text-primary hover:underline inline-flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4" /> {t('checkFaq')}
            </Link>
            <button
              type="submit"
              disabled={creating}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-60"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {t('submitTicket')}
            </button>
          </div>
        </form>
      </div>
    );
  }

  if (view === 'detail') {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {Header}

        <button
          onClick={() => { setView('list'); setSelectedId(null); setDetail(null); setMessages([]); }}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> {t('backToTickets')}
        </button>

        {detailLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : detailError ? (
          <ErrorState
            title={t('couldNotLoadTicket')}
            message={detailError}
            onRetry={() => selectedId && fetchDetail(selectedId)}
          />
        ) : !detail ? (
          <ErrorState
            title={t('ticketNotFound')}
            message={t('ticketUnavailable')}
            onRetry={() => selectedId && fetchDetail(selectedId)}
          />
        ) : (
          <>
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{detail.subject}</h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('openedUpdated', {
                      opened: formatWhen(detail.created_at),
                      updated: formatWhen(detail.updated_at),
                    })}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[detail.status] || 'bg-muted'}`}>
                  {formatStatus(detail.status)}
                </span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="px-2 py-0.5 rounded bg-muted">{categoryLabel(detail.category)}</span>
                <span className="px-2 py-0.5 rounded bg-muted">{priorityLabel(detail.priority)}</span>
              </div>
              {detail.resolution_note && (
                <div className="mt-4 p-3 rounded-lg bg-success/10 border border-success/30 text-sm text-foreground">
                  <p className="font-semibold text-success mb-1">{t('resolution')}</p>
                  {detail.resolution_note}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => selectedId && fetchDetail(selectedId)}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t('refreshConversation')}
                </button>
              </div>
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex ${m.sender_type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                    m.sender_type === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-muted text-foreground rounded-bl-sm border border-border'
                  }`}>
                    <p className="text-[11px] opacity-70 mb-1">
                      {m.sender_type === 'user' ? t('you') : t('support')} · {formatWhen(m.created_at)}
                    </p>
                    <p className="whitespace-pre-wrap text-sm">{m.message}</p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-8">{t('noMessages')}</p>
              )}
            </div>

            {detail.status !== 'closed' ? (
              <form onSubmit={handleReply} className="bg-card border border-border rounded-2xl p-4 space-y-3 sticky bottom-4">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder={t('replyPlaceholder')}
                  rows={3}
                  maxLength={5000}
                  className="w-full px-4 py-3 rounded-xl bg-muted border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{t('charCount', { count: replyText.length })}</span>
                  <button
                    type="submit"
                    disabled={replying || replyText.trim().length === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-60"
                  >
                    {replying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {t('send')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="bg-muted border border-border rounded-xl p-4 text-sm text-muted-foreground text-center">
                {t('ticketClosed')}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ============== LIST VIEW ==============
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {Header}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {listLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : listError ? (
          <div className="p-4">
            <ErrorState
              title={t('listErrorTitle')}
              message={listError}
              onRetry={() => fetchList()}
            />
          </div>
        ) : tickets.length === 0 ? (
          <div className="py-16 text-center">
            <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-foreground font-semibold">{t('noTicketsTitle')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('noTicketsDesc')}</p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link href="/dashboard/help" className="px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-accent">
                {t('browseFaq')}
              </Link>
              <button
                onClick={() => setView('create')}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
              >
                {t('openTicket')}
              </button>
            </div>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <button
                  onClick={() => { setSelectedId(ticket.id); setView('detail'); }}
                  className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-accent/60 transition"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {categoryLabel(ticket.category)} · {priorityLabel(ticket.priority)} ·{' '}
                      {ticket.message_count !== 1
                        ? t('messageCountPlural', { count: ticket.message_count })
                        : t('messageCount', { count: ticket.message_count })}{' '}
                      · {t('updated', { time: formatWhen(ticket.updated_at) })}
                    </p>
                  </div>
                  <span className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${STATUS_STYLE[ticket.status] || 'bg-muted'}`}>
                    {formatStatus(ticket.status)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
