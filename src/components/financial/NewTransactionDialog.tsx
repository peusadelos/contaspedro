import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Transaction, TransactionType, Category } from '@/types/financial';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

interface NewTransactionDialogProps {
  onAdd: (transaction: Omit<Transaction, 'id'>) => void;
}

const expenseCategories: Category[] = ['Contas', 'Gastos Pessoais', 'Compras', 'Pagamento de Dívidas'];
const incomeCategories: Category[] = ['Salário', 'Freela', 'Extra'];

export const NewTransactionDialog = ({ onAdd }: NewTransactionDialogProps) => {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<Category>('Contas');
  const [isPaid, setIsPaid] = useState(false);

  const categories = type === 'expense' ? expenseCategories : incomeCategories;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!description || !amount || !category) {
      toast.error('Preencha todos os campos');
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    onAdd({
      description,
      amount: parseFloat(amount),
      date: dueDate,
      createdDate: today,
      dueDate,
      paidDate: isPaid ? today : undefined,
      category,
      type,
      isPaid,
    });

    toast.success('Transação adicionada com sucesso!');
    setOpen(false);
    setDescription('');
    setAmount('');
    setDueDate(new Date().toISOString().split('T')[0]);
    setIsPaid(false);
  };

  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setCategory(newType === 'expense' ? 'Contas' : 'Salário');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Transação
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Transação</DialogTitle>
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
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ex: Supermercado"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Valor</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
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
            Adicionar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
