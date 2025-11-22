export type TransactionType = 'income' | 'expense';

export type ExpenseCategory = 'Contas' | 'Gastos Pessoais' | 'Compras' | 'Pagamento de Dívidas';
export type IncomeCategory = 'Salário' | 'Freela' | 'Extra';
export type Category = ExpenseCategory | IncomeCategory;

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: Category;
  type: TransactionType;
  isPaid: boolean;
}

export interface CategorySummary {
  category: Category;
  total: number;
  color: string;
}
