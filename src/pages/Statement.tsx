import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { Transaction } from '@/types/financial';
import { supabase, SupabaseTransaction } from '@/lib/supabase';
import { NewTransactionDialog } from '@/components/financial/NewTransactionDialog';
import { DeleteConfirmationDialog } from '@/components/financial/DeleteConfirmationDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '@/hooks/useDarkMode';
import { cn } from '@/lib/utils';
import { getTransactionStatus, getStatusLabel, getStatusBadgeVariant, getDaysOverdue } from '@/lib/financialUtils';
import { toast } from 'sonner';
import {
  Pencil, Trash2, LogOut, Moon, Sun, Search, X, Menu,
  LayoutGrid, Receipt, CreditCard, TrendingUp, FileText, History,
  Calculator,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ─── Helpers ───────────────────────────────────────────────────────────────────
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

const MONTHS = [
  { value: '01', label: 'Janeiro' }, { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },   { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },    { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },   { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },{ value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },{ value: '12', label: 'Dezembro' },
];
const getYearOptions = () => {
  const y = new Date().getFullYear();
  return [y - 2, y - 1, y, y + 1].map(v => ({ value: String(v), label: String(v) }));
};

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR');

// ─── Bottom Nav Item ───────────────────────────────────────────────────────────
const BottomNavItem = ({ icon, label, to, active }: { icon: React.ReactNode; label: string; to: string; active?: boolean }) => (
  <Link to={to}
    className={cn('flex flex-col items-center justify-center px-3 py-2 rounded-2xl transition-all duration-200 active:scale-90 gap-0.5 min-w-0',
      active ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400')}
    style={active ? { background: '#EFF4FF' } : {}}>
    {icon}
    <span className="text-[10px] font-semibold uppercase tracking-wider leading-none">{label}</span>
  </Link>
);

// ─── Main ──────────────────────────────────────────────────────────────────────
interface StatementProps { session: Session; }

export default function Statement({ session }: StatementProps) {
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useDarkMode();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterMonthNum, setFilterMonthNum] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);

  // ✅ Selection state for sum feature
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // Clear selection when filters change
  useEffect(() => { setSelectedIds(new Set()); }, [filterMonthNum, filterYear, filterCategory, filterType, filterStatus, search]);

  const handleAdd = async (newTx: Omit<Transaction, 'id'>[]) => {
    const rows = newTx.map(t => toSupabase(t, session.user.id));
    const { data, error } = await supabase.from('transactions').insert(rows).select();
    if (error) { toast.error('Erro ao adicionar'); return; }
    setTransactions(prev => [...(data as SupabaseTransaction[]).map(fromSupabase), ...prev]);
  };

  const handleEdit = async (tx: Transaction) => {
    const { error } = await supabase.from('transactions').update(toSupabase(tx, session.user.id)).eq('id', tx.id);
    if (error) { toast.error('Erro ao editar'); return; }
    setTransactions(prev => prev.map(t => t.id === tx.id ? tx : t));
    setEditingTransaction(undefined);
    toast.success('Transação atualizada!');
  };

  const handleDelete = async () => {
    if (!deletingTransaction) return;
    const { error } = await supabase.from('transactions').delete().eq('id', deletingTransaction.id);
    if (error) { toast.error('Erro'); return; }
    setTransactions(prev => prev.filter(t => t.id !== deletingTransaction.id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(deletingTransaction.id); return n; });
    toast.success('Excluída!');
    setDeletingTransaction(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const filteredTransactions = transactions.filter(t => {
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterYear !== 'all' && !t.dueDate.startsWith(filterYear)) return false;
    if (filterMonthNum !== 'all' && t.dueDate.slice(5, 7) !== filterMonthNum) return false;
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterStatus !== 'all' && getTransactionStatus(t) !== filterStatus) return false;
    return true;
  }).sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

  const allCategories = Array.from(new Set(transactions.map(t => t.category)));
  const hasActiveFilters = search || filterMonthNum !== 'all' || filterYear !== 'all' || filterCategory !== 'all' || filterType !== 'all' || filterStatus !== 'all';

  const clearAllFilters = () => {
    setSearch(''); setFilterMonthNum('all'); setFilterYear('all');
    setFilterCategory('all'); setFilterType('all'); setFilterStatus('all');
  };

  // ✅ Selection sum calculations
  const selectedTransactions = filteredTransactions.filter(t => selectedIds.has(t.id));
  const selectionCount    = selectedTransactions.length;
  const selectionIncome   = selectedTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const selectionExpense  = selectedTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const selectionNet      = selectionIncome - selectionExpense;
  const hasSelection      = selectionCount > 0;

  // Total summary (all filtered)
  const totalIncome  = filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = filteredTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalNet     = totalIncome - totalExpense;

  const yearOptions = getYearOptions();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 sm:pb-0">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm bg-indigo-600">W</div>
            <span className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight hidden sm:block">WeekLeaks</span>
          </Link>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:block truncate max-w-[160px]">{session.user.email}</span>
            <NewTransactionDialog onAdd={handleAdd} />
            <div className="hidden sm:flex">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg px-2.5 gap-1.5">
                    <Menu className="w-3.5 h-3.5" /> Menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem asChild><Link to="/" className="flex items-center gap-2 cursor-pointer"><LayoutGrid className="w-4 h-4 text-slate-500" /> Dashboard</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/historico" className="flex items-center gap-2 cursor-pointer"><History className="w-4 h-4 text-slate-500" /> Histórico</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/cartoes" className="flex items-center gap-2 cursor-pointer"><CreditCard className="w-4 h-4 text-slate-500" /> Cartões</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={toggleDarkMode} className="flex items-center gap-2 cursor-pointer">
                    {darkMode ? <Sun className="w-4 h-4 text-slate-500" /> : <Moon className="w-4 h-4 text-slate-500" />}
                    {darkMode ? 'Modo claro' : 'Modo escuro'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 cursor-pointer text-rose-600 dark:text-rose-400">
                    <LogOut className="w-4 h-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-5">

        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Extrato</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Todas as suas transações</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Buscar por descrição..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-9 h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Mês</label>
            <Select value={filterMonthNum} onValueChange={setFilterMonthNum}>
              <SelectTrigger className="h-9 text-sm rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {MONTHS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Ano</label>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="h-9 text-sm rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {yearOptions.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Categoria</label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-9 text-sm rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Tipo</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 text-sm rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-sm rounded-lg border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">🟢 Quitado</SelectItem>
                <SelectItem value="pending">🟡 Pendente</SelectItem>
                <SelectItem value="overdue">🔴 Atrasado</SelectItem>
                <SelectItem value="future">🔵 Futuro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button variant="outline" onClick={clearAllFilters}
              className={cn('w-full h-9 text-sm rounded-lg text-slate-700 dark:text-slate-300', hasActiveFilters && 'border-violet-400 text-violet-600 dark:border-violet-600 dark:text-violet-400')}>
              {hasActiveFilters ? <><X className="w-3.5 h-3.5 mr-1.5" />Limpar</> : 'Limpar filtros'}
            </Button>
          </div>
        </div>

        {hasActiveFilters && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filteredTransactions.length} resultado{filteredTransactions.length !== 1 ? 's' : ''}
            {search && <span className="font-medium text-violet-600 dark:text-violet-400"> para "{search}"</span>}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* ✅ Selection hint — shows when no selection yet */}
            {!hasSelection && filteredTransactions.length > 0 && (
              <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5" />
                Clique em transações para somá-las
              </p>
            )}

            {/* Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-800 hover:bg-transparent">
                    {/* ✅ Checkbox column header */}
                    <TableHead className="w-10 pl-4">
                      <input type="checkbox"
                        checked={filteredTransactions.length > 0 && selectedIds.size === filteredTransactions.length}
                        onChange={() => {
                          if (selectedIds.size === filteredTransactions.length) setSelectedIds(new Set());
                          else setSelectedIds(new Set(filteredTransactions.map(t => t.id)));
                        }}
                        className="w-3.5 h-3.5 cursor-pointer accent-violet-600"
                      />
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400">Vencimento</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400">Descrição</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:table-cell">Categoria</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden md:table-cell">Tipo</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Valor</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right hidden lg:table-cell">Quitação</TableHead>
                    <TableHead className="text-xs font-semibold text-slate-500 dark:text-slate-400 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length > 0 ? filteredTransactions.map(tx => {
                    const status = getTransactionStatus(tx);
                    const daysOverdue = getDaysOverdue(tx);
                    const isSelected = selectedIds.has(tx.id);
                    return (
                      <TableRow key={tx.id}
                        onClick={() => toggleSelect(tx.id)}
                        className={cn(
                          'border-slate-100 dark:border-slate-800/60 cursor-pointer transition-colors',
                          // ✅ Fix: proper dark mode colors on selected/overdue rows
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/60'
                            : status === 'overdue'
                              ? 'bg-rose-50/50 dark:bg-rose-950/10 hover:bg-rose-50 dark:hover:bg-rose-950/20'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        )}>
                        {/* Checkbox */}
                        <TableCell className="pl-4 w-10" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(tx.id)}
                            className="w-3.5 h-3.5 cursor-pointer accent-violet-600" />
                        </TableCell>
                        <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                          <div>{fmtDate(tx.dueDate)}</div>
                          {daysOverdue > 0 && <div className="text-xs text-rose-600 dark:text-rose-400 font-medium">{daysOverdue}d atraso</div>}
                        </TableCell>
                        {/* ✅ Fix: dark:text-slate-100 ensures description is visible in dark mode */}
                        <TableCell className="font-medium text-sm text-slate-900 dark:text-slate-100">
                          <div className="flex items-center gap-1">
                            {search ? (
                              <span dangerouslySetInnerHTML={{
                                __html: tx.description.replace(
                                  new RegExp(`(${search})`, 'gi'),
                                  '<mark class="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded px-0.5">$1</mark>'
                                )
                              }} />
                            ) : tx.description}
                            {(tx as any).recurringGroup && (
                              <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 dark:text-slate-500 px-1 rounded" title="Recorrente">↺</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-xs text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700">{tx.category}</Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge className={cn('text-xs', tx.type === 'income'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0'
                            : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 border-0')}>
                            {tx.type === 'income' ? 'Receita' : 'Despesa'}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn('text-right font-bold text-sm',
                          tx.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                          {tx.type === 'income' ? '+' : '−'}{fmt(tx.amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={getStatusBadgeVariant(status)} className="text-xs">{getStatusLabel(status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-400 dark:text-slate-500 hidden lg:table-cell">
                          {tx.paidDate ? fmtDate(tx.paidDate) : '—'}
                        </TableCell>
                        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setEditingTransaction(tx)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeletingTransaction(tx)}
                              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }) : (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">
                        {hasActiveFilters ? 'Nenhuma transação encontrada com esses filtros' : 'Nenhuma transação ainda'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* ✅ Selection sum bar — slides in when items are selected */}
            {hasSelection && (
              <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800/60 bg-indigo-50 dark:bg-indigo-950/40 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                    {selectionCount} selecionada{selectionCount !== 1 ? 's' : ''}
                  </span>
                  <button onClick={() => setSelectedIds(new Set())}
                    className="text-xs text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-200 underline ml-1">
                    limpar
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:gap-5">
                  {selectionIncome > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Receitas:</span>
                      <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">+{fmt(selectionIncome)}</span>
                    </div>
                  )}
                  {selectionExpense > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Despesas:</span>
                      <span className="text-sm font-bold text-rose-600 dark:text-rose-400">−{fmt(selectionExpense)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 pl-3 border-l border-indigo-200 dark:border-indigo-700">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Saldo:</span>
                    <span className={cn('text-sm font-bold', selectionNet >= 0 ? 'text-indigo-600 dark:text-indigo-300' : 'text-rose-600 dark:text-rose-400')}>
                      {selectionNet >= 0 ? '+' : '−'}{fmt(selectionNet)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Summary footer (all filtered) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 border border-emerald-200 dark:border-emerald-800/50 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">Total Receitas</p>
                <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300">{fmt(totalIncome)}</p>
              </div>
              <div className="p-4 border border-rose-200 dark:border-rose-800/50 rounded-xl bg-rose-50 dark:bg-rose-950/30">
                <p className="text-xs text-rose-700 dark:text-rose-400 mb-1">Total Despesas</p>
                <p className="text-xl font-bold text-rose-800 dark:text-rose-300">{fmt(totalExpense)}</p>
              </div>
              <div className="p-4 border border-violet-200 dark:border-violet-800/50 rounded-xl bg-violet-50 dark:bg-violet-950/30">
                <p className="text-xs text-violet-700 dark:text-violet-400 mb-1">Saldo</p>
                <p className="text-xl font-bold text-violet-800 dark:text-violet-300">{totalNet >= 0 ? '' : '−'}{fmt(totalNet)}</p>
              </div>
            </div>
          </>
        )}
      </main>

      {/* ── Bottom Nav (mobile only) ── */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex sm:hidden justify-around items-center px-2 pb-6 pt-3 rounded-t-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl"
        style={{ borderTop: '1px solid rgba(15,23,42,0.06)', boxShadow: '0 -8px 32px rgba(15,23,42,0.07)' }}>
        <BottomNavItem to="/" icon={<LayoutGrid className="w-5 h-5" />} label="Home" />
        <BottomNavItem to="/extrato" active={location.pathname === '/extrato'} icon={<Receipt className="w-5 h-5" />} label="Extrato" />
        <BottomNavItem to="/cartoes" icon={<CreditCard className="w-5 h-5" />} label="Cartões" />
        <BottomNavItem to="/historico" icon={<TrendingUp className="w-5 h-5" />} label="Histórico" />
        <button onClick={toggleDarkMode}
          className="flex flex-col items-center justify-center px-3 py-2 rounded-2xl gap-0.5 min-w-0 text-slate-500 dark:text-slate-400 active:scale-90">
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="text-[10px] font-semibold uppercase tracking-wider leading-none">Tema</span>
        </button>
      </nav>

      {editingTransaction && <NewTransactionDialog transaction={editingTransaction} onEdit={handleEdit} trigger={<div />} />}
      <DeleteConfirmationDialog open={!!deletingTransaction} onOpenChange={open => !open && setDeletingTransaction(null)} transaction={deletingTransaction} onConfirm={handleDelete} />
    </div>
  );
}
