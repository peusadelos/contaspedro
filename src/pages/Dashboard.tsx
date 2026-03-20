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
  Plus, Minus, TrendingUp, TrendingDown, Wallet,
  ChevronLeft, ChevronRight, CreditCard, LayoutGrid,
  Receipt, LogOut, Moon, Sun, Menu, FileText,
  History, AlertTriangle, ChevronRight as ChevronRightIcon,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  primary:          '#4F46E5',
  primaryDark:      '#3730A3',
  primaryLight:     '#818CF8',
  primaryBg:        '#EEF2FF',
  tertiary:         '#10B981',
  tertiaryDark:     '#059669',
  tertiaryBg:       '#D1FAE5',
  error:            '#EF4444',
  errorBg:          '#FEE2E2',
  surface:          '#F8F9FF',
  surfaceLowest:    '#FFFFFF',
  surfaceLow:       '#EFF4FF',
  surfaceMid:       '#E5EEFF',
  surfaceHigh:      '#DCE9FF',
  onSurface:        '#0F172A',
  onSurfaceVariant: '#475569',
  neutral:          '#64748B',
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
  new Intl.NumberFormat('pt-BR', {
    notation: 'compact', style: 'currency', currency: 'BRL', maximumFractionDigits: 1,
  }).format(v);

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

// ─── Summary Card ──────────────────────────────────────────────────────────────
const SummaryCard = ({ title, amount, icon: Icon, variant, subtitle }: {
  title: string; amount: number; icon: any;
  variant: 'income' | 'expense' | 'balance'; subtitle?: string;
}) => {
  const configs = {
    income:  { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800/50', iconBg: 'bg-emerald-100 dark:bg-emerald-900/50', iconColor: 'text-emerald-600 dark:text-emerald-400', label: 'text-emerald-700 dark:text-emerald-400', amount: 'text-emerald-800 dark:text-emerald-300', sub: 'text-emerald-600/70 dark:text-emerald-500/70' },
    expense: { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200 dark:border-rose-800/50', iconBg: 'bg-rose-100 dark:bg-rose-900/50', iconColor: 'text-rose-600 dark:text-rose-400', label: 'text-rose-700 dark:text-rose-400', amount: 'text-rose-800 dark:text-rose-300', sub: 'text-rose-600/70 dark:text-rose-500/70' },
    balance: { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200 dark:border-violet-800/50', iconBg: 'bg-violet-100 dark:bg-violet-900/50', iconColor: 'text-violet-600 dark:text-violet-400', label: 'text-violet-700 dark:text-violet-400', amount: 'text-violet-800 dark:text-violet-300', sub: 'text-violet-600/70 dark:text-violet-500/70' },
  }[variant];

  const prefix = variant === 'expense' && amount > 0 ? '−' : variant === 'balance' && amount < 0 ? '−' : '';

  return (
    <div className={`rounded-2xl border p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${configs.bg} ${configs.border}`}>
      <div className="flex items-start justify-between mb-3">
        <p className={`text-xs font-semibold uppercase tracking-wider ${configs.label}`}>{title}</p>
        <div className={`p-2 rounded-xl ${configs.iconBg}`}>
          <Icon className={`w-4 h-4 ${configs.iconColor}`} />
        </div>
      </div>
      <p className={`text-2xl font-bold tracking-tight ${configs.amount}`}>
        {prefix}{fmt(amount)}
      </p>
      {subtitle && <p className={`text-xs mt-1.5 ${configs.sub}`}>{subtitle}</p>}
    </div>
  );
};

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
  const status = getTransactionStatus(transaction);

  const statusStyles: Record<string, string> = {
    overdue:  'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50',
    pending:  'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50',
    future:   'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50',
    paid:     'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50',
  };

  const statusLabels: Record<string, string> = {
    overdue: 'Atrasado', pending: 'Pendente', future: 'Futuro', paid: 'Pago',
  };

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-card hover:bg-accent/30 transition-all duration-150 group">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base ${isIncome ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-slate-100 dark:bg-slate-800/60'}`}>
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground truncate">{transaction.description}</p>
          <p className={`text-sm font-bold flex-shrink-0 ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
            {isIncome ? '+' : '−'}{fmt(transaction.amount)}
          </p>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p className="text-xs text-muted-foreground">{transaction.category} · {date}</p>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyles[status] || statusStyles.pending}`}>
              {statusLabels[status] || status}
            </span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={e => { e.stopPropagation(); onTogglePaid(transaction.id); }}
                className="h-6 w-6 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-xs font-bold">✓</button>
              <button onClick={e => { e.stopPropagation(); onEdit(transaction); }}
                className="h-6 w-6 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent text-xs">✎</button>
              <button onClick={e => { e.stopPropagation(); onDelete(transaction); }}
                className="h-6 w-6 flex items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs">✕</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main ──────────────────────────────────────────────────────────────────────
interface DashboardProps { session: Session; }

export default function Dashboard({ session }: DashboardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(toMonthKey(new Date()));
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [darkMode]);

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

  useEffect(() => { setSelectedIds(new Set()); }, [selectedMonth, statusFilter]);

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
    if (error) { toast.error('Erro'); return; }
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
    toast.success('Status atualizado!');
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleSelectAll = () => {
    setSelectedIds(selectedIds.size === pendingTx.length ? new Set() : new Set(pendingTx.map(t => t.id)));
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('transactions').delete().in('id', ids);
    if (error) { toast.error('Erro ao excluir'); return; }
    setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));
    toast.success(`${ids.length} excluída(s)!`);
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
  };

  const navigateMonth = (dir: 'prev' | 'next') => {
    const [y, m] = selectedMonth.split('-').map(Number);
    setSelectedMonth(toMonthKey(new Date(y, m - 1 + (dir === 'next' ? 1 : -1), 1)));
  };

  // Derived
  const txMonth = transactions.filter(t => t.dueDate.startsWith(selectedMonth));
  const totalIncome  = txMonth.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = txMonth.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netBalance   = totalIncome - totalExpense;
  const incomeCount  = txMonth.filter(t => t.type === 'income').length;
  const expenseCount = txMonth.filter(t => t.type === 'expense').length;
  const overdueCount = txMonth.filter(t => getTransactionStatus(t) === 'overdue').length;

  const pendingTx = txMonth
    .filter(t => {
      if (t.isPaid) return false;
      if (statusFilter === 'all') return true;
      return getTransactionStatus(t) === statusFilter;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const expByCat = txMonth.filter(t => t.type === 'expense').reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount;
    return acc;
  }, {} as Record<string, number>);
  const totalExp = Object.values(expByCat).reduce((s, v) => s + v, 0);
  const topCats = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const DONUT_COLORS = [C.primary, C.tertiary, C.primaryLight];
  let donutOffset = 25;
  const segments = topCats.map(([cat, val], i) => {
    const pct = totalExp > 0 ? (val / totalExp) * 100 : 0;
    const seg = { cat, val, pct, color: DONUT_COLORS[i], offset: donutOffset };
    donutOffset -= pct;
    return seg;
  });

  const allSelected = pendingTx.length > 0 && selectedIds.size === pendingTx.length;
  const someSelected = selectedIds.size > 0;

  const addTrigger = (
    <Button size="sm" className="h-8 bg-violet-600 hover:bg-violet-700 rounded-lg text-xs gap-1.5 px-2.5 sm:px-3">
      <Plus className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="hidden sm:inline">Nova Transação</span>
    </Button>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">

          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` }}>
              W
            </div>
            <span className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight hidden sm:block">
              WeekLeaks
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:block truncate max-w-[160px]">
              {session.user.email}
            </span>
            <NewTransactionDialog onAdd={handleAdd} trigger={addTrigger} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg px-2.5 gap-1.5">
                  <Menu className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem asChild>
                  <Link to="/extrato" className="flex items-center gap-2 cursor-pointer">
                    <FileText className="w-4 h-4 text-slate-500" /> Extrato
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/historico" className="flex items-center gap-2 cursor-pointer">
                    <History className="w-4 h-4 text-slate-500" /> Histórico
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/cartoes" className="flex items-center gap-2 cursor-pointer">
                    <CreditCard className="w-4 h-4 text-slate-500" /> Cartões
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDarkMode(!darkMode)} className="flex items-center gap-2 cursor-pointer">
                  {darkMode ? <Sun className="w-4 h-4 text-slate-500" /> : <Moon className="w-4 h-4 text-slate-500" />}
                  {darkMode ? 'Modo claro' : 'Modo escuro'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => supabase.auth.signOut()}
                  className="flex items-center gap-2 cursor-pointer text-rose-600 dark:text-rose-400 focus:text-rose-600">
                  <LogOut className="w-4 h-4" /> Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-5 space-y-5">

        {/* ── Hero Card ───────────────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-6 sm:p-8 text-white relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
            boxShadow: `0 20px 40px ${C.primary}26`,
          }}
        >
          {/* Blobs */}
          <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full opacity-10"
            style={{ background: 'white', filter: 'blur(32px)' }} />
          <div className="absolute -bottom-8 -left-8 w-40 h-40 rounded-full opacity-10"
            style={{ background: C.tertiary, filter: 'blur(28px)' }} />

          <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              {/* Month nav */}
              <div className="flex items-center gap-2 mb-2">
                <button onClick={() => navigateMonth('prev')} className="opacity-60 hover:opacity-100 transition-opacity">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold uppercase tracking-widest opacity-70 capitalize">
                  {formatMonthLabel(selectedMonth)}
                </span>
                <button onClick={() => navigateMonth('next')} className="opacity-60 hover:opacity-100 transition-opacity">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-1">Saldo Líquido</p>
              <h2 className="font-extrabold tracking-tight mb-4 text-4xl sm:text-5xl leading-none">
                {netBalance < 0 ? '−' : ''}{fmt(netBalance)}
              </h2>
              {/* Pills */}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <TrendingUp className="w-3 h-3" />
                  <span className="text-xs font-medium opacity-80">Receitas</span>
                  <span className="text-xs font-bold">{fmt(totalIncome)}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.12)' }}>
                  <Minus className="w-3 h-3" />
                  <span className="text-xs font-medium opacity-80">Despesas</span>
                  <span className="text-xs font-bold">{fmt(totalExpense)}</span>
                </div>
                {overdueCount > 0 && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: 'rgba(239,68,68,0.25)' }}>
                    <AlertTriangle className="w-3 h-3 text-red-300" />
                    <span className="text-xs font-semibold text-red-200">{overdueCount} atrasado{overdueCount > 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick links on desktop */}
            <div className="flex gap-3 flex-wrap">
              <Link to="/extrato"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95"
                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(12px)', color: '#fff' }}>
                Ver Extrato <ChevronRightIcon className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* ── Summary Cards ────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Receitas</p>
              <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
                <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-emerald-800 dark:text-emerald-300">{fmt(totalIncome)}</p>
            <p className="text-xs mt-1.5 text-emerald-600/70 dark:text-emerald-500/70">{incomeCount} receita{incomeCount !== 1 ? 's' : ''} no mês</p>
          </div>

          <div className="rounded-2xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">Despesas</p>
              <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/50">
                <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-rose-800 dark:text-rose-300">{fmt(totalExpense)}</p>
            <p className="text-xs mt-1.5 text-rose-600/70 dark:text-rose-500/70">{expenseCount} despesa{expenseCount !== 1 ? 's' : ''} no mês</p>
          </div>

          <div className="rounded-2xl border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-950/30 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400">Saldo Líquido</p>
              <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/50">
                <Wallet className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
            </div>
            <p className="text-2xl font-bold tracking-tight text-violet-800 dark:text-violet-300">
              {netBalance < 0 ? '−' : ''}{fmt(netBalance)}
            </p>
            <p className="text-xs mt-1.5 text-violet-600/70 dark:text-violet-500/70">Receitas − despesas do mês</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
              <p className="text-sm text-slate-500">Carregando...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* ── Pending Transactions ─────────────────────────────────────── */}
            <div className="lg:col-span-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Pendentes</h2>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px] h-7 text-xs rounded-lg border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Filtrar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="overdue">🔴 Atrasados</SelectItem>
                    <SelectItem value="pending">🟡 Pendentes</SelectItem>
                    <SelectItem value="future">🔵 Futuros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {pendingTx.length > 0 && (
                <div className="flex items-center justify-between py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={allSelected} onChange={handleSelectAll}
                      className="w-4 h-4 cursor-pointer accent-violet-600" />
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {someSelected ? `${selectedIds.size} selecionada(s)` : 'Selecionar todas'}
                    </span>
                  </div>
                  {someSelected && (
                    <Button size="sm" variant="destructive" onClick={() => setShowBulkDeleteConfirm(true)}
                      className="h-6 text-xs gap-1 px-2.5">
                      <Trash2 className="w-3 h-3" /> Excluir {selectedIds.size}
                    </Button>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {pendingTx.length > 0 ? (
                  pendingTx.map(tx => (
                    <TxRow key={tx.id} transaction={tx}
                      onTogglePaid={handleToggle}
                      onEdit={setEditingTransaction}
                      onDelete={setDeletingTransaction}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                      <Plus className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Nenhuma transação pendente</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 capitalize">{formatMonthLabel(selectedMonth)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ── Right column: Donut + Piggy Bank ─────────────────────────── */}
            <div className="lg:col-span-2 space-y-4">

              {/* Spending donut */}
              <div>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Resumo</h2>
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex justify-between items-center mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Despesas por categoria</p>
                    <Link to="/extrato" className="text-xs font-semibold" style={{ color: C.primary }}>Ver tudo</Link>
                  </div>
                  {totalExp === 0 ? (
                    <p className="text-sm text-center py-6 text-muted-foreground">Sem despesas este mês</p>
                  ) : (
                    <div className="flex items-center gap-5">
                      <div className="relative w-28 h-28 flex-shrink-0">
                        <svg viewBox="0 0 36 36" className="w-full h-full">
                          <circle cx="18" cy="18" r="15.915" fill="transparent" stroke="#EFF4FF" strokeWidth="3.5" />
                          {segments.map((seg, i) => (
                            <circle key={i} cx="18" cy="18" r="15.915" fill="transparent"
                              stroke={seg.color} strokeWidth="3.5"
                              strokeDasharray={`${seg.pct} ${100 - seg.pct}`}
                              strokeDashoffset={seg.offset}
                              style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 0.5s' }}
                            />
                          ))}
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-[9px] font-bold uppercase text-muted-foreground">Total</span>
                          <span className="text-sm font-bold text-foreground">{fmtCompact(totalExp)}</span>
                        </div>
                      </div>
                      <div className="space-y-2.5 flex-1 min-w-0">
                        {segments.map((seg, i) => (
                          <div key={i} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: seg.color }} />
                              <span className="text-xs text-muted-foreground truncate">{seg.cat}</span>
                            </div>
                            <span className="text-xs font-bold text-foreground flex-shrink-0">
                              {totalExp > 0 ? Math.round((seg.val / totalExp) * 100) : 0}%
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Piggy bank */}
              <PiggyBankWidget session={session} />
            </div>
          </div>
        )}
      </main>

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
      <DeleteConfirmationDialog
        open={showBulkDeleteConfirm}
        onOpenChange={open => !open && setShowBulkDeleteConfirm(false)}
        transaction={null}
        customMessage={`Tem certeza que deseja excluir ${selectedIds.size} transação(ões)?`}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
}
