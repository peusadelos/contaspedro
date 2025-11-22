import { Card } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  title: string;
  amount: number;
  icon: LucideIcon;
  variant: 'income' | 'expense' | 'balance';
}

export const SummaryCard = ({ title, amount, icon: Icon, variant }: SummaryCardProps) => {
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Math.abs(amount));

  return (
    <Card className={cn(
      "p-6 transition-all duration-300 hover:shadow-lg",
      variant === 'income' && "bg-income-light border-income",
      variant === 'expense' && "bg-expense-light border-expense",
      variant === 'balance' && "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-primary"
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <p className={cn(
            "text-sm font-medium",
            variant === 'balance' ? "text-primary-foreground/80" : "text-muted-foreground"
          )}>
            {title}
          </p>
          <p className={cn(
            "text-3xl font-bold",
            variant === 'income' && "text-income",
            variant === 'expense' && "text-expense",
            variant === 'balance' && "text-primary-foreground"
          )}>
            {variant === 'expense' && amount > 0 ? '-' : ''}{formattedAmount}
          </p>
        </div>
        <div className={cn(
          "p-3 rounded-xl",
          variant === 'income' && "bg-income/10",
          variant === 'expense' && "bg-expense/10",
          variant === 'balance' && "bg-primary-foreground/10"
        )}>
          <Icon className={cn(
            "w-6 h-6",
            variant === 'income' && "text-income",
            variant === 'expense' && "text-expense",
            variant === 'balance' && "text-primary-foreground"
          )} />
        </div>
      </div>
    </Card>
  );
};
