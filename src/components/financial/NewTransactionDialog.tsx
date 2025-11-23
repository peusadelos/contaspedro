import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Transaction, TransactionType, Category } from '@/types/financial';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface NewTransactionDialogProps {
  transaction?: Transaction;
  onAdd?: (transaction: Omit<Transaction, 'id'>) => void;
  onEdit?: (transaction: Transaction) => void;
  trigger?: React.ReactNode;
}

const expenseCategories: Category[] = ['Contas', 'Gastos Pessoais', 'Compras', 'Pagamento de Dívidas'];
const incomeCategories: Category[] = ['Salário', 'Freela', 'Extra'];

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

  const categories = type === 'expense' ? expenseCategories : incomeCategories;

  useEffect(() => {
    if (transaction) {
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
    
    if (!description.trim()) {
      toast.error('Descrição é obrigatória');
      return;
    }

    const amountValue = parseFloat(amount);
    if (!amount || isNaN(amountValue) || amountValue <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }

    if (!category) {
      toast.error('Selecione uma categoria');
      return;
    }

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
      onAdd({
        description: description.trim(),
        amount: amountValue,
        date: dueDate,
        createdDate: today,
        dueDate,
        paidDate: isPaid ? today : undefined,
        category,
        type,
        isPaid,
      });
      toast.success('Transação adicionada com sucesso!');
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
    }
  };

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setCategory(newType === 'expense' ? 'Contas' : 'Salário');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Transação
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Transação' : 'Adicionar Transação'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={handleTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
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
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dueDate">Data de Vencimento</Label>
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
              rows={3}
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

          <Button type="submit" className="w-full">
            {isEditing ? 'Salvar Alterações' : 'Adicionar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
