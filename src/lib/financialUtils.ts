import { Transaction, TransactionStatus } from '@/types/financial';

export const getTransactionStatus = (transaction: Transaction): TransactionStatus => {
  if (transaction.isPaid || transaction.paidDate) {
    return 'paid';
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(transaction.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  
  if (dueDate > today) {
    return 'future';
  } else if (dueDate < today) {
    return 'overdue';
  } else {
    return 'pending';
  }
};

export const getDaysOverdue = (transaction: Transaction): number => {
  if (transaction.isPaid || transaction.paidDate) {
    return 0;
  }
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(transaction.dueDate);
  dueDate.setHours(0, 0, 0, 0);
  
  if (dueDate >= today) {
    return 0;
  }
  
  const diffTime = today.getTime() - dueDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
};

export const getStatusColor = (status: TransactionStatus): string => {
  switch (status) {
    case 'paid':
      return 'text-green-600';
    case 'pending':
      return 'text-yellow-600';
    case 'overdue':
      return 'text-red-600';
    case 'future':
      return 'text-blue-600';
  }
};

export const getStatusBadgeVariant = (status: TransactionStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'paid':
      return 'default';
    case 'pending':
      return 'secondary';
    case 'overdue':
      return 'destructive';
    case 'future':
      return 'outline';
  }
};

export const getStatusLabel = (status: TransactionStatus): string => {
  switch (status) {
    case 'paid':
      return '🟢 Quitado';
    case 'pending':
      return '🟡 Pendente';
    case 'overdue':
      return '🔴 Atrasado';
    case 'future':
      return '🔵 Futuro';
  }
};
