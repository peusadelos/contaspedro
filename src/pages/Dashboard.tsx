import { useState, useEffect } from 'react';
import { Transaction, CategorySummary } from '@/types/financial';
import { mockTransactions } from '@/data/mockTransactions';
import { SummaryCard } from '@/components/financial/SummaryCard';
import { TransactionItem } from '@/components/financial/TransactionItem';
import { CategoryChart } from '@/components/financial/CategoryChart';
import { NewTransactionDialog } from '@/components/financial/NewTransactionDialog';
import { DeleteConfirmationDialog } from '@/components/financial/DeleteConfirmationDialog';
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

const Dashboard = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('contaspedro_transactions');
      return saved ? JSON.parse(saved) : mockTransactions;
    } catch {
      return mockTransactions;
    }
  });

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(toMonthKey(new Date()));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  useEffect(() => {
    localStorage.setItem('contaspedro_transactions', JSON.stringify(transactions));
  }, [transactions]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [selectedMonth, statusFilter]);

  // ✅ onAdd now receives an array (supports both single and recurring)
  const handleAddTransaction = (newTransactions: Omit<Transaction, 'id'>[]) => {
    const withIds: Transaction[] = newTransactions.map((t, i) => ({
      ...t,
      id: `txn_${Date.now()}_${i}`,
    }));
    setTransactions(prev => [...withIds, ...prev]);
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === transaction.id ? transaction : t));
    setEditingTransaction(undefined);
  };

  const handleDeleteTransaction = () => {
    if (deletingTransaction) {
      setTransactions(prev => prev.filter(t => t.id !== deletingTransaction.id));
      toast.success('Transação excluída com sucesso!');
      setDeletingTransaction(null);
    }
  };

  const handleTogglePaid = (id: string) => {
    setTransactions(prev =>
      prev.map(t =>
        t.id === id ? {
          ...t,
          isPaid: !t.isPaid,
          paidDate: !t.isPaid ? new Date().toISOString().split('T')[0] : undefined
        } : t
      )
    );
    toast.success('Status atualizado!');
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

  const handleBulkDelete = () => {
    setTransactions(prev => prev.filter(t => !selectedIds.has(t.id)));
    toast.success(`${selectedIds.size} transação(ões) excluída(s)!`);
    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
  };

  const handleClearDemoData = () => {
    setTransactions([]);
    setSelectedIds(new Set());
    toast.success('Dados de demonstração removidos!');
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const date = new Date(year, month - 1 + (direction === 'next' ? 1 : -1), 1);
    setSelectedMonth(toMonthKey(date));
  };

  const transactionsInMonth = transactions.filter(t =>
    t.dueDate.startsWith(selectedMonth)
  );

  const totalToReceive = transactionsInMonth
    .filter(t => t.type === 'income' && !t.isPaid)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalToPay = transactionsInMonth
    .filter(t => t.type === 'expense' && !t.isPaid)
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalToReceive - totalToPay;

  const overdueTransactions = transactionsInMonth.filter(t => getTransactionStatus(t) === 'overdue');
  const overdueAmount = overdueTransactions.reduce((sum, t) => sum + t.amount, 0);

  const pendingTransactions = transactionsInMonth
    .filter(t => {
      if (t.isPaid) return false;
      if (statusFilter === 'all') return true;
      return getTransactionStatus(t) === statusFilter;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const expensesByCategory: CategorySummary[] = transactionsInMonth
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      const existing = acc.find(item => item.category === t.category);
      if (existing) {
        existing.total += t.amount;
      } else {
        acc.push({ category: t.category, total: t.amount, color: '' });
      }
      return acc;
    }, [] as CategorySummary[]);

  const allSelected = pendingTransactions.length > 0 && selectedIds.size === pendingTransactions.length;
  const someSelected = selectedIds.size > 0;
  const hasDemoData = transactions.some(t => t.id === '1');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Controle Financeiro</h1>
          <div className="flex items-center gap-2">
            {hasDemoData && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearDemoData}
                className="text-muted-foreground border-dashed"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Limpar Demo
              </Button>
            )}
            <NewTransactionDialog onAdd={handleAddTransaction} />
            <a href="/extrato">
              <Button variant="outline">Ver Extrato Completo</Button>
            </a>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">

        {/* Month Navigator */}
        <div className="flex items-center justify-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth('prev')}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-semibold capitalize w-48 text-center">
            {formatMonthLabel(selectedMonth)}
          </h2>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth('next')}>
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <SummaryCard title="Total a Receber" amount={totalToReceive} icon={TrendingUp} variant="income" />
          <SummaryCard title="Total a Pagar" amount={totalToPay} icon={TrendingDown} variant="expense" />
          <SummaryCard title="Saldo Líquido" amount={netBalance} icon={Wallet} variant="balance" />
          {overdueTransactions.length > 0 && (
            <div className="p-6 rounded-lg bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg border-2 border-red-400">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-red-50">Atrasados</p>
                <AlertTriangle className="w-5 h-5 text-red-100" />
              </div>
              <p className="text-3xl font-bold mb-1">{overdueTransactions.length}</p>
              <p className="text-sm text-red-100">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(overdueAmount)}
              </p>
            </div>
          )}
        </div>

        {/* Pending Transactions and Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Transações Pendentes</h2>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar status" />
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
              <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 cursor-pointer accent-primary"
                  />
                  <span className="text-sm text-muted-foreground">
                    {someSelected ? `${selectedIds.size} selecionada(s)` : 'Selecionar todas'}
                  </span>
                </div>
                {someSelected && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setShowBulkDeleteConfirm(true)}
                    className="gap-1"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir {selectedIds.size}
                  </Button>
                )}
              </div>
            )}

            <div className="space-y-3">
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
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma transação pendente em {formatMonthLabel(selectedMonth)}
                </p>
              )}
            </div>
          </div>

          <CategoryChart data={expensesByCategory} />
        </div>
      </main>

      {editingTransaction && (
        <NewTransactionDialog
          transaction={editingTransaction}
          onEdit={handleEditTransaction}
          trigger={<div />}
        />
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
