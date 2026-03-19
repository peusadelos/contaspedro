import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { Transaction, CategorySummary } from '@/types/financial';
import { supabase, SupabaseTransaction } from '@/lib/supabase';
import { SummaryCard } from '@/components/financial/SummaryCard';
import { TransactionItem } from '@/components/financial/TransactionItem';
import { CategoryChart } from '@/components/financial/CategoryChart';
import { NewTransactionDialog } from '@/components/financial/NewTransactionDialog';
import { DeleteConfirmationDialog } from '@/components/financial/DeleteConfirmationDialog';
import {
  TrendingUp, TrendingDown, Wallet, AlertTriangle,
  Trash2, ChevronLeft, ChevronRight, LogOut, Plus,
  LayoutDashboard, Moon, Sun
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { getTransactionStatus } from '@/lib/financialUtils';

const toMonthKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const formatMonthLabel = (monthKey: string) => {
  const [year, month] = monthKey.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

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

interface DashboardProps {
  session: Session;
}

const Dashboard = ({ session }: DashboardProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(toMonthKey(new Date()));
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

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedMonth, statusFilter]);

  const handleAddTransaction = async (newTransactions: Omit<Transaction, 'id'>[]) => {
    const rows = newTransactions.map(t => toSupabase(t, session.user.id));
    const { data, error } = await supabase.from('transactions').insert(rows).select();
    if (error) {
      toast.error('Erro ao adicionar transação');
    } else {
      const added = (data as SupabaseTransaction[]).map(fromSupabase);
      setTransactions(prev => [...added, ...prev]);
      toast.success(added.length > 1 ? `${added.length} transações criadas!` : 'Transação adicionada!');
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

  const handleTogglePaid = async (id: string) => {
    const t = transactions.find(t => t.id === id);
    if (!t) return;
    const updated = { ...t, isPaid: !t.isPaid, paidDate: !t.isPaid ? new Date().toISOString().split('T')[0] : undefined };
    const { error } = await supabase
      .from('transactions')
      .update({ is_paid: updated.isPaid, paid_date: updated.paidDate ?? null })
      .eq('id', id);
    if (error) {
      toast.error('Erro ao atualizar status');
    } else {
      setTransactions(prev => prev.map(t => t.id === id ? updated : t));
      toast.success('Status atualizado!');
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === pendingTransactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingTransactions.map(t => t.id)));
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from('transactions').delete().in('id', ids);
    if (error) {
      toast.error('Erro ao excluir transações');
    } else {
      setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));
      toast.success(`${ids.length} transação(ões) excluída(s)!`);
      setSelectedIds(new Set());
      setShowBulkDeleteConfirm(false);
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + (direction === 'next' ? 1 : -1), 1);
    setSelectedMonth(toMonthKey(date));
  };

  const transactionsInMonth = transactions.filter(t => t.dueDate.startsWith(selectedMonth));

  // ✅ FIX: Summary cards count ALL transactions (paid + unpaid) for the month
  // This matches the Extrato page which also shows totals regardless of payment status
  const totalIncome = transactionsInMonth
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactionsInMonth
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalIncome - totalExpense;

  // Counts for subtitles
  const incomeCount = transactionsInMonth.filter(t => t.type === 'income').length;
  const expenseCount = transactionsInMonth.filter(t => t.type === 'expense').length;

  // Overdue still based on unpaid only
  const overdueTransactions = transactionsInMonth.filter(t => getTransactionStatus(t) === 'overdue');
  const overdueAmount = overdueTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Pending list — only unpaid
  const pendingTransactions = transactionsInMonth
    .filter(t => {
      if (t.isPaid) return false;
      if (statusFilter === 'all') return true;
      return getTransactionStatus(t) === statusFilter;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  // Chart uses all expenses for the month
  const expensesByCategory: CategorySummary[] = transactionsInMonth
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const existing = acc.find(item => item.category === t.category);
      if (existing) { existing.total += t.amount; }
      else { acc.push({ category: t.category, total: t.amount, color: '' }); }
      return acc;
    }, [] as CategorySummary[]);

  const allSelected = pendingTransactions.length > 0 && selectedIds.size === pendingTransactions.length;
  const someSelected = selectedIds.size > 0;

  const addTrigger = (
    <Button size="sm" className="h-8 bg-violet-600 hover:bg-violet-700 rounded-lg text-xs gap-1.5 px-2.5 sm:px-3">
      <Plus className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="hidden sm:inline">Nova Transação</span>
    </Button>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
              <LayoutDashboard className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight hidden sm:block">
              WeekLeaks
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:block truncate max-w-[160px]">
              {session.user.email}
            </span>
            <NewTransactionDialog onAdd={handleAddTransaction} trigger={addTrigger} />
            <Link to="/extrato">
              <Link to="/cartoes">
  <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg px-2.5 hidden sm:flex">
    Cartões
  </Button>
</Link>
              <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg px-2.5">Extrato</Button>
            </Link>
            <Link to="/historico">
              <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg px-2.5 hidden sm:flex">Histórico</Button>
            </Link>
            <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)}
              className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              title={darkMode ? 'Modo claro' : 'Modo escuro'}>
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}
              className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" title="Sair">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-5 space-y-5">

        {/* Month Navigator */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => navigateMonth('prev')}
              className="h-8 w-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 w-36 sm:w-44 text-center capitalize">
              {formatMonthLabel(selectedMonth)}
            </h1>
            <Button variant="ghost" size="icon" onClick={() => navigateMonth('next')}
              className="h-8 w-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {overdueTransactions.length > 0 && (
            <div className="flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 text-rose-700 dark:text-rose-400 rounded-xl px-2.5 py-1.5 flex-shrink-0">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              <span className="text-xs font-medium whitespace-nowrap">
                {overdueTransactions.length} atrasado{overdueTransactions.length > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* ✅ Summary Cards — now show ALL transactions for the month */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <SummaryCard
            title="Receitas"
            amount={totalIncome}
            icon={TrendingUp}
            variant="income"
            subtitle={`${incomeCount} receita${incomeCount !== 1 ? 's' : ''} no mês`}
          />
          <SummaryCard
            title="Despesas"
            amount={totalExpense}
            icon={TrendingDown}
            variant="expense"
            subtitle={`${expenseCount} despesa${expenseCount !== 1 ? 's' : ''} no mês`}
          />
          <SummaryCard
            title="Saldo líquido"
            amount={netBalance}
            icon={Wallet}
            variant="balance"
            subtitle="Receitas − despesas do mês"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
              <p className="text-sm text-slate-500">Carregando transações...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

            {/* Pending Transactions */}
            <div className="lg:col-span-3 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Pendentes
                </h2>
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

              {pendingTransactions.length > 0 && (
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
                      <Trash2 className="w-3 h-3" />
                      Excluir {selectedIds.size}
                    </Button>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {pendingTransactions.length > 0 ? (
                  pendingTransactions.map(transaction => (
                    <TransactionItem
                      key={transaction.id}
                      transaction={transaction}
                      onTogglePaid={handleTogglePaid}
                      onEdit={setEditingTransaction}
                      onDelete={setDeletingTransaction}
                      isSelected={selectedIds.has(transaction.id)}
                      onToggleSelect={handleToggleSelect}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                      <Plus className="w-5 h-5 text-slate-400" />
                    </div>
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Nenhuma transação pendente</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 capitalize">
                      {formatMonthLabel(selectedMonth)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Chart */}
            <div className="lg:col-span-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                Resumo
              </h2>
              <CategoryChart data={expensesByCategory} />
            </div>
          </div>
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

      <DeleteConfirmationDialog
        open={showBulkDeleteConfirm}
        onOpenChange={(open) => !open && setShowBulkDeleteConfirm(false)}
        transaction={null}
        customMessage={`Tem certeza que deseja excluir ${selectedIds.size} transação(ões)? Esta ação não pode ser desfeita.`}
        onConfirm={handleBulkDelete}
      />
    </div>
  );
};

export default Dashboard;
