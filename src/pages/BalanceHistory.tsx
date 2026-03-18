import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, SupabaseTransaction } from '@/lib/supabase';
import { Transaction } from '@/types/financial';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LayoutDashboard, LogOut, Moon, Sun, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, BarChart, Bar
} from 'recharts';
import { toast } from 'sonner';

interface BalanceHistoryProps {
  session: Session;
}

const fromSupabase = (row: SupabaseTransaction): Transaction => ({
  id: row.id,
  description: row.description,
  amount: row.amount,
  date: row.date,
  createdDate: row.created_date,
  dueDate: row.due_date,
  paidDate: row.paid_date ?? undefined,
  category: row.category as Transaction['category'],
  type: row.type as Transaction['type'],
  isPaid: row.is_paid,
  recurringGroup: row.recurring_group ?? undefined,
});

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(value);

const formatCurrencyFull = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover border border-border rounded-xl px-4 py-3 shadow-lg space-y-1.5 text-sm min-w-[180px]">
        <p className="font-semibold text-foreground capitalize">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
              <span className="text-muted-foreground text-xs">{p.name}</span>
            </div>
            <span className="font-medium text-foreground text-xs">{formatCurrencyFull(p.value)}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const BalanceHistory = ({ session }: BalanceHistoryProps) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('due_date', { ascending: true });
      if (error) {
        toast.error('Erro ao carregar transações');
      } else {
        setTransactions((data as SupabaseTransaction[]).map(fromSupabase));
      }
      setLoading(false);
    };
    fetch();
  }, []);

  // Build monthly data from all transactions
  const monthlyData = (() => {
    const map = new Map<string, { income: number; expense: number }>();

    transactions.forEach(t => {
      const key = t.dueDate.slice(0, 7); // YYYY-MM
      if (!map.has(key)) map.set(key, { income: 0, expense: 0 });
      const entry = map.get(key)!;
      if (t.type === 'income') entry.income += t.amount;
      else entry.expense += t.amount;
    });

    // Sort by month
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));

    // Build chart data with running balance
    let runningBalance = 0;
    return sorted.map(([key, { income, expense }]) => {
      const [year, month] = key.split('-');
      const label = new Date(Number(year), Number(month) - 1, 1)
        .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const net = income - expense;
      runningBalance += net;
      return {
        month: label,
        key,
        Receitas: income,
        Despesas: expense,
        'Saldo Líquido': net,
        'Saldo Acumulado': runningBalance,
      };
    });
  })();

  // Summary stats
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalBalance = totalIncome - totalExpense;
  const bestMonth = monthlyData.reduce((best, m) => m['Saldo Líquido'] > (best?.['Saldo Líquido'] ?? -Infinity) ? m : best, null as any);
  const worstMonth = monthlyData.reduce((worst, m) => m['Saldo Líquido'] < (worst?.['Saldo Líquido'] ?? Infinity) ? m : worst, null as any);

  const handleLogout = async () => { await supabase.auth.signOut(); };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link to="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
                <LayoutDashboard className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight hidden sm:block">
                WeekLeaks
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)}
              className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout}
              className="h-8 w-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-6">

        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Histórico de Saldo</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Evolução financeira ao longo do tempo</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
              <p className="text-sm text-slate-500">Carregando histórico...</p>
            </div>
          </div>
        ) : monthlyData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-slate-500 dark:text-slate-400 text-sm">Nenhuma transação encontrada ainda.</p>
            <Link to="/">
              <Button variant="outline" size="sm" className="mt-4">Adicionar transações</Button>
            </Link>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total recebido</p>
                  <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/50">
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">{formatCurrencyFull(totalIncome)}</p>
                {bestMonth && <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70 mt-1.5">Melhor mês: {bestMonth.month}</p>}
              </div>

              <div className="rounded-2xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">Total gasto</p>
                  <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/50">
                    <TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-rose-800 dark:text-rose-300">{formatCurrencyFull(totalExpense)}</p>
                {worstMonth && <p className="text-xs text-rose-600/70 dark:text-rose-500/70 mt-1.5">Pior mês: {worstMonth.month}</p>}
              </div>

              <div className="rounded-2xl border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-950/30 p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400">Saldo acumulado</p>
                  <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/50">
                    <Wallet className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-violet-800 dark:text-violet-300">{formatCurrencyFull(totalBalance)}</p>
                <p className="text-xs text-violet-600/70 dark:text-violet-500/70 mt-1.5">{monthlyData.length} {monthlyData.length === 1 ? 'mês' : 'meses'} registrados</p>
              </div>
            </div>

            {/* Accumulated balance line chart */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
                Saldo acumulado ao longo do tempo
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#E11D48" strokeDasharray="4 4" opacity={0.5} />
                  <Line
                    type="monotone"
                    dataKey="Saldo Acumulado"
                    stroke="#7C3AED"
                    strokeWidth={2.5}
                    dot={{ fill: '#7C3AED', strokeWidth: 0, r: 4 }}
                    activeDot={{ r: 6, fill: '#7C3AED' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly income vs expense bar chart */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
                Receitas vs despesas por mês
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                    formatter={(value) => <span style={{ color: 'var(--muted-foreground)' }}>{value}</span>}
                  />
                  <Bar dataKey="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Despesas" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly net balance line chart */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">
                Saldo líquido por mês
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="4 4" opacity={0.6} />
                  <Bar
                    dataKey="Saldo Líquido"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    fill="#7C3AED"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default BalanceHistory;
