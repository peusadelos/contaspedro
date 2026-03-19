import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { Transaction, Category } from '@/types/financial';
import { supabase, SupabaseTransaction } from '@/lib/supabase';
import { NewTransactionDialog } from '@/components/financial/NewTransactionDialog';
import { DeleteConfirmationDialog } from '@/components/financial/DeleteConfirmationDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Pencil, Trash2, LogOut, Moon, Sun, Search, X, LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getTransactionStatus, getStatusLabel, getStatusBadgeVariant, getDaysOverdue } from '@/lib/financialUtils';
import { toast } from 'sonner';

const fromSupabase = (row: SupabaseTransaction): Transaction => ({
  id: row.id,
  description: row.description,
  amount: row.amount,
  date: row.date,
  createdDate: row.created_date,
  dueDate: row.due_date,
  paidDate: row.paid_date ?? undefined,
  category: row.category as Transaction['category'],
  type: row.type as Transaction['type'],
  isPaid: row.is_paid,
  recurringGroup: row.recurring_group ?? undefined,
});

const toSupabase = (t: Omit<Transaction, 'id'>, userId: string) => ({
  user_id: userId,
  description: t.description,
  amount: t.amount,
  date: t.date,
  created_date: t.createdDate,
  due_date: t.dueDate,
  paid_date: t.paidDate ?? null,
  category: t.category,
  type: t.type,
  is_paid: t.isPaid,
  recurring_group: (t as any).recurringGroup ?? null,
});

// ✅ Month/year options for Safari-compatible filter
const MONTHS = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
];

const getYearOptions = () => {
  const current = new Date().getFullYear();
  return [current - 2, current - 1, current, current + 1].map(y => ({
    value: String(y),
    label: String(y),
  }));
};

interface StatementProps {
  session: Session;
}

const Statement = ({ session }: StatementProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // ✅ FIX: Split filterMonth into separate month + year selects (Safari compatible)
  const [filterMonthNum, setFilterMonthNum] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');

  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const fetchTransactions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('due_date', { ascending: false });
      if (error) {
        toast.error('Erro ao carregar transações');
      } else {
        setTransactions((data as SupabaseTransaction[]).map(fromSupabase));
      }
      setLoading(false);
    };
    fetchTransactions();
  }, []);

  const handleAddTransaction = async (newTransactions: Omit<Transaction, 'id'>[]) => {
    const rows = newTransactions.map(t => toSupabase(t, session.user.id));
    const { data, error } = await supabase.from('transactions').insert(rows).select();
    if (error) {
      toast.error('Erro ao adicionar transação');
    } else {
      const added = (data as SupabaseTransaction[]).map(fromSupabase);
      setTransactions(prev => [...added, ...prev]);
    }
  };

  const handleEditTransaction = async (transaction: Transaction) => {
    const { error } = await supabase
      .from('transactions')
      .update(toSupabase(transaction, session.user.id))
      .eq('id', transaction.id);
    if (error) {
      toast.error('Erro ao editar transação');
    } else {
      setTransactions(prev => prev.map(t => t.id === transaction.id ? transaction : t));
      setEditingTransaction(undefined);
      toast.success('Transação atualizada!');
    }
  };

  const handleDeleteTransaction = async () => {
    if (!deletingTransaction) return;
    const { error } = await supabase.from('transactions').delete().eq('id', deletingTransaction.id);
    if (error) {
      toast.error('Erro ao excluir transação');
    } else {
      setTransactions(prev => prev.filter(t => t.id !== deletingTransaction.id));
      toast.success('Transação excluída!');
      setDeletingTransaction(null);
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const filteredTransactions = transactions
    .filter(t => {
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      // ✅ FIX: filter by month and year separately
      if (filterYear !== 'all' && !t.dueDate.startsWith(filterYear)) return false;
      if (filterMonthNum !== 'all' && t.dueDate.slice(5, 7) !== filterMonthNum) return false;
      if (filterCategory !== 'all' && t.category !== filterCategory) return false;
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterStatus !== 'all' && getTransactionStatus(t) !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

  const allCategories = Array.from(new Set(transactions.map(t => t.category)));
  const formatCurrency = (amount: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  const formatDate = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');
  const formatDateTime = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('pt-BR');

  const hasActiveFilters = search || filterMonthNum !== 'all' || filterYear !== 'all' ||
    filterCategory !== 'all' || filterType !== 'all' || filterStatus !== 'all';

  const clearAllFilters = () => {
    setSearch('');
    setFilterMonthNum('all');
    setFilterYear('all');
    setFilterCategory('all');
    setFilterType('all');
    setFilterStatus('all');
  };

  const yearOptions = getYearOptions();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
                <LayoutDashboard className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight hidden sm:block">
                WeekLeaks
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:block">{session.user.email}</span>
            <NewTransactionDialog onAdd={handleAddTransaction} />
            <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)}
              className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}
              className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-5">

        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Extrato</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Todas as suas transações</p>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Buscar por descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* ✅ Filters — month and year as separate dropdowns (works on Safari) */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">

          {/* Month dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Mês</label>
            <Select value={filterMonthNum} onValueChange={setFilterMonthNum}>
              <SelectTrigger className="h-9 text-sm rounded-lg border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Year dropdown */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Ano</label>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="h-9 text-sm rounded-lg border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {yearOptions.map(y => (
                  <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Categoria</label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-9 text-sm rounded-lg border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {allCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Tipo</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 text-sm rounded-lg border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-sm rounded-lg border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="paid">🟢 Quitado</SelectItem>
                <SelectItem value="pending">🟡 Pendente</SelectItem>
                <SelectItem value="overdue">🔴 Atrasado</SelectItem>
                <SelectItem value="future">🔵 Futuro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear */}
          <div className="flex items-end">
            <Button variant="outline" onClick={clearAllFilters}
              className={cn("w-full h-9 text-sm rounded-lg", hasActiveFilters && "border-violet-400 text-violet-600 dark:border-violet-600 dark:text-violet-400")}>
              {hasActiveFilters ? <><X className="w-3.5 h-3.5 mr-1.5" />Limpar</> : 'Limpar filtros'}
            </Button>
          </div>
        </div>

        {/* Results count */}
        {hasActiveFilters && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {filteredTransactions.length} resultado{filteredTransactions.length !== 1 ? 's' : ''} encontrado{filteredTransactions.length !== 1 ? 's' : ''}
            {search && <span className="font-medium text-violet-600 dark:text-violet-400"> para "{search}"</span>}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-200 dark:border-slate-800 hover:bg-transparent">
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
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((transaction) => {
                      const status = getTransactionStatus(transaction);
                      const daysOverdue = getDaysOverdue(transaction);
                      return (
                        <TableRow key={transaction.id}
                          className={cn("border-slate-100 dark:border-slate-800/60",
                            status === 'overdue' && "bg-rose-50/50 dark:bg-rose-950/10")}>
                          <TableCell className="text-sm text-slate-600 dark:text-slate-300">
                            <div>{formatDate(transaction.dueDate)}</div>
                            {daysOverdue > 0 && (
                              <div className="text-xs text-rose-600 dark:text-rose-400 font-medium">{daysOverdue}d atraso</div>
                            )}
                          </TableCell>
                          <TableCell className="font-medium text-sm text-slate-900 dark:text-slate-100">
                            <div className="flex items-center gap-1">
                              {search ? (
                                <span dangerouslySetInnerHTML={{
                                  __html: transaction.description.replace(
                                    new RegExp(`(${search})`, 'gi'),
                                    '<mark class="bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 rounded px-0.5">$1</mark>'
                                  )
                                }} />
                              ) : transaction.description}
                              {(transaction as any).recurringGroup && (
                                <span className="text-xs text-muted-foreground bg-muted px-1 rounded" title="Recorrente">↺</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="hidden sm:table-cell">
                            <Badge variant="outline" className="text-xs">{transaction.category}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <Badge className={cn("text-xs",
                              transaction.type === 'income'
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0"
                                : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 border-0")}>
                              {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn("text-right font-bold text-sm",
                            transaction.type === 'income' ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                            {transaction.type === 'income' ? '+' : '−'}{formatCurrency(transaction.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={getStatusBadgeVariant(status)} className="text-xs">
                              {getStatusLabel(status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-xs text-slate-400 hidden lg:table-cell">
                            {transaction.paidDate ? formatDateTime(transaction.paidDate) : '—'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setEditingTransaction(transaction)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setDeletingTransaction(transaction)}
                                className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-slate-400 dark:text-slate-500 py-12 text-sm">
                        {hasActiveFilters ? 'Nenhuma transação encontrada com esses filtros' : 'Nenhuma transação ainda'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 border border-emerald-200 dark:border-emerald-800/50 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">Total Receitas</p>
                <p className="text-xl font-bold text-emerald-800 dark:text-emerald-300">
                  {formatCurrency(filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0))}
                </p>
              </div>
              <div className="p-4 border border-rose-200 dark:border-rose-800/50 rounded-xl bg-rose-50 dark:bg-rose-950/30">
                <p className="text-xs text-rose-700 dark:text-rose-400 mb-1">Total Despesas</p>
                <p className="text-xl font-bold text-rose-800 dark:text-rose-300">
                  {formatCurrency(filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0))}
                </p>
              </div>
              <div className="p-4 border border-violet-200 dark:border-violet-800/50 rounded-xl bg-violet-50 dark:bg-violet-950/30">
                <p className="text-xs text-violet-700 dark:text-violet-400 mb-1">Saldo</p>
                <p className="text-xl font-bold text-violet-800 dark:text-violet-300">
                  {formatCurrency(
                    filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0) -
                    filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0)
                  )}
                </p>
              </div>
            </div>
          </>
        )}
      </main>

      {editingTransaction && (
        <NewTransactionDialog transaction={editingTransaction} onEdit={handleEditTransaction} trigger={<div />} />
      )}
      <DeleteConfirmationDialog
        open={!!deletingTransaction}
        onOpenChange={(open) => !open && setDeletingTransaction(null)}
        transaction={deletingTransaction}
        onConfirm={handleDeleteTransaction}
      />
    </div>
  );
};

export default Statement;
