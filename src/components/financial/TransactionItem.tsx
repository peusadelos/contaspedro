import { Transaction } from '@/types/financial';
import { Button } from '@/components/ui/button';
import { Check, AlertCircle, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTransactionStatus, getDaysOverdue, getStatusLabel } from '@/lib/financialUtils';

interface TransactionItemProps {
  transaction: Transaction;
  onTogglePaid: (id: string) => void;
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (transaction: Transaction) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
}

const categoryEmoji: Record<string, string> = {
  'Contas': '🏠',
  'Gastos Pessoais': '🛒',
  'Compras': '🛍️',
  'Pagamento de Dívidas': '💳',
  'Salário': '💼',
  'Freela': '💻',
  'Extra': '⭐',
};

const statusConfig = {
  overdue: { badge: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50' },
  pending: { badge: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50' },
  future: { badge: 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50' },
  paid:   { badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' },
};

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

  const formattedDate = new Date(transaction.dueDate + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short',
  });

  const status = getTransactionStatus(transaction);
  const daysOverdue = getDaysOverdue(transaction);
  const emoji = categoryEmoji[transaction.category] || '📌';
  const sc = statusConfig[status] || statusConfig.pending;

  return (
    <div className={cn(
      'flex items-start gap-2.5 p-3 rounded-xl border transition-all duration-150',
      'bg-card hover:bg-accent/30',
      isSelected
        ? 'border-violet-400 dark:border-violet-600 ring-1 ring-violet-400/50 bg-violet-50/50 dark:bg-violet-950/20'
        : 'border-border hover:border-border/80 hover:shadow-sm',
      status === 'overdue' && !isSelected && 'border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/10',
    )}>

      {/* Checkbox */}
      {onToggleSelect && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect(transaction.id)}
          onClick={(e) => e.stopPropagation()}
          className="mt-1 w-4 h-4 flex-shrink-0 accent-violet-600 cursor-pointer"
        />
      )}

      {/* Emoji icon */}
      <div className={cn(
        'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base mt-0.5',
        transaction.type === 'income'
          ? 'bg-emerald-100 dark:bg-emerald-900/40'
          : 'bg-slate-100 dark:bg-slate-800/60'
      )}>
        {emoji}
      </div>

      {/* Main content — takes all remaining space */}
      <div className="flex-1 min-w-0">
        {/* Row 1: description + amount */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {transaction.description}
            </p>
            {(transaction as any).recurringGroup && (
              <RefreshCw className="w-3 h-3 text-muted-foreground/50 flex-shrink-0" />
            )}
          </div>
          <p className={cn(
            'text-sm font-bold flex-shrink-0',
            transaction.type === 'income'
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          )}>
            {transaction.type === 'income' ? '+' : '−'}{formattedAmount}
          </p>
        </div>

        {/* Row 2: category · date · overdue + badge + actions */}
        <div className="flex items-center justify-between gap-2 mt-1 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="text-xs text-muted-foreground">{transaction.category}</span>
            <span className="text-xs text-muted-foreground/40">·</span>
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
            {daysOverdue > 0 && (
              <>
                <span className="text-xs text-muted-foreground/40">·</span>
                <span className="flex items-center gap-0.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                  <AlertCircle className="w-3 h-3" />
                  {daysOverdue}d
                </span>
              </>
            )}
          </div>

          {/* Right side: badge + action buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', sc.badge)}>
              {getStatusLabel(status)}
            </span>

            {/* Action buttons */}
            {!transaction.isPaid && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onTogglePaid(transaction.id)}
                className="h-6 w-6 p-0 rounded-lg text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                title={transaction.type === 'income' ? 'Marcar recebido' : 'Marcar pago'}
              >
                <Check className="w-3.5 h-3.5" />
              </Button>
            )}
            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(transaction)}
                className="h-6 w-6 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                title="Editar"
              >
                <Pencil className="w-3 h-3" />
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(transaction)}
                className="h-6 w-6 p-0 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                title="Excluir"
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
