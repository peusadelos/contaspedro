import { useState } from 'react';
import { Transaction, CategorySummary, TransactionStatus } from '@/types/financial';
import { mockTransactions } from '@/data/mockTransactions';
import { SummaryCard } from '@/components/financial/SummaryCard';
import { TransactionItem } from '@/components/financial/TransactionItem';
import { CategoryChart } from '@/components/financial/CategoryChart';
import { NewTransactionDialog } from '@/components/financial/NewTransactionDialog';
import { DeleteConfirmationDialog } from '@/components/financial/DeleteConfirmationDialog';
import { TrendingUp, TrendingDown, Wallet, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getTransactionStatus } from '@/lib/financialUtils';

const Dashboard = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);

  const handleAddTransaction = (transaction: Omit<Transaction, 'id'>) => {
    const newTransaction: Transaction = {
      ...transaction,
      id: `txn_${Date.now()}`,
    };
    setTransactions(prev => [newTransaction, ...prev]);
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

  const totalToReceive = transactions
    .filter(t => t.type === 'income' && !t.isPaid)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalToPay = transactions
    .filter(t => t.type === 'expense' && !t.isPaid)
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalToReceive - totalToPay;

  const overdueTransactions = transactions.filter(t => getTransactionStatus(t) === 'overdue');
  const overdueAmount = overdueTransactions.reduce((sum, t) => sum + t.amount, 0);

  const pendingTransactions = transactions
    .filter(t => {
      if (t.isPaid) return false;
      if (statusFilter === 'all') return true;
      return getTransactionStatus(t) === statusFilter;
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const expensesByCategory: CategorySummary[] = transactions
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-foreground">Controle Financeiro</h1>
          <div className="flex items-center gap-2">
            <NewTransactionDialog onAdd={handleAddTransaction} />
            <a href="/extrato">
              <Button variant="outline">Ver Extrato Completo</Button>
            </a>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <SummaryCard
            title="Total a Receber"
            amount={totalToReceive}
            icon={TrendingUp}
            variant="income"
          />
          <SummaryCard
            title="Total a Pagar"
            amount={totalToPay}
            icon={TrendingDown}
            variant="expense"
          />
          <SummaryCard
            title="Saldo Líquido"
            amount={netBalance}
            icon={Wallet}
            variant="balance"
          />
          {overdueTransactions.length > 0 && (
            <div className="p-6 rounded-lg bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg border-2 border-red-400">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-red-50">Atrasados</p>
                <AlertTriangle className="w-5 h-5 text-red-100" />
              </div>
              <p className="text-3xl font-bold mb-1">
                {overdueTransactions.length}
              </p>
              <p className="text-sm text-red-100">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                }).format(overdueAmount)}
              </p>
            </div>
          )}
        </div>

        {/* Pending Transactions and Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Transactions */}
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
            <div className="space-y-3">
              {pendingTransactions.length > 0 ? (
                pendingTransactions.map(transaction => (
                  <TransactionItem
                    key={transaction.id}
                    transaction={transaction}
                    onTogglePaid={handleTogglePaid}
                    onEdit={setEditingTransaction}
                    onDelete={setDeletingTransaction}
                  />
                ))
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma transação pendente
                </p>
              )}
            </div>
          </div>

          {/* Category Chart */}
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
    </div>
  );
};

export default Dashboard;
