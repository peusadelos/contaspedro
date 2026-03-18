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
import { ArrowLeft, Pencil, Trash2, LogOut } from 'lucide-react';
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

interface StatementProps {
  session: Session;
}

const Statement = ({ session }: StatementProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [deletingTransaction, setDeletingTransaction] = useState<Transaction | null>(null);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
  const formatCurrency = (amount: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR');
  const formatDateTime = (date: string) => new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

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
            <h1 className="text-2xl font-bold text-foreground">Extrato</h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">{session.user.email}</span>
            <NewTransactionDialog onAdd={handleAddTransaction} />
            <Button variant="ghost" size="icon" onClick={handleLogout} title="Sair">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Mês</label>
            <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Categoria</label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {allCategories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo</label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
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
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
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
            <Button variant="outline" onClick={() => { setFilterMonth(''); setFilterCategory('all'); setFilterType('all'); setFilterStatus('all'); }} className="w-full">
              Limpar Filtros
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20 text-muted-foreground">Carregando transações...</div>
        ) : (
          <>
            {/* Table */}
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
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.length > 0 ? (
                    filteredTransactions.map((transaction) => {
                      const status = getTransactionStatus(transaction);
                      const daysOverdue = getDaysOverdue(transaction);
                      return (
                        <TableRow key={transaction.id} className={cn(status === 'overdue' && "bg-red-50/50 dark:bg-red-950/10")}>
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
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-1">
                              {transaction.description}
                              {(transaction as any).recurringGroup && (
                                <span className="text-xs text-muted-foreground bg-muted px-1 rounded" title="Recorrente">↺</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{transaction.category}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={transaction.type === 'income' ? 'default' : 'secondary'}
                              className={cn(
                                transaction.type === 'income' && "bg-income text-income-foreground",
                                transaction.type === 'expense' && "bg-expense text-expense-foreground"
                              )}>
                              {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                            </Badge>
                          </TableCell>
                          <TableCell className={cn("text-right font-bold", transaction.type === 'income' ? "text-income" : "text-expense")}>
                            {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant={getStatusBadgeVariant(status)}>{getStatusLabel(status)}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {transaction.paidDate ? formatDateTime(transaction.paidDate) : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setEditingTransaction(transaction)} className="h-8 w-8 p-0">
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setDeletingTransaction(transaction)} className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                  {formatCurrency(filteredTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0))}
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-expense-light border-expense">
                <p className="text-sm text-muted-foreground mb-1">Total Despesas</p>
                <p className="text-2xl font-bold text-expense">
                  {formatCurrency(filteredTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0))}
                </p>
              </div>
              <div className="p-4 border rounded-lg bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                <p className="text-sm text-primary-foreground/80 mb-1">Saldo</p>
                <p className="text-2xl font-bold">
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
