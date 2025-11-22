import { useState } from 'react';
import { Transaction, CategorySummary } from '@/types/financial';
import { mockTransactions } from '@/data/mockTransactions';
import { SummaryCard } from '@/components/financial/SummaryCard';
import { TransactionItem } from '@/components/financial/TransactionItem';
import { CategoryChart } from '@/components/financial/CategoryChart';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Dashboard = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);

  const handleTogglePaid = (id: string) => {
    setTransactions(prev =>
      prev.map(t =>
        t.id === id ? { ...t, isPaid: !t.isPaid } : t
      )
    );
    toast.success('Transação atualizada!');
  };

  const totalToReceive = transactions
    .filter(t => t.type === 'income' && !t.isPaid)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalToPay = transactions
    .filter(t => t.type === 'expense' && !t.isPaid)
    .reduce((sum, t) => sum + t.amount, 0);

  const netBalance = totalToReceive - totalToPay;

  const pendingTransactions = transactions
    .filter(t => !t.isPaid)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

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
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">Controle Financeiro</h1>
          <a href="/extrato">
            <Button variant="outline">Ver Extrato Completo</Button>
          </a>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </div>

        {/* Pending Transactions and Chart */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pending Transactions */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Transações Pendentes</h2>
            <div className="space-y-3">
              {pendingTransactions.length > 0 ? (
                pendingTransactions.map(transaction => (
                  <TransactionItem
                    key={transaction.id}
                    transaction={transaction}
                    onTogglePaid={handleTogglePaid}
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
    </div>
  );
};

export default Dashboard;
