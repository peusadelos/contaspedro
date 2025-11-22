import { useState } from 'react';
import { Transaction, TransactionType, Category } from '@/types/financial';
import { mockTransactions } from '@/data/mockTransactions';
import { NewTransactionDialog } from '@/components/financial/NewTransactionDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getTransactionStatus, getStatusLabel, getStatusBadgeVariant, getDaysOverdue } from '@/lib/financialUtils';

const Statement = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const handleAddTransaction = (newTransaction: Omit<Transaction, 'id'>) => {
    const transaction: Transaction = {
      ...newTransaction,
      id: String(transactions.length + 1),
    };
    setTransactions([transaction, ...transactions]);
  };

  const filteredTransactions = transactions
    .filter(t => {
      if (filterMonth && !t.dueDate.startsWith(filterMonth)) return false;
      if (filterCategory !== 'all' && t.category !== filterCategory) return false;
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (filterStatus !== 'all' && getTransactionStatus(t) !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

  const allCategories = Array.from(new Set(transactions.map(t => t.category)));

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">Extrato Mensal</h1>
          </div>
          <NewTransactionDialog onAdd={handleAddTransaction} />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Mês</label>
            <Input
              type="month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Categoria</label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {allCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receita</SelectItem>
                <SelectItem value="expense">Despesa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
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

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setFilterMonth('');
                setFilterCategory('all');
                setFilterType('all');
                setFilterStatus('all');
              }}
              className="w-full"
            >
              Limpar Filtros
            </Button>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vencimento</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="text-right">Quitação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions.length > 0 ? (
                filteredTransactions.map((transaction) => {
                  const status = getTransactionStatus(transaction);
                  const daysOverdue = getDaysOverdue(transaction);
                  
                  return (
                    <TableRow 
                      key={transaction.id}
                      className={cn(
                        status === 'overdue' && "bg-red-50/50 dark:bg-red-950/10"
                      )}
                    >
                      <TableCell>
                        <div className="space-y-1">
                          <div>{formatDate(transaction.dueDate)}</div>
                          {daysOverdue > 0 && (
                            <div className="text-xs text-red-600 font-semibold">
                              {daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'} de atraso
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{transaction.description}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{transaction.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={transaction.type === 'income' ? 'default' : 'secondary'}
                          className={cn(
                            transaction.type === 'income' && "bg-income text-income-foreground",
                            transaction.type === 'expense' && "bg-expense text-expense-foreground"
                          )}
                        >
                          {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn(
                        "text-right font-bold",
                        transaction.type === 'income' ? "text-income" : "text-expense"
                      )}>
                        {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={getStatusBadgeVariant(status)}>
                          {getStatusLabel(status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {transaction.paidDate ? formatDateTime(transaction.paidDate) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhuma transação encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 border rounded-lg bg-income-light border-income">
            <p className="text-sm text-muted-foreground mb-1">Total Receitas</p>
            <p className="text-2xl font-bold text-income">
              {formatCurrency(
                filteredTransactions
                  .filter(t => t.type === 'income')
                  .reduce((sum, t) => sum + t.amount, 0)
              )}
            </p>
          </div>
          <div className="p-4 border rounded-lg bg-expense-light border-expense">
            <p className="text-sm text-muted-foreground mb-1">Total Despesas</p>
            <p className="text-2xl font-bold text-expense">
              {formatCurrency(
                filteredTransactions
                  .filter(t => t.type === 'expense')
                  .reduce((sum, t) => sum + t.amount, 0)
              )}
            </p>
          </div>
          <div className="p-4 border rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <p className="text-sm text-primary-foreground/80 mb-1">Saldo</p>
            <p className="text-2xl font-bold">
              {formatCurrency(
                filteredTransactions
                  .filter(t => t.type === 'income')
                  .reduce((sum, t) => sum + t.amount, 0) -
                filteredTransactions
                  .filter(t => t.type === 'expense')
                  .reduce((sum, t) => sum + t.amount, 0)
              )}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Statement;
