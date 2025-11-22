import { Transaction } from '@/types/financial';

export const mockTransactions: Transaction[] = [
  // Receitas
  {
    id: '1',
    description: 'Salário Novembro',
    amount: 5000,
    date: '2024-11-05',
    category: 'Salário',
    type: 'income',
    isPaid: true,
  },
  {
    id: '2',
    description: 'Freela - Desenvolvimento Site',
    amount: 1500,
    date: '2024-11-10',
    category: 'Freela',
    type: 'income',
    isPaid: false,
  },
  {
    id: '3',
    description: 'Venda de Item Usado',
    amount: 300,
    date: '2024-11-15',
    category: 'Extra',
    type: 'income',
    isPaid: true,
  },
  
  // Despesas - Contas
  {
    id: '4',
    description: 'Aluguel',
    amount: 1800,
    date: '2024-11-10',
    category: 'Contas',
    type: 'expense',
    isPaid: true,
  },
  {
    id: '5',
    description: 'Conta de Luz',
    amount: 180,
    date: '2024-11-15',
    category: 'Contas',
    type: 'expense',
    isPaid: false,
  },
  {
    id: '6',
    description: 'Internet',
    amount: 120,
    date: '2024-11-20',
    category: 'Contas',
    type: 'expense',
    isPaid: false,
  },
  
  // Despesas - Gastos Pessoais
  {
    id: '7',
    description: 'Supermercado',
    amount: 650,
    date: '2024-11-08',
    category: 'Gastos Pessoais',
    type: 'expense',
    isPaid: true,
  },
  {
    id: '8',
    description: 'Restaurante',
    amount: 85,
    date: '2024-11-12',
    category: 'Gastos Pessoais',
    type: 'expense',
    isPaid: true,
  },
  {
    id: '9',
    description: 'Farmácia',
    amount: 45,
    date: '2024-11-18',
    category: 'Gastos Pessoais',
    type: 'expense',
    isPaid: false,
  },
  
  // Despesas - Compras
  {
    id: '10',
    description: 'Notebook Novo',
    amount: 3500,
    date: '2024-11-05',
    category: 'Compras',
    type: 'expense',
    isPaid: true,
  },
  {
    id: '11',
    description: 'Roupas',
    amount: 420,
    date: '2024-11-14',
    category: 'Compras',
    type: 'expense',
    isPaid: false,
  },
  
  // Despesas - Pagamento de Dívidas
  {
    id: '12',
    description: 'Cartão de Crédito',
    amount: 850,
    date: '2024-11-25',
    category: 'Pagamento de Dívidas',
    type: 'expense',
    isPaid: false,
  },
  {
    id: '13',
    description: 'Empréstimo Pessoal',
    amount: 500,
    date: '2024-11-28',
    category: 'Pagamento de Dívidas',
    type: 'expense',
    isPaid: false,
  },
];
