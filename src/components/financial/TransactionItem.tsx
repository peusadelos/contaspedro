import { Transaction } from '@/types/financial';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TransactionItemProps {
  transaction: Transaction;
  onTogglePaid: (id: string) => void;
}

export const TransactionItem = ({ transaction, onTogglePaid }: TransactionItemProps) => {
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(transaction.amount);

  const formattedDate = new Date(transaction.date).toLocaleDateString('pt-BR');

  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-lg border transition-all duration-200 hover:shadow-md",
      transaction.isPaid ? "bg-muted/50 border-muted" : "bg-card border-border"
    )}>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <p className={cn(
            "font-medium",
            transaction.isPaid && "text-muted-foreground line-through"
          )}>
            {transaction.description}
          </p>
          <Badge variant="outline" className="text-xs">
            {transaction.category}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{formattedDate}</p>
      </div>
      
      <div className="flex items-center gap-4">
        <p className={cn(
          "text-lg font-bold",
          transaction.type === 'income' ? "text-income" : "text-expense"
        )}>
          {transaction.type === 'income' ? '+' : '-'}{formattedAmount}
        </p>
        
        {!transaction.isPaid && (
          <Button
            size="sm"
            onClick={() => onTogglePaid(transaction.id)}
            className="gap-2"
            variant={transaction.type === 'income' ? 'default' : 'outline'}
          >
            <Check className="w-4 h-4" />
            Marcar como {transaction.type === 'income' ? 'Recebido' : 'Pago'}
          </Button>
        )}
        
        {transaction.isPaid && (
          <Badge variant="secondary" className="gap-1">
            <Check className="w-3 h-3" />
            {transaction.type === 'income' ? 'Recebido' : 'Pago'}
          </Badge>
        )}
      </div>
    </div>
  );
};
