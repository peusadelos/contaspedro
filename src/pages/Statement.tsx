import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { Transaction } from '@/types/financial';
import { supabase, SupabaseTransaction } from '@/lib/supabase';
import { NewTransactionDialog } from '@/components/financial/NewTransactionDialog';
import { DeleteConfirmationDialog } from '@/components/financial/DeleteConfirmationDialog';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '@/hooks/useDarkMode';
import {
  ArrowLeft, LogOut, Moon, Sun, Menu, CreditCard,
  LayoutGrid, Receipt, TrendingUp, Search, X,
  Download, SlidersHorizontal, Pencil, Trash2, Share2,
  FileText, History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getTransactionStatus } from '@/lib/financialUtils';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  primary:            '#4F46E5',
  primaryDark:        '#3730A3',
  primaryBg:          '#EEF2FF',
  tertiary:           '#10B981',
  tertiaryFixed:      '#6FFBBE',
  tertiaryDark:       '#059669',
  error:              '#EF4444',
  surface:            '#F8F9FF',
  surfaceLowest:      '#FFFFFF',
  surfaceLow:         '#EFF4FF',
  surfaceMid:         '#E5EEFF',
  secondaryContainer: '#D5E0F8',
  onSurface:          '#0B1C30',
  onSurfaceVariant:   '#464555',
  neutral:            '#64748B',
  outline:            '#777587',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const toMonthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(v));

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

const getMonthOptions = (n = 6) => {
  const months = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    months.push({
      key: toMonthKey(d),
      label: d.toLocaleDateString('pt-BR', { month: 'short' }),
      full: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    });
  }
  return months;
};

// ─── Bottom Nav Item ───────────────────────────────────────────────────────────
const BottomNavItem = ({ icon, label, to, active }: {
  icon: React.ReactNode; label: string; to: string; active?: boolean;
}) => (
  <Link to={to}
    className={cn(
      'flex flex-col items-center justify-center px-4 py-2 rounded-2xl transition-all duration-200 active:scale-90 gap-0.5',
      active ? 'text-[#4F46E5] dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400 hover:text-[#4F46E5]'
    )}
    style={active ? { background: C.surfaceLow } : {}}
  >
    {icon}
    <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
  </Link>
);

// ─── Main ──────────────────────────────────────────────────────────────────────
interface StatementProps { session: Session; }

export default function Statement({ session }: StatementProps) {
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useDarkMode(); // ✅ shared hook

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(toMonthKey(new Date()));
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);

  const monthOptions = getMonthOptions(6);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions').select('*').order('due_date', { ascending: false });
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
    toast.success(added.length > 1 ? `${added.length} criadas!` : 'Adicionada!');
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

  // Monthly stats
  const monthTx  = transactions.filter(t => t.dueDate.startsWith(selectedMonth));
  const monthIn  = monthTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const monthOut = monthTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netChange = monthIn - monthOut;
  const prevTx    = transactions.filter(t => t.dueDate < selectedMonth);
  const prevBal   = prevTx.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0)
                  - prevTx.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const endBal    = prevBal + netChange;

  // Filtered list
  const filtered = monthTx.filter(t => {
    if (filterType === 'income'  && t.type !== 'income') return false;
    if (filterType === 'expense' && t.type !== 'expense') return false;
    if (filterStatus !== 'all' && getTransactionStatus(t) !== filterStatus) return false;
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }).sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

  // Group by date
  const grouped: { date: string; label: string; items: Transaction[] }[] = [];
  filtered.forEach(tx => {
    const lbl = new Date(tx.dueDate + 'T12:00:00')
      .toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      .toUpperCase();
    const g = grouped.find(g => g.date === tx.dueDate);
    if (g) g.items.push(tx);
    else grouped.push({ date: tx.dueDate, label: lbl, items: [tx] });
  });

  // Export CSV
  const handleExport = () => {
    const rows = [
      ['Data', 'Descrição', 'Categoria', 'Tipo', 'Valor', 'Status'],
      ...filtered.map(t => [
        t.dueDate, t.description, t.category,
        t.type === 'income' ? 'Receita' : 'Despesa',
        (t.type === 'expense' ? '-' : '') + t.amount.toFixed(2),
        t.isPaid ? 'Pago' : getTransactionStatus(t),
      ])
    ];
    const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `extrato-${selectedMonth}.csv` });
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado!');
  };

  const selMonth = monthOptions.find(m => m.key === selectedMonth);

  return (
    <div className="min-h-screen pb-20 sm:pb-0 bg-[#F8F9FF] dark:bg-slate-950">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#F8F9FF]/90 dark:bg-slate-950/90 backdrop-blur-md"
        style={{ borderBottom: '1px solid rgba(11,28,48,0.05)' }}>
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/">
              <button className="p-1 rounded-xl" style={{ color: C.primary }}>
                <ArrowLeft className="w-5 h-5" />
              </button>
            </Link>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` }}>W</div>
            <span className="font-bold hidden sm:block text-slate-900 dark:text-slate-100">WeekLeaks</span>
          </div>

          <div className="flex items-center gap-2">
            <NewTransactionDialog onAdd={handleAdd} trigger={
              <Button size="sm" className="h-8 rounded-lg text-xs gap-1" style={{ background: C.primary }}>
                + Nova
              </Button>
            } />

            {/* Hamburger — desktop only */}
            <div className="hidden sm:flex">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg px-2.5 gap-1.5">
                    <Menu className="w-3.5 h-3.5" /> Menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem asChild>
                    <Link to="/" className="flex items-center gap-2 cursor-pointer">
                      <LayoutGrid className="w-4 h-4 text-slate-500" /> Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/historico" className="flex items-center gap-2 cursor-pointer">
                      <TrendingUp className="w-4 h-4 text-slate-500" /> Histórico
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/cartoes" className="flex items-center gap-2 cursor-pointer">
                      <CreditCard className="w-4 h-4 text-slate-500" /> Cartões
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleExport} className="flex items-center gap-2 cursor-pointer">
                    <Download className="w-4 h-4 text-slate-500" /> Exportar CSV
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {/* ✅ Dark mode toggle */}
                  <DropdownMenuItem onClick={toggleDarkMode} className="flex items-center gap-2 cursor-pointer">
                    {darkMode ? <Sun className="w-4 h-4 text-slate-500" /> : <Moon className="w-4 h-4 text-slate-500" />}
                    {darkMode ? 'Modo claro' : 'Modo escuro'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => supabase.auth.signOut()}
                    className="flex items-center gap-2 cursor-pointer text-rose-600 dark:text-rose-400">
                    <LogOut className="w-4 h-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-5">

        {/* ── Month chips ── */}
        <div className="overflow-x-auto no-scrollbar py-1">
          <div className="flex gap-2 whitespace-nowrap">
            {monthOptions.map(m => (
              <button key={m.key} onClick={() => setSelectedMonth(m.key)}
                className="px-5 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 capitalize"
                style={selectedMonth === m.key
                  ? { background: C.primary, color: '#fff', boxShadow: `0 8px 20px ${C.primary}30` }
                  : { background: C.surfaceLow, color: C.onSurfaceVariant }
                }>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Statement summary card ── */}
        <div className="relative overflow-hidden rounded-[1.5rem] p-6 text-white"
          style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})`, boxShadow: `0 20px 40px ${C.primary}25` }}>
          <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full opacity-10"
            style={{ background: 'white', filter: 'blur(40px)' }} />
          <div className="relative z-10 space-y-5">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest opacity-70 mb-1">Período do Extrato</p>
                <h2 className="text-2xl font-extrabold capitalize">{selMonth?.full ?? selectedMonth}</h2>
              </div>
              <div className="p-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.18)' }}>
                <Receipt className="w-5 h-5" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs opacity-70 mb-0.5">Saldo Inicial</p>
                <p className="text-lg font-bold">{fmt(prevBal)}</p>
              </div>
              <div>
                <p className="text-xs opacity-70 mb-0.5">Saldo Final</p>
                <p className="text-lg font-bold">{fmt(endBal)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-4"
              style={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
              <div>
                <p className="text-xs opacity-70 mb-0.5">Variação Líquida</p>
                <div className="flex items-center gap-1.5">
                  <span style={{ color: netChange >= 0 ? C.tertiaryFixed : '#FCA5A5' }}>
                    {netChange >= 0 ? '↑' : '↓'}
                  </span>
                  <span className="font-bold" style={{ color: netChange >= 0 ? C.tertiaryFixed : '#FCA5A5' }}>
                    {netChange >= 0 ? '+' : '−'}{fmt(netChange)}
                  </span>
                </div>
              </div>
              <button onClick={handleExport}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
                style={{ background: 'white', color: C.primary }}>
                <Download className="w-4 h-4" /> CSV
              </button>
            </div>
          </div>
        </div>

        {/* ── Search + filter ── */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl"
            style={{ background: C.surfaceLow }}>
            <Search className="w-4 h-4 flex-shrink-0" style={{ color: C.outline }} />
            <input
              className="bg-transparent border-none p-0 text-sm outline-none w-full text-slate-900 dark:text-slate-100"
              placeholder="Buscar transações..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ color: C.outline }}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-3 rounded-xl" style={{ background: C.surfaceLow, color: C.onSurfaceVariant }}>
                <SlidersHorizontal className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {(['all', 'income', 'expense'] as const).map(v => (
                <DropdownMenuItem key={v} onClick={() => setFilterType(v)}
                  className={cn('cursor-pointer', filterType === v && 'font-bold')}>
                  {filterType === v ? '● ' : ''}{v === 'all' ? 'Todos' : v === 'income' ? 'Receitas' : 'Despesas'}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              {[['all', 'Qualquer status'], ['paid', '🟢 Pago'], ['pending', '🟡 Pendente'], ['overdue', '🔴 Atrasado'], ['future', '🔵 Futuro']].map(([v, l]) => (
                <DropdownMenuItem key={v} onClick={() => setFilterStatus(v)}
                  className={cn('cursor-pointer', filterStatus === v && 'font-bold')}>
                  {filterStatus === v ? '● ' : ''}{l}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {(search || filterType !== 'all' || filterStatus !== 'all') && (
          <p className="text-xs px-1 text-slate-500">
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
            {search && <span style={{ color: C.primary }}> · "{search}"</span>}
          </p>
        )}

        {/* ── Transaction list ── */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: C.primary, borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <div className="space-y-6 pb-4">
            {grouped.length === 0 ? (
              <div className="text-center py-16 rounded-[1.5rem] bg-white dark:bg-slate-900">
                <p className="text-slate-500 dark:text-slate-400">
                  {search ? `Nenhum resultado para "${search}"` : 'Nenhuma transação neste mês'}
                </p>
              </div>
            ) : (
              grouped.map(group => (
                <div key={group.date} className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider px-1"
                    style={{ color: C.onSurfaceVariant }}>
                    {group.label}
                  </h3>
                  <div className="space-y-2">
                    {group.items.map(tx => {
                      const isIncome = tx.type === 'income';
                      const emoji = categoryEmoji[tx.category] || '📌';
                      const status = getTransactionStatus(tx);
                      const iconBg = isIncome ? '#D1FAE5' : C.secondaryContainer;

                      return (
                        <div key={tx.id}
                          className="group flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer bg-white dark:bg-slate-900 hover:bg-[#EFF4FF] dark:hover:bg-slate-800"
                          style={{ boxShadow: '0 4px 20px rgba(11,28,48,0.02)' }}>
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform"
                              style={{ background: iconBg }}>
                              {emoji}
                            </div>
                            <div>
                              <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                                {tx.description}
                              </p>
                              <p className="text-xs mt-0.5 text-slate-500 dark:text-slate-400">
                                {tx.category}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-bold text-sm"
                                style={{ color: isIncome ? C.tertiaryDark : C.onSurface }}>
                                {isIncome ? '+' : '−'}{fmt(tx.amount)}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5"
                                style={{ color: C.outline }}>
                                {tx.isPaid ? 'Pago' : status === 'overdue' ? 'Atrasado' : status === 'future' ? 'Futuro' : 'Pendente'}
                              </p>
                            </div>
                            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={e => { e.stopPropagation(); setEditingTransaction(tx); }}
                                className="w-7 h-7 rounded-xl flex items-center justify-center"
                                style={{ color: C.neutral }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={e => { e.stopPropagation(); setDeletingTransaction(tx); }}
                                className="w-7 h-7 rounded-xl flex items-center justify-center"
                                style={{ color: C.error }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            {/* Summary footer */}
            {filtered.length > 0 && (
              <div className="grid grid-cols-3 gap-3 pt-2">
                {[
                  { label: 'Receitas', val: filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0), color: C.tertiary },
                  { label: 'Despesas', val: filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), color: C.error },
                  { label: 'Saldo', val: filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0) - filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0), color: C.primary },
                ].map(({ label, val, color }) => (
                  <div key={label} className="rounded-2xl p-4 text-center bg-white dark:bg-slate-900"
                    style={{ boxShadow: '0 4px 16px rgba(11,28,48,0.03)' }}>
                    <p className="text-xs mb-1 text-slate-500 dark:text-slate-400">{label}</p>
                    <p className="text-sm font-bold" style={{ color }}>{fmt(val)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Floating export button (mobile only) ── */}
      <div className="fixed bottom-24 right-5 z-50 sm:hidden">
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-3.5 rounded-2xl font-bold text-sm text-white active:scale-95 transition-all"
          style={{ background: C.primary, boxShadow: `0 16px 32px ${C.primary}40` }}>
          <Share2 className="w-4 h-4" /> Exportar
        </button>
      </div>

      {/* ── Bottom Nav (mobile only) ── */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex sm:hidden justify-around items-center px-4 pb-6 pt-3 rounded-t-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl"
        style={{ borderTop: '1px solid rgba(11,28,48,0.05)', boxShadow: '0 -8px 32px rgba(15,23,42,0.06)' }}>
        <BottomNavItem to="/" icon={<LayoutGrid className="w-5 h-5" />} label="Home" />
        <BottomNavItem to="/extrato" active={location.pathname === '/extrato'} icon={<Receipt className="w-5 h-5" />} label="Extrato" />
        <BottomNavItem to="/cartoes" icon={<CreditCard className="w-5 h-5" />} label="Cartões" />
        <BottomNavItem to="/historico" icon={<TrendingUp className="w-5 h-5" />} label="Histórico" />
        {/* ✅ Dark mode on mobile bottom nav */}
        <button onClick={toggleDarkMode}
          className="flex flex-col items-center justify-center px-4 py-2 gap-0.5 text-slate-500 dark:text-slate-400 transition-colors active:scale-90">
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="text-[10px] font-semibold uppercase tracking-wider">Tema</span>
        </button>
      </nav>

      {/* Dialogs */}
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
