'use client';

import { useCallback, useEffect, useState } from 'react';
import { ForexSignInPrompt } from '@/components/forex/ForexPageFrame';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';
import { fxMoney } from '@/components/forex/format';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { hasForexPrivateSession } from '@/lib/forex/api/auth-token';
import { useAuthStore } from '@/store/auth';

const field = 'rounded border border-border bg-background px-2 py-1.5 text-[12px]';
const primaryBtn =
  'inline-flex min-h-9 items-center rounded border border-primary bg-primary px-3 text-[12px] font-medium text-primary-foreground disabled:opacity-50';
const quietBtn = 'inline-flex min-h-9 items-center rounded border border-border bg-card px-3 text-[12px] font-medium disabled:opacity-50';

function styleLabel(style: string): string {
  if (style === 'COPY') return 'Copy';
  if (style === 'PAMM') return 'PAMM';
  if (style === 'MAM') return 'MAM';
  return style;
}

function useAuthed() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated || hasForexPrivateSession();
}

function Note(props: { error: string | null; info: string | null }) {
  if (!props.error && !props.info) return null;
  return (
    <p className={`text-[12px] ${props.error ? 'text-sell' : 'text-muted-foreground'}`} role={props.error ? 'alert' : 'status'}>
      {props.error ?? props.info}
    </p>
  );
}

type Manager = {
  managerId: string;
  name: string;
  style: string;
  summary: string;
  feePercent: number;
  minAmount: number;
  status: string;
  mine: boolean;
};

type FollowRow = {
  followId: string;
  name: string;
  style: string;
  amount: number;
  stopPercent: number;
  status: string;
};

export function ForexFollowDesk() {
  const authed = useAuthed();
  const [managers, setManagers] = useState<Manager[]>([]);
  const [follows, setFollows] = useState<FollowRow[]>([]);
  const [amount, setAmount] = useState('250');
  const [stopPct, setStopPct] = useState('20');
  const [applyName, setApplyName] = useState('');
  const [applyStyle, setApplyStyle] = useState('COPY');
  const [applySummary, setApplySummary] = useState('');
  const [applyFee, setApplyFee] = useState('20');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = unwrap(await forexApi.programsFollow());
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setError(null);
    const data = res.data as { managers?: Manager[]; follows?: FollowRow[] };
    setManagers(data.managers ?? []);
    setFollows(data.follows ?? []);
  }, []);

  useEffect(() => {
    if (authed) void load();
  }, [authed, load]);

  if (!authed) return <ForexSignInPrompt href="/login" sectionKey="programs" />;

  async function follow(managerId: string) {
    setBusy(true);
    setError(null);
    setInfo(null);
    const res = unwrap(await forexApi.programsFollowStart({ managerId, amount: Number(amount), stopPercent: Number(stopPct) }));
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setInfo('Amount reserved. You can stop any time and the cash returns to the trading balance.');
    await load();
  }

  async function stopFollow(followId: string) {
    setBusy(true);
    setError(null);
    const res = unwrap(await forexApi.programsFollowStop(followId));
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setInfo('Follow stopped. Reserved cash is back on the trading balance.');
    await load();
  }

  async function apply() {
    setBusy(true);
    setError(null);
    const res = unwrap(
      await forexApi.programsFollowApply({
        name: applyName,
        style: applyStyle,
        summary: applySummary,
        feePercent: Number(applyFee),
      })
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setInfo('Application sent. It appears to clients only after approval.');
    setApplyName('');
    setApplySummary('');
    await load();
  }

  const open = managers.filter((m) => m.status === 'APPROVED');
  const pendingMine = managers.filter((m) => m.mine && m.status !== 'APPROVED');
  const amountNum = Number(amount);

  return (
    <div className="space-y-3">
      <Note error={error} info={info} />
      {loading ? <p className="text-[12px] text-muted-foreground">Loading managers…</p> : null}
      <ForexPortalModuleCard title="Follow a manager" subtitle="Enter one amount and one stop, then pick a manager. The cash stays reserved until you stop. The published fee is not taken when you stop, and this action does not place an order.">
        <div className="mb-3 flex flex-wrap gap-2">
          <label className="text-[11px] text-muted-foreground">
            Amount
            <input className={`mt-1 block w-28 ${field}`} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          </label>
          <label className="text-[11px] text-muted-foreground">
            Stop %
            <input className={`mt-1 block w-20 ${field}`} value={stopPct} onChange={(e) => setStopPct(e.target.value)} inputMode="decimal" />
          </label>
        </div>
        {open.length === 0 && !loading ? <p className="text-[12px] text-muted-foreground">No approved manager is open yet.</p> : null}
        <div className="grid gap-2 md:grid-cols-3">
          {open.map((m) => {
            const belowMin = !Number.isFinite(amountNum) || amountNum < m.minAmount;
            return (
              <article key={m.managerId} className="rounded border border-border p-3">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="text-[13px] font-medium">{m.name}</h3>
                  <ForexPortalStatusBadge tone="primary">{styleLabel(m.style)}</ForexPortalStatusBadge>
                </div>
                <p className="min-h-8 text-[11px] text-muted-foreground">{m.summary}</p>
                <p className="mt-2 text-[11px]">Fee {m.feePercent}% · minimum {fxMoney(m.minAmount)}</p>
                <button type="button" className={`mt-2 ${primaryBtn}`} disabled={busy || belowMin} onClick={() => void follow(m.managerId)}>
                  {belowMin ? `Minimum ${fxMoney(m.minAmount)}` : 'Follow'}
                </button>
              </article>
            );
          })}
        </div>
      </ForexPortalModuleCard>

      <ForexPortalModuleCard title="Your follows" subtitle="Stopping returns the reserved amount to the selected account.">
        {follows.length === 0 ? <p className="text-[12px] text-muted-foreground">No follows yet.</p> : null}
        <ul className="space-y-2">
          {follows.map((f) => (
            <li key={f.followId} className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
              <span>
                {f.name} · {styleLabel(f.style)} · {fxMoney(f.amount)} · stop {f.stopPercent}% · {f.status}
              </span>
              {f.status === 'ACTIVE' ? (
                <button type="button" className={quietBtn} disabled={busy} onClick={() => void stopFollow(f.followId)}>
                  Stop and return cash
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </ForexPortalModuleCard>

      <ForexPortalModuleCard title="Offer a strategy" subtitle="Clients see it only after an admin approves it.">
        <div className="grid gap-2 sm:grid-cols-2">
          <input className={field} placeholder="Name" value={applyName} onChange={(e) => setApplyName(e.target.value)} />
          <select className={field} value={applyStyle} onChange={(e) => setApplyStyle(e.target.value)}>
            <option value="COPY">Copy</option>
            <option value="PAMM">PAMM</option>
            <option value="MAM">MAM</option>
          </select>
          <input className={`${field} sm:col-span-2`} placeholder="One sentence on what you do" value={applySummary} onChange={(e) => setApplySummary(e.target.value)} />
          <label className="text-[11px] text-muted-foreground">
            Fee %
            <input className={`mt-1 block w-24 ${field}`} value={applyFee} onChange={(e) => setApplyFee(e.target.value)} />
          </label>
        </div>
        {pendingMine.length > 0 ? (
          <ul className="mt-3 space-y-1 text-[12px] text-muted-foreground">
            {pendingMine.map((m) => (
              <li key={m.managerId}>
                {m.name} · {styleLabel(m.style)} · {m.status}
              </li>
            ))}
          </ul>
        ) : null}
        <button type="button" className={`mt-3 ${quietBtn}`} disabled={busy} onClick={() => void apply()}>
          Submit for approval
        </button>
      </ForexPortalModuleCard>
    </div>
  );
}

export function ForexPartnerDesk() {
  const authed = useAuthed();
  const [desk, setDesk] = useState<{
    code: string;
    ratePercent: number;
    clients: number;
    availableCommission: number;
    linkedCode: string | null;
    payouts: Array<{ payoutId: string; amount: number; status: string }>;
  } | null>(null);
  const [code, setCode] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = unwrap(await forexApi.programsPartner());
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setError(null);
    setDesk(res.data as NonNullable<typeof desk>);
  }, []);

  useEffect(() => {
    if (authed) void load();
  }, [authed, load]);

  if (!authed) return <ForexSignInPrompt href="/login" sectionKey="programs" />;

  return (
    <div className="space-y-3">
      <Note error={error} info={info} />
      {loading ? <p className="text-[12px] text-muted-foreground">Loading partner desk…</p> : null}
      <ForexPortalModuleCard title="Your partner code" subtitle="Share the code. Commission appears after the desk accrues it at the rate an admin set. A payout request waits for approval.">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-mono text-lg">{desk?.code ?? '—'}</p>
          <button
            type="button"
            className={quietBtn}
            disabled={!desk?.code}
            onClick={() => {
              if (!desk?.code) return;
              void navigator.clipboard.writeText(desk.code).then(
                () => setInfo('Code copied.'),
                () => setError('Copy the code manually.')
              );
            }}
          >
            Copy
          </button>
        </div>
        <p className="mt-2 text-[12px] text-muted-foreground">
          Rate {desk?.ratePercent ?? 0}% · Clients {desk?.clients ?? 0} · Available {fxMoney(desk?.availableCommission ?? 0)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <input className={`w-28 ${field}`} placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
          <button
            type="button"
            className={primaryBtn}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void forexApi.programsPartnerPayout(Number(amount)).then((raw) => {
                const res = unwrap(raw);
                setBusy(false);
                if (!res.ok) setError(res.error.message);
                else {
                  setInfo('Payout requested. It waits for approval.');
                  setAmount('');
                  void load();
                }
              });
            }}
          >
            Request payout
          </button>
        </div>
      </ForexPortalModuleCard>
      <ForexPortalModuleCard title="Have a code?" subtitle={desk?.linkedCode ? `This account is linked to ${desk.linkedCode}.` : 'Enter it once. It links this account to that partner.'}>
        {desk?.linkedCode ? (
          <p className="text-[12px] text-muted-foreground">A partner is already linked. It cannot be changed here.</p>
        ) : (
        <div className="flex flex-wrap gap-2">
          <input className={field} value={code} onChange={(e) => setCode(e.target.value)} placeholder="Partner code" />
          <button
            type="button"
            className={quietBtn}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void forexApi.programsPartnerLink(code).then((raw) => {
                const res = unwrap(raw);
                setBusy(false);
                if (!res.ok) setError(res.error.message);
                else {
                  setInfo('Partner linked.');
                  setCode('');
                  void load();
                }
              });
            }}
          >
            Link
          </button>
        </div>
        )}
      </ForexPortalModuleCard>
      <ForexPortalModuleCard title="Payout requests">
        {(desk?.payouts ?? []).length === 0 ? <p className="text-[12px] text-muted-foreground">No requests yet.</p> : null}
        <ul className="space-y-1 text-[12px]">
          {(desk?.payouts ?? []).map((p) => (
            <li key={p.payoutId}>
              {fxMoney(p.amount)} · {p.status}
            </li>
          ))}
        </ul>
      </ForexPortalModuleCard>
    </div>
  );
}

type RewardRule = {
  ruleId: string;
  kind: string;
  title: string;
  body: string;
  amount: number;
  ratePercent: number;
  withdrawable: boolean;
  usableAsMargin: boolean;
  enabled: boolean;
  claimed: boolean;
};

export function ForexRewardsDesk() {
  const authed = useAuthed();
  const [rules, setRules] = useState<RewardRule[]>([]);
  const [savings, setSavings] = useState<{ principal: number; ratePercent: number } | null>(null);
  const [achievements, setAchievements] = useState<Array<{ code: string; title: string; body: string; unlocked: boolean }>>([]);
  const [amount, setAmount] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = unwrap(await forexApi.programsRewards());
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setError(null);
    const data = res.data as { rules?: RewardRule[]; savings?: { principal: number; ratePercent: number } | null; achievements?: Array<{ code: string; title: string; body: string; unlocked: boolean }> };
    setRules(data.rules ?? []);
    setSavings(data.savings ?? null);
    setAchievements(data.achievements ?? []);
  }, []);

  useEffect(() => {
    if (authed) void load();
  }, [authed, load]);

  if (!authed) return <ForexSignInPrompt href="/login" sectionKey="programs" />;

  const bonus = rules.find((r) => r.kind === 'BONUS');
  const saveRule = rules.find((r) => r.kind === 'SAVINGS');

  return (
    <div className="space-y-3">
      <Note error={error} info={info} />
      {loading ? <p className="text-[12px] text-muted-foreground">Loading rewards…</p> : null}
      <div className="grid gap-3 lg:grid-cols-3">
        <ForexPortalModuleCard title={bonus?.title ?? 'Bonus'} subtitle={bonus?.enabled ? bonus.body : 'Not open'}>
          {bonus?.enabled ? (
            <>
              <p className="text-[13px]">{fxMoney(bonus.amount)} on the selected account.</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {bonus.usableAsMargin ? 'Can be used as margin. ' : ''}
                {bonus.withdrawable ? 'Can be withdrawn.' : 'Cannot be withdrawn.'}
              </p>
              <button
                type="button"
                className={`mt-3 ${primaryBtn}`}
                disabled={busy || bonus.claimed}
                onClick={() => {
                  setBusy(true);
                  setError(null);
                  void forexApi.programsClaimBonus(bonus.ruleId).then((raw) => {
                    const res = unwrap(raw);
                    setBusy(false);
                    if (!res.ok) setError(res.error.message);
                    else {
                      setInfo('Bonus credited.');
                      void load();
                    }
                  });
                }}
              >
                {bonus.claimed ? 'Claimed' : 'Claim'}
              </button>
            </>
          ) : (
            <p className="text-[12px] text-muted-foreground">An admin has not opened a bonus.</p>
          )}
        </ForexPortalModuleCard>
        <ForexPortalModuleCard title="Savings" subtitle={saveRule?.enabled ? `${saveRule.ratePercent}% published rate` : 'Not open'}>
          {savings ? (
            <>
              <p className="text-[13px]">{fxMoney(savings.principal)} set aside · {savings.ratePercent}%</p>
              <button
                type="button"
                className={`mt-3 ${quietBtn}`}
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError(null);
                  void forexApi.programsReturnSavings().then((raw) => {
                    const res = unwrap(raw);
                    setBusy(false);
                    if (!res.ok) setError(res.error.message);
                    else {
                      const returned = res.data as { interest?: number; principal?: number };
                      const interest = Number(returned.interest ?? 0);
                      setInfo(
                        interest > 0
                          ? `Returned ${fxMoney(returned.principal)} plus ${fxMoney(interest)} interest.`
                          : 'Savings returned to the trading balance.'
                      );
                      void load();
                    }
                  });
                }}
              >
                Return to trading
              </button>
            </>
          ) : saveRule?.enabled ? (
            <div className="flex flex-wrap items-end gap-2">
              <input className={`w-28 ${field}`} value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
              <button
                type="button"
                className={primaryBtn}
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError(null);
                  void forexApi.programsOpenSavings(Number(amount)).then((raw) => {
                    const res = unwrap(raw);
                    setBusy(false);
                    if (!res.ok) setError(res.error.message);
                    else {
                      setInfo('Cash moved out of the trading balance.');
                      void load();
                    }
                  });
                }}
              >
                Move aside
              </button>
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground">Savings is closed.</p>
          )}
        </ForexPortalModuleCard>
        <ForexPortalModuleCard title="Achievements">
          <ul className="space-y-2">
            {achievements.map((a) => (
              <li key={a.code} className="text-[12px]">
                <span className="font-medium">{a.title}</span>
                <span className="ml-2 text-muted-foreground">{a.unlocked ? 'Done' : 'Not yet'}</span>
                <p className="text-[11px] text-muted-foreground">{a.body}</p>
              </li>
            ))}
          </ul>
        </ForexPortalModuleCard>
      </div>
    </div>
  );
}

export function ForexAppsDesk() {
  const authed = useAuthed();
  const [strategies, setStrategies] = useState<Array<{ strategyId: string; name: string; risk: string; summary: string; armedAccountId: string | null }>>([]);
  const [androidUrl, setAndroidUrl] = useState('');
  const [iosUrl, setIosUrl] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = unwrap(await forexApi.programsApps());
    setLoading(false);
    if (!res.ok) {
      setError(res.error.message);
      return;
    }
    setError(null);
    const data = res.data as { strategies?: typeof strategies; androidUrl?: string; iosUrl?: string };
    setStrategies(data.strategies ?? []);
    setAndroidUrl(data.androidUrl ?? '');
    setIosUrl(data.iosUrl ?? '');
  }, []);

  useEffect(() => {
    if (authed) void load();
  }, [authed, load]);

  if (!authed) return <ForexSignInPrompt href="/login" sectionKey="programs" />;

  return (
    <div className="space-y-3">
      <Note error={error} info={info} />
      {loading ? <p className="text-[12px] text-muted-foreground">Loading tools…</p> : null}
      <ForexPortalModuleCard title="Algo" subtitle="Turn an approved strategy on for the selected account. The switch records the choice. It does not send an order.">
        {strategies.length === 0 ? <p className="text-[12px] text-muted-foreground">No approved strategy.</p> : null}
        <ul className="space-y-3">
          {strategies.map((s) => (
            <li key={s.strategyId} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[13px] font-medium">{s.name}</p>
                <p className="text-[11px] text-muted-foreground">{s.risk} · {s.summary}</p>
              </div>
              <button
                type="button"
                className={quietBtn}
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError(null);
                  void forexApi.programsArmAlgo({ strategyId: s.strategyId, enabled: !s.armedAccountId }).then((raw) => {
                    const res = unwrap(raw);
                    setBusy(false);
                    if (!res.ok) setError(res.error.message);
                    else {
                      setInfo(s.armedAccountId ? 'Strategy off.' : 'Strategy armed for this account.');
                      void load();
                    }
                  });
                }}
              >
                {s.armedAccountId ? 'Turn off' : 'Turn on'}
              </button>
            </li>
          ))}
        </ul>
      </ForexPortalModuleCard>
      <ForexPortalModuleCard title="Feedback">
        <textarea className={`min-h-24 w-full ${field}`} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What should be easier?" />
        <button
          type="button"
          className={`mt-2 ${quietBtn}`}
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setError(null);
            void forexApi.programsFeedback(message).then((raw) => {
              const res = unwrap(raw);
              setBusy(false);
              if (!res.ok) setError(res.error.message);
              else {
                setInfo('Sent.');
                setMessage('');
              }
            });
          }}
        >
          Send
        </button>
      </ForexPortalModuleCard>
      {androidUrl || iosUrl ? (
        <ForexPortalModuleCard title="App">
          <div className="flex flex-wrap gap-2">
            {androidUrl ? (
              <a className={quietBtn} href={androidUrl} target="_blank" rel="noreferrer">
                Android
              </a>
            ) : null}
            {iosUrl ? (
              <a className={quietBtn} href={iosUrl} target="_blank" rel="noreferrer">
                iOS
              </a>
            ) : null}
          </div>
        </ForexPortalModuleCard>
      ) : null}
    </div>
  );
}
