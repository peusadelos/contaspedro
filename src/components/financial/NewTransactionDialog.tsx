import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Transaction, TransactionType, Category } from '@/types/financial';
import { Plus, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface NewTransactionDialogProps {
  transaction?: Transaction;
  onAdd?: (transactions: Omit<Transaction, 'id'>[]) => void;
  onEdit?: (transaction: Transaction) => void;
  trigger?: React.ReactNode;
}

const expenseCategories: Category[] = ['Contas', 'Gastos Pessoais', 'Compras', 'Pagamento de Dívidas'];
const incomeCategories: Category[] = ['Salário', 'Freela', 'Extra'];

const addMonths = (dateStr: string, months: number): string => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1 + months, day);
  if (date.getDate() !== day) date.setDate(0);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const NewTransactionDialog = ({ transaction, onAdd, onEdit, trigger }: NewTransactionDialogProps) => {
  const isEditing = !!transaction;
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>(transaction?.type || 'expense');
  const [description, setDescription] = useState(transaction?.description || '');
  const [amount, setAmount] = useState(transaction?.amount.toString() || '');
  const [dueDate, setDueDate] = useState(transaction?.dueDate || new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<Category>(transaction?.category || 'Contas');
  const [isPaid, setIsPaid] = useState(transaction?.isPaid || false);
  const [notes, setNotes] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringMonths, setRecurringMonths] = useState('12');

  const categories = type === 'expense' ? expenseCategories : incomeCategories;

  useEffect(() => {
    if (transaction) {
      setOpen(true);
      setType(transaction.type);
      setDescription(transaction.description);
      setAmount(transaction.amount.toString());
      setDueDate(transaction.dueDate);
      setCategory(transaction.category);
      setIsPaid(transaction.isPaid);
    }
  }, [transaction]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) { toast.error('Descrição é obrigatória'); return; }
    const amountValue = parseFloat(amount);
    if (!amount || isNaN(amountValue) || amountValue <= 0) { toast.error('Valor deve ser maior que zero'); return; }
    if (!category) { toast.error('Selecione uma categoria'); return; }

    const today = new Date().toISOString().split('T')[0];

    if (isEditing && onEdit && transaction) {
      onEdit({
        ...transaction,
        description: description.trim(),
        amount: amountValue,
        dueDate,
        category,
        type,
        isPaid,
        paidDate: isPaid && !transaction.isPaid ? today : transaction.paidDate,
      });
      toast.success('Transação atualizada com sucesso!');
    } else if (onAdd) {
      if (isRecurring) {
        const months = Math.max(1, Math.min(60, parseInt(recurringMonths) || 12));
        const recurringGroup = `recurring_${Date.now()}`;
        const generated: Omit<Transaction, 'id'>[] = Array.from({ length: months }, (_, i) => {
          const monthDueDate = addMonths(dueDate, i);
          return {
            description: description.trim(),
            amount: amountValue,
            date: monthDueDate,
            createdDate: today,
            dueDate: monthDueDate,
            paidDate: isPaid && i === 0 ? today : undefined,
            category,
            type,
            isPaid: isPaid && i === 0,
            recurringGroup,
          };
        });
        onAdd(generated);
        toast.success(`${months} transações recorrentes criadas!`);
      } else {
        onAdd([{
          description: description.trim(),
          amount: amountValue,
          date: dueDate,
          createdDate: today,
          dueDate,
          paidDate: isPaid ? today : undefined,
          category,
          type,
          isPaid,
        }]);
        toast.success('Transação adicionada com sucesso!');
      }
    }

    setOpen(false);
    resetForm();
  };

  const resetForm = () => {
    if (!isEditing) {
      setDescription('');
      setAmount('');
      setDueDate(new Date().toISOString().split('T')[0]);
      setIsPaid(false);
      setNotes('');
      setIsRecurring(false);
      setRecurringMonths('12');
    }
  };

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setCategory(newType === 'expense' ? 'Contas' : 'Salário');
  };

  // ✅ FIX: We no longer use DialogTrigger at all.
  // Instead, we render the trigger ourselves with an onClick that sets open=true.
  // This is 100% reliable and avoids all asChild/forwardRef issues.
  const triggerElement = trigger ? (
    <span onClick={() => setOpen(true)} style={{ display: 'contents' }}>
      {trigger}
    </span>
  ) : (
    <Button onClick={() => setOpen(true)} className="gap-2">
      <Plus className="w-4 h-4" />
      Nova Transação
    </Button>
  );

  return (
    <>
      {triggerElement}

      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setOpen(false)}
          />
        )}
        <DialogContent className="sm:max-w-[425px] z-50 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Transação' : 'Adicionar Transação'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => handleTypeChange(v as TransactionType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  <SelectItem value="expense">Despesa</SelectItem>
                  <SelectItem value="income">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição *</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Supermercado"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={category} onValueChange={(val) => setCategory(val as Category)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent className="z-[200]">
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">
                {isRecurring ? 'Data de Vencimento (1º mês)' : 'Data de Vencimento'}
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="isPaid"
                checked={isPaid}
                onCheckedChange={(checked) => setIsPaid(checked as boolean)}
              />
              <Label htmlFor="isPaid" className="text-sm font-normal cursor-pointer">
                Marcar como {type === 'income' ? 'Recebido' : 'Pago'}
              </Label>
            </div>

            {!isEditing && (
              <div className="rounded-lg border p-3 space-y-3 bg-muted/30">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isRecurring"
                    checked={isRecurring}
                    onCheckedChange={(checked) => setIsRecurring(checked as boolean)}
                  />
                  <Label htmlFor="isRecurring" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                    <RefreshCw className="w-3 h-3" />
                    Repetir mensalmente
                  </Label>
                </div>

                {isRecurring && (
                  <div className="space-y-2 pl-6">
                    <Label htmlFor="recurringMonths" className="text-sm">Quantos meses?</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="recurringMonths"
                        type="number"
                        min="2"
                        max="60"
                        value={recurringMonths}
                        onChange={(e) => setRecurringMonths(e.target.value)}
                        className="w-24"
                      />
                      <span className="text-sm text-muted-foreground">
                        meses → até{' '}
                        {(() => {
                          const months = parseInt(recurringMonths) || 0;
                          if (months < 2) return '...';
                          const end = addMonths(dueDate, months - 1);
                          const [y, m] = end.split('-');
                          return new Date(Number(y), Number(m) - 1, 1)
                            .toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
                        })()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Serão criadas {recurringMonths} transações independentes, uma por mês no mesmo dia.
                    </p>
                  </div>
                )}
              </div>
            )}

            <Button type="submit" className="w-full">
              {isEditing
                ? 'Salvar Alterações'
                : isRecurring
                ? `Criar ${recurringMonths} transações`
                : 'Adicionar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};
