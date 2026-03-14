import { Transaction } from '@/types/financial';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, AlertCircle, Pencil, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTransactionStatus, getDaysOverdue, getStatusLabel, getStatusBadgeVariant } from '@/lib/financialUtils';

interface TransactionItemProps {
  transaction: Transaction;
  onTogglePaid: (id: string) => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  // ✅ NEW: bulk selection props (optional so it stays backward compatible)
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

export const TransactionItem = ({
  transaction,
  onTogglePaid,
  onEdit,
  onDelete,
  isSelected = false,
  onToggleSelect,
}: TransactionItemProps) => {
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(transaction.amount);

  const formattedDate = new Date(transaction.dueDate).toLocaleDateString('pt-BR');
  const status = getTransactionStatus(transaction);
  const daysOverdue = getDaysOverdue(transaction);

  return (
    <div className={cn(
      "flex items-center justify-between p-4 rounded-lg border transition-all duration-200 hover:shadow-md",
      transaction.isPaid ? "bg-muted/50 border-muted" : "bg-card border-border",
      status === 'overdue' && "border-red-500/50 bg-red-50/50 dark:bg-red-950/10",
      // ✅ Highlight when selected
      isSelected && "ring-2 ring-primary border-primary bg-primary/5"
    )}>

      {/* ✅ Selection checkbox */}
      {onToggleSelect && (
        <div className="mr-3 flex-shrink-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(transaction.id)}
            className="w-4 h-4 cursor-pointer accent-primary"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={cn(
            "font-medium",
            transaction.isPaid && "text-muted-foreground line-through"
          )}>
            {transaction.description}
          </p>
          <Badge variant="outline" className="text-xs">
            {transaction.category}
          </Badge>
          <Badge variant={getStatusBadgeVariant(status)} className="text-xs">
            {getStatusLabel(status)}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Vencimento: {formattedDate}</span>
          {daysOverdue > 0 && (
            <span className="flex items-center gap-1 text-red-600 font-semibold">
              <AlertCircle className="w-3 h-3" />
              {daysOverdue} {daysOverdue === 1 ? 'dia' : 'dias'} de atraso
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <p className={cn(
          "text-lg font-bold",
          transaction.type === 'income' ? "text-income" : "text-expense"
        )}>
          {transaction.type === 'income' ? '+' : '-'}{formattedAmount}
        </p>

        <div className="flex items-center gap-2">
          {!transaction.isPaid && (
            <Button
              size="sm"
              onClick={() => onTogglePaid(transaction.id)}
              className="gap-2"
              variant={transaction.type === 'income' ? 'default' : 'outline'}
            >
              <Check className="w-4 h-4" />
              <span className="hidden sm:inline">
                {transaction.type === 'income' ? 'Recebido' : 'Pago'}
              </span>
            </Button>
          )}

          {transaction.isPaid && (
            <Badge variant="secondary" className="gap-1">
              <Check className="w-3 h-3" />
              {transaction.type === 'income' ? 'Recebido' : 'Pago'}
            </Badge>
          )}

          {onEdit && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(transaction)}
              className="gap-1"
              title="Editar transação"
            >
              <Pencil className="w-4 h-4" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
          )}

          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(transaction)}
              className="gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Excluir transação"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Excluir</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
