import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { Transaction, CategorySummary } from '@/types/financial';
import { supabase, SupabaseTransaction } from '@/lib/supabase';
import { NewTransactionDialog } from '@/components/financial/NewTransactionDialog';
import { DeleteConfirmationDialog } from '@/components/financial/DeleteConfirmationDialog';
import { PiggyBankWidget } from '@/components/financial/PiggyBankWidget';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { getTransactionStatus } from '@/lib/financialUtils';
import {
  Plus, Minus, TrendingUp, ChevronLeft, ChevronRight,
  CreditCard, LayoutGrid, Receipt, LogOut, ChevronRight as ChevronRightIcon,
  AlertTriangle
} from 'lucide-react';

// ─── Design tokens ─────────────────────────────────────────────────────────────
// Updated to match Stitch style guide: Primary #4F46E5, Secondary #1E293B,
// Tertiary #10B981, Neutral #64748B
const C = {
  // Primary — indigo
  primary:              '#4F46E5',
  primaryDark:          '#3730A3',
  primaryLight:         '#818CF8',
  primaryBg:            '#EEF2FF',

  // Secondary — dark navy
  secondary:            '#1E293B',
  secondaryMid:         '#334155',
  secondaryLight:       '#64748B',

  // Tertiary — emerald (positive/income)
  tertiary:             '#10B981',
  tertiaryDark:         '#059669',
  tertiaryBg:           '#D1FAE5',

  // Neutral — slate
  neutral:              '#64748B',
  neutralLight:         '#94A3B8',
  neutralBg:            '#F1F5F9',

  // Error — red (expense/negative)
  error:                '#EF4444',
  errorBg:              '#FEE2E2',

  // Surfaces — light blue-tinted layers
  surface:              '#F8F9FF',
  surfaceLowest:        '#FFFFFF',
  surfaceLow:           '#EFF4FF',
  surfaceMid:           '#E5EEFF',
  surfaceHigh:          '#DCE9FF',

  // Text
  onSurface:            '#0F172A',
  onSurfaceVariant:     '#475569',
  onPrimary:            '#FFFFFF',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toMonthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const formatMonthLabel = (key: string) => {
  const [y, m] = key.split('-');
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(v));

const fmtCompact = (v: number) =>
  new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL', maximumFractionDigits: 1 }).format(v);

const fromSupabase = (row: SupabaseTransaction): Transaction => ({
  id: row.id, description: row.description, amount: row.amount,
  date: row.date, createdDate: row.created_date, dueDate: row.due_date,
  paidDate: row.paid_date ?? undefined,
  category: row.category as Transaction['category'],
  type: row.type as Transaction['type'],
  isPaid: row.is_paid, recurringGroup: row.recurring_group ?? undefined,
});

const toSupabase = (t: Omit<Transaction, 'id'>, userId: string) => ({
  user_id: userId, description: t.description, amount: t.amount,
  date: t.date, created_date: t.createdDate, due_date: t.dueDate,
  paid_date: t.paidDate ?? null, category: t.category, type: t.type,
  is_paid: t.isPaid, recurring_group: (t as any).recurringGroup ?? null,
});

const categoryEmoji: Record<string, string> = {
  'Contas': '🏠', 'Gastos Pessoais': '🛒', 'Compras': '🛍️',
  'Pagamento de Dívidas': '💳', 'Salário': '💼', 'Freela': '💻', 'Extra': '⭐',
  'Alimentação': '🍔', 'Transporte': '🚗', 'Lazer': '🎮',
  'Viagem': '✈️', 'Educação': '🎓', 'Pet': '🐾', 'Saúde': '❤️',
};

// ─── Bottom Nav Item ───────────────────────────────────────────────────────────
const NavItem = ({ icon, label, active, to }: {
  icon: React.ReactNode; label: string; active?: boolean; to: string;
}) => (
  <Link to={to} className="flex flex-col items-center justify-center px-5 py-2 rounded-2xl transition-all duration-200 active:scale-90"
    style={{
      background: active ? C.surfaceLow : 'transparent',
      color: active ? C.primary : C.neutral,
      fontFamily: 'Inter',
    }}>
    {icon}
    <span className="text-[10px] font-semibold uppercase tracking-wider mt-1">{label}</span>
  </Link>
);

// ─── Transaction Row ───────────────────────────────────────────────────────────
const TxRow = ({ transaction, onTogglePaid, onEdit, onDelete }: {
  transaction: Transaction;
  onTogglePaid: (id: string) => void;
  onEdit: (t: Transaction) => void;
  onDelete: (t: Transaction) => void;
}) => {
  const isIncome = transaction.type === 'income';
  const emoji = categoryEmoji[transaction.category] || '📌';
  const date = new Date(transaction.dueDate + 'T12:00:00')
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

  return (
    <div
      className="flex items-center justify-between p-4 rounded-2xl cursor-pointer group transition-all duration-150"
      style={{ background: C.surfaceLow }}
      onMouseEnter={e => (e.currentTarget.style.background = C.surfaceMid)}
      onMouseLeave={e => (e.currentTarget.style.background = C.surfaceLow)}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm group-hover:scale-110 transition-transform duration-150"
          style={{ background: C.surfaceLowest }}
        >
          {emoji}
        </div>
        <div>
          <h4 className="font-semibold text-sm" style={{ color: C.onSurface, fontFamily: 'Inter' }}>
            {transaction.description}
          </h4>
          <p className="text-xs mt-0.5" style={{ color: C.onSurfaceVariant, fontFamily: 'Inter' }}>
            {transaction.category} · {date}
            {transaction.isPaid && <span className="ml-1.5 text-[10px] font-semibold" style={{ color: C.tertiary }}>● Pago</span>}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-bold text-sm" style={{
          color: isIncome ? C.tertiary : C.error,
          fontFamily: 'Inter'
        }}>
          {isIncome ? '+' : '−'}{fmt(transaction.amount)}
        </span>
        {/* Hover actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onTogglePaid(transaction.id); }}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold transition-colors hover:bg-white"
            style={{ color: C.tertiary }} title="Marcar pago">✓</button>
          <button onClick={e => { e.stopPropagation(); onEdit(transaction); }}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-xs transition-colors hover:bg-white"
            style={{ color: C.neutral }} title="Editar">✎</button>
          <button onClick={e => { e.stopPropagation(); onDelete(transaction); }}
            className="w-7 h-7 rounded-xl flex items-center justify-center text-xs transition-colors hover:bg-white"
            style={{ color: C.error }} title="Excluir">✕</button>
        </div>
      </div>
    </div>
  );
};

// ─── Stat pill ─────────────────────────────────────────────────────────────────
const StatPill = ({ label, value, positive }: { label: string; value: string; positive: boolean }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
    <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
      {positive ? <TrendingUp className="w-2.5 h-2.5 text-white" /> : <Minus className="w-2.5 h-2.5 text-white" />}
    </div>
    <span className="text-xs text-white/80 font-medium" style={{ fontFamily: 'Inter' }}>{label}</span>
    <span className="text-xs text-white font-bold" style={{ fontFamily: 'Inter' }}>{value}</span>
  </div>
);

// ─── Main ──────────────────────────────────────────────────────────────────────
interface DashboardProps { session: Session; }

export default function Dashboard({ session }: DashboardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(toMonthKey(new Date()));
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('transactions').select('*').order('due_date', { ascending: false });
      if (error) toast.error('Erro ao carregar transações');
      else setTransactions((data as SupabaseTransaction[]).map(fromSupabase));
      setLoading(false);
    };
    load();
  }, []);

  const handleAdd = async (newTx: Omit<Transaction, 'id'>[]) => {
    const rows = newTx.map(t => toSupabase(t, session.user.id));
    const { data, error } = await supabase.from('transactions').insert(rows).select();
    if (error) { toast.error('Erro ao adicionar'); return; }
    const added = (data as SupabaseTransaction[]).map(fromSupabase);
    setTransactions(prev => [...added, ...prev]);
    toast.success(added.length > 1 ? `${added.length} transações criadas!` : 'Transação adicionada!');
  };

  const handleEdit = async (tx: Transaction) => {
    const { error } = await supabase.from('transactions').update(toSupabase(tx, session.user.id)).eq('id', tx.id);
    if (error) { toast.error('Erro ao editar'); return; }
    setTransactions(prev => prev.map(t => t.id === tx.id ? tx : t));
    setEditingTransaction(undefined);
    toast.success('Atualizada!');
  };

  const handleDelete = async () => {
    if (!deletingTransaction) return;
    const { error } = await supabase.from('transactions').delete().eq('id', deletingTransaction.id);
    if (error) { toast.error('Erro ao excluir'); return; }
    setTransactions(prev => prev.filter(t => t.id !== deletingTransaction.id));
    toast.success('Excluída!');
    setDeletingTransaction(null);
  };

  const handleToggle = async (id: string) => {
    const t = transactions.find(t => t.id === id);
    if (!t) return;
    const updated = { ...t, isPaid: !t.isPaid, paidDate: !t.isPaid ? new Date().toISOString().split('T')[0] : undefined };
    const { error } = await supabase.from('transactions').update({ is_paid: updated.isPaid, paid_date: updated.paidDate ?? null }).eq('id', id);
    if (error) { toast.error('Erro'); return; }
    setTransactions(prev => prev.map(t => t.id === id ? updated : t));
  };

  const navigateMonth = (dir: 'prev' | 'next') => {
    const [y, m] = selectedMonth.split('-').map(Number);
    setSelectedMonth(toMonthKey(new Date(y, m - 1 + (dir === 'next' ? 1 : -1), 1)));
  };

  // Derived
  const txMonth = transactions.filter(t => t.dueDate.startsWith(selectedMonth));
  const totalIncome = txMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = txMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netBalance = totalIncome - totalExpense;
  const overdueCount = txMonth.filter(t => getTransactionStatus(t) === 'overdue').length;
  const recentTx = transactions.slice(0, 5);

  // Spending by category
  const expByCat = txMonth.filter(t => t.type === 'expense').reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);
  const totalExp = Object.values(expByCat).reduce((s, v) => s + v, 0);
  const topCats = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Donut segments
  const DONUT_COLORS = [C.primary, C.tertiary, C.primaryLight];
  let donutOffset = 25;
  const segments = topCats.map(([cat, val], i) => {
    const pct = totalExp > 0 ? (val / totalExp) * 100 : 0;
    const seg = { cat, val, pct, color: DONUT_COLORS[i], offset: donutOffset };
    donutOffset -= pct;
    return seg;
  });

  const addTrigger = (
    <button
      className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 hover:scale-105 duration-150"
      style={{ background: '#6FFBBE', color: '#065F46', fontFamily: 'Inter', boxShadow: '0 4px 14px rgba(111,255,190,0.3)' }}
    >
      <Plus className="w-4 h-4" /> Nova Transação
    </button>
  );

  return (
    <div className="min-h-screen pb-32" style={{ background: C.surface, fontFamily: 'Inter' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40" style={{ background: C.surface }}>
        <div className="flex justify-between items-center px-5 py-4 max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` }}
            >
              {session.user.email?.[0]?.toUpperCase() ?? 'W'}
            </div>
            <div>
              <p className="text-xs font-medium" style={{ color: C.neutral }}>Bem-vindo,</p>
              <h1 className="font-bold text-base leading-tight" style={{ color: C.onSurface, fontFamily: 'Plus Jakarta Sans' }}>
                WeekLeaks
              </h1>
            </div>
          </div>
          <button
            onClick={async () => await supabase.auth.signOut()}
            className="w-10 h-10 rounded-2xl flex items-center justify-center transition-colors"
            style={{ background: C.surfaceLow, color: C.neutral }}
            title="Sair"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-5 space-y-5">

        {/* ── Hero: Balance Card ───────────────────────────────────────────── */}
        <div
          className="rounded-[2rem] p-7 text-white relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
            boxShadow: `0 20px 40px ${C.primary}26`,
          }}
        >
          {/* Decorative blobs */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-10"
            style={{ background: 'white', filter: 'blur(32px)' }} />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full opacity-10"
            style={{ background: C.tertiary, filter: 'blur(28px)' }} />

          <div className="relative z-10">
            {/* Month nav */}
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => navigateMonth('prev')} className="opacity-60 hover:opacity-100 transition-opacity active:scale-90">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold uppercase tracking-widest opacity-70 capitalize" style={{ fontFamily: 'Inter' }}>
                {formatMonthLabel(selectedMonth)}
              </span>
              <button onClick={() => navigateMonth('next')} className="opacity-60 hover:opacity-100 transition-opacity active:scale-90">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Balance */}
            <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-1" style={{ fontFamily: 'Inter' }}>
              Saldo Líquido
            </p>
            <h2
              className="font-extrabold tracking-tight mb-5"
              style={{ fontSize: '2.75rem', fontFamily: 'Plus Jakarta Sans', lineHeight: 1.05 }}
            >
              {netBalance < 0 ? '−' : ''}{fmt(netBalance)}
            </h2>

            {/* Stat pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              <StatPill label="Receitas" value={fmt(totalIncome)} positive={true} />
              <StatPill label="Despesas" value={fmt(totalExpense)} positive={false} />
              {overdueCount > 0 && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(239,68,68,0.25)' }}>
                  <AlertTriangle className="w-3 h-3 text-red-300" />
                  <span className="text-xs text-red-200 font-semibold">{overdueCount} atrasado{overdueCount > 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* CTA */}
            <div className="flex gap-3 flex-wrap">
              <NewTransactionDialog onAdd={handleAdd} trigger={addTrigger} />
              <Link
                to="/extrato"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', color: '#fff', fontFamily: 'Inter' }}
              >
                Ver Extrato <ChevronRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: C.primary, borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            {/* ── Two-col: Spending + Piggy Bank ──────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

              {/* Spending donut */}
              <div
                className="rounded-[1.75rem] p-5"
                style={{ background: C.surfaceLowest, boxShadow: '0 8px 24px rgba(15,23,42,0.05)' }}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-base" style={{ color: C.onSurface, fontFamily: 'Plus Jakarta Sans' }}>
                    Gastos
                  </h3>
                  <Link to="/extrato" className="text-xs font-semibold" style={{ color: C.primary }}>Ver tudo</Link>
                </div>

                {totalExp === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: C.onSurfaceVariant }}>Sem despesas</p>
                ) : (
                  <div className="flex items-center gap-5">
                    {/* Donut */}
                    <div className="relative w-28 h-28 flex-shrink-0">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                        <circle cx="18" cy="18" r="15.915" fill="transparent" stroke={C.surfaceLow} strokeWidth="3.5" />
                        {segments.map((seg, i) => (
                          <circle key={i} cx="18" cy="18" r="15.915" fill="transparent"
                            stroke={seg.color} strokeWidth="3.5"
                            strokeDasharray={`${seg.pct} ${100 - seg.pct}`}
                            strokeDashoffset={-seg.offset + 25}
                            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                          />
                        ))}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[9px] font-bold uppercase tracking-wide" style={{ color: C.neutral }}>Total</span>
                        <span className="text-sm font-extrabold" style={{ color: C.onSurface, fontFamily: 'Plus Jakarta Sans' }}>
                          {fmtCompact(totalExp)}
                        </span>
                      </div>
                    </div>

                    {/* Legend */}
                    <div className="space-y-2.5 flex-1 min-w-0">
                      {segments.map((seg, i) => (
                        <div key={i} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                            <span className="text-xs font-medium truncate" style={{ color: C.onSurfaceVariant }}>{seg.cat}</span>
                          </div>
                          <span className="text-xs font-bold flex-shrink-0" style={{ color: C.onSurface }}>
                            {totalExp > 0 ? Math.round((seg.val / totalExp) * 100) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Piggy bank */}
              <PiggyBankWidget session={session} />
            </div>

            {/* ── Recent Activity ─────────────────────────────────────────── */}
            <div
              className="rounded-[1.75rem] p-6"
              style={{ background: C.surfaceLowest, boxShadow: '0 8px 24px rgba(15,23,42,0.05)' }}
            >
              <div className="flex justify-between items-center mb-5">
                <h3 className="font-bold text-lg" style={{ color: C.onSurface, fontFamily: 'Plus Jakarta Sans' }}>
                  Atividade Recente
                </h3>
                <Link to="/extrato" className="text-xs font-semibold" style={{ color: C.primary }}>Ver tudo</Link>
              </div>

              {recentTx.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm font-medium" style={{ color: C.onSurfaceVariant }}>Nenhuma transação ainda</p>
                  <p className="text-xs mt-1" style={{ color: C.neutral }}>Adicione sua primeira transação acima</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentTx.map(tx => (
                    <TxRow key={tx.id} transaction={tx}
                      onTogglePaid={handleToggle}
                      onEdit={setEditingTransaction}
                      onDelete={setDeletingTransaction}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* ── Insight Banner ───────────────────────────────────────────── */}
            <div
              className="rounded-[1.75rem] p-6 mb-4"
              style={{ background: C.surfaceHigh, boxShadow: '0 4px 16px rgba(15,23,42,0.04)' }}
            >
              <span
                className="inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-3"
                style={{ background: `${C.primary}18`, color: C.primary }}
              >
                Dica Financeira
              </span>
              <h3 className="font-extrabold text-xl mb-2" style={{ color: C.onSurface, fontFamily: 'Plus Jakarta Sans' }}>
                Maximize sua poupança esta semana
              </h3>
              <p className="text-sm leading-relaxed mb-5" style={{ color: C.onSurfaceVariant }}>
                Revise suas transações recorrentes e identifique gastos que podem ser reduzidos ou eliminados este mês.
              </p>
              <div className="flex gap-3 flex-wrap">
                <Link to="/historico"
                  className="px-5 py-2.5 rounded-xl font-bold text-sm text-white inline-flex items-center gap-2 transition-all active:scale-95 hover:shadow-lg"
                  style={{ background: C.primary, boxShadow: `0 4px 16px ${C.primary}30` }}
                >
                  Ver Histórico <ChevronRightIcon className="w-4 h-4" />
                </Link>
                <Link to="/cartoes"
                  className="px-5 py-2.5 rounded-xl font-bold text-sm inline-flex items-center gap-2 transition-all active:scale-95"
                  style={{ background: C.surfaceLowest, color: C.primary }}
                >
                  Cartões <CreditCard className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── Bottom Nav ──────────────────────────────────────────────────────── */}
      <nav
        className="fixed bottom-0 left-0 w-full z-50 px-4 pb-safe pb-6 pt-3 flex justify-around items-center rounded-t-3xl"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: `1px solid ${C.onSurface}0D`,
          boxShadow: '0 -8px 32px rgba(15,23,42,0.06)',
        }}
      >
        <NavItem to="/" active icon={<LayoutGrid className="w-5 h-5" />} label="Home" />
        <NavItem to="/extrato" icon={<Receipt className="w-5 h-5" />} label="Extrato" />
        <NavItem to="/cartoes" icon={<CreditCard className="w-5 h-5" />} label="Cartões" />
        <NavItem to="/historico" icon={<TrendingUp className="w-5 h-5" />} label="Histórico" />
      </nav>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}
      {editingTransaction && (
        <NewTransactionDialog transaction={editingTransaction} onEdit={handleEdit} trigger={<div />} />
      )}
      <DeleteConfirmationDialog
        open={!!deletingTransaction}
        onOpenChange={open => !open && setDeletingTransaction(null)}
        transaction={deletingTransaction}
        onConfirm={handleDelete}
      />
    </div>
  );
}
