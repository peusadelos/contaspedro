import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SummaryCardProps {
  title: string;
  amount: number;
  icon: LucideIcon;
  variant: 'income' | 'expense' | 'balance';
  subtitle?: string;
}

export const SummaryCard = ({ title, amount, icon: Icon, variant, subtitle }: SummaryCardProps) => {
  const formattedAmount = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Math.abs(amount));

  const config = {
    income: {
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
      border: 'border-emerald-200 dark:border-emerald-800/50',
      iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      label: 'text-emerald-700 dark:text-emerald-400',
      amount: 'text-emerald-800 dark:text-emerald-300',
      sub: 'text-emerald-600/70 dark:text-emerald-500/70',
    },
    expense: {
      bg: 'bg-rose-50 dark:bg-rose-950/30',
      border: 'border-rose-200 dark:border-rose-800/50',
      iconBg: 'bg-rose-100 dark:bg-rose-900/50',
      iconColor: 'text-rose-600 dark:text-rose-400',
      label: 'text-rose-700 dark:text-rose-400',
      amount: 'text-rose-800 dark:text-rose-300',
      sub: 'text-rose-600/70 dark:text-rose-500/70',
    },
    balance: {
      bg: 'bg-violet-50 dark:bg-violet-950/30',
      border: 'border-violet-200 dark:border-violet-800/50',
      iconBg: 'bg-violet-100 dark:bg-violet-900/50',
      iconColor: 'text-violet-600 dark:text-violet-400',
      label: 'text-violet-700 dark:text-violet-400',
      amount: 'text-violet-800 dark:text-violet-300',
      sub: 'text-violet-600/70 dark:text-violet-500/70',
    },
  }[variant];

  // ✅ FIX: Determine the correct sign prefix for each variant
  const getPrefix = () => {
    if (variant === 'expense') return amount > 0 ? '−' : '';
    if (variant === 'balance') return amount < 0 ? '−' : '';
    return ''; // income: never show minus
  };

  return (
    <div className={cn(
      'rounded-2xl border p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5',
      config.bg, config.border
    )}>
      <div className="flex items-start justify-between mb-3">
        <p className={cn('text-xs font-semibold uppercase tracking-wider', config.label)}>
          {title}
        </p>
        <div className={cn('p-2 rounded-xl', config.iconBg)}>
          <Icon className={cn('w-4 h-4', config.iconColor)} />
        </div>
      </div>
      <p className={cn('text-2xl font-bold tracking-tight', config.amount)}>
        {getPrefix()}{formattedAmount}
      </p>
      {subtitle && (
        <p className={cn('text-xs mt-1.5', config.sub)}>{subtitle}</p>
      )}
    </div>
  );
};
