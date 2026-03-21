import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, SupabaseTransaction } from '@/lib/supabase';
import { Transaction } from '@/types/financial';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Button } from '@/components/ui/button';
import {
  LayoutGrid, Receipt, CreditCard, TrendingUp, Moon, Sun, Menu, LogOut,
  FileText, History, Wallet, TrendingDown,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, BarChart, Bar,
} from 'recharts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Helpers ───────────────────────────────────────────────────────────────────
const fromSupabase = (row: SupabaseTransaction): Transaction => ({
  id: row.id, description: row.description, amount: row.amount, date: row.date,
  createdDate: row.created_date, dueDate: row.due_date, paidDate: row.paid_date ?? undefined,
  category: row.category as Transaction['category'], type: row.type as Transaction['type'],
  isPaid: row.is_paid, recurringGroup: row.recurring_group ?? undefined,
});
const fmtCompact = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', notation: 'compact', maximumFractionDigits: 1 }).format(v);
const fmtFull   = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl px-4 py-3 shadow-lg space-y-1.5 text-sm min-w-[180px]">
      <p className="font-semibold text-foreground capitalize">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground text-xs">{p.name}</span>
          </div>
          <span className="font-medium text-foreground text-xs">{fmtFull(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Bottom Nav Item ───────────────────────────────────────────────────────────
const BottomNavItem = ({ icon, label, to, active }: { icon: React.ReactNode; label: string; to: string; active?: boolean }) => (
  <Link to={to}
    className={cn('flex flex-col items-center justify-center px-3 py-2 rounded-2xl transition-all duration-200 active:scale-90 gap-0.5 min-w-0',
      active ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400')}
    style={active ? { background: '#EFF4FF' } : {}}>
    {icon}
    <span className="text-[10px] font-semibold uppercase tracking-wider leading-none">{label}</span>
  </Link>
);

// ─── Main ──────────────────────────────────────────────────────────────────────
interface BalanceHistoryProps { session: Session; }

export default function BalanceHistory({ session }: BalanceHistoryProps) {
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useDarkMode(); // ✅ shared hook — fixes dark mode

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase.from('transactions').select('*').order('due_date', { ascending: true });
      if (error) toast.error('Erro ao carregar transações');
      else setTransactions((data as SupabaseTransaction[]).map(fromSupabase));
      setLoading(false);
    };
    load();
  }, []);

  const monthlyData = (() => {
    const map = new Map<string, { income: number; expense: number }>();
    transactions.forEach(t => {
      const key = t.dueDate.slice(0, 7);
      if (!map.has(key)) map.set(key, { income: 0, expense: 0 });
      const entry = map.get(key)!;
      if (t.type === 'income') entry.income += t.amount;
      else entry.expense += t.amount;
    });
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let running = 0;
    return sorted.map(([key, { income, expense }]) => {
      const [y, m] = key.split('-');
      const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const net = income - expense;
      running += net;
      return { month: label, key, Receitas: income, Despesas: expense, 'Saldo Líquido': net, 'Saldo Acumulado': running };
    });
  })();

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalBalance = totalIncome - totalExpense;
  const bestMonth  = monthlyData.reduce((b, m) => m['Saldo Líquido'] > (b?.['Saldo Líquido'] ?? -Infinity) ? m : b, null as any);
  const worstMonth = monthlyData.reduce((b, m) => m['Saldo Líquido'] < (b?.['Saldo Líquido'] ?? Infinity) ? m : b, null as any);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 sm:pb-0">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          {/* ✅ Logo is now a home button on mobile */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm bg-indigo-600">W</div>
            <span className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight hidden sm:block">WeekLeaks</span>
          </Link>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:block truncate max-w-[160px]">{session.user.email}</span>
            {/* Hamburger — desktop only */}
            <div className="hidden sm:flex">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg px-2.5 gap-1.5">
                    <Menu className="w-3.5 h-3.5" /> Menu
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem asChild><Link to="/" className="flex items-center gap-2 cursor-pointer"><LayoutGrid className="w-4 h-4 text-slate-500" /> Dashboard</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/extrato" className="flex items-center gap-2 cursor-pointer"><FileText className="w-4 h-4 text-slate-500" /> Extrato</Link></DropdownMenuItem>
                  <DropdownMenuItem asChild><Link to="/cartoes" className="flex items-center gap-2 cursor-pointer"><CreditCard className="w-4 h-4 text-slate-500" /> Cartões</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {/* ✅ Dark mode toggle */}
                  <DropdownMenuItem onClick={toggleDarkMode} className="flex items-center gap-2 cursor-pointer">
                    {darkMode ? <Sun className="w-4 h-4 text-slate-500" /> : <Moon className="w-4 h-4 text-slate-500" />}
                    {darkMode ? 'Modo claro' : 'Modo escuro'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => supabase.auth.signOut()} className="flex items-center gap-2 cursor-pointer text-rose-600 dark:text-rose-400">
                    <LogOut className="w-4 h-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
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
            <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          </div>
        ) : monthlyData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <p className="text-slate-500 dark:text-slate-400 text-sm">Nenhuma transação encontrada ainda.</p>
            <Link to="/"><Button variant="outline" size="sm" className="mt-4">Adicionar transações</Button></Link>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/30 p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Total recebido</p>
                  <div className="p-2 rounded-xl bg-emerald-100 dark:bg-emerald-900/50"><TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /></div>
                </div>
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">{fmtFull(totalIncome)}</p>
                {bestMonth && <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70 mt-1.5">Melhor mês: {bestMonth.month}</p>}
              </div>

              <div className="rounded-2xl border border-rose-200 dark:border-rose-800/50 bg-rose-50 dark:bg-rose-950/30 p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-400">Total gasto</p>
                  <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/50"><TrendingDown className="w-4 h-4 text-rose-600 dark:text-rose-400" /></div>
                </div>
                <p className="text-2xl font-bold text-rose-800 dark:text-rose-300">{fmtFull(totalExpense)}</p>
                {worstMonth && <p className="text-xs text-rose-600/70 dark:text-rose-500/70 mt-1.5">Pior mês: {worstMonth.month}</p>}
              </div>

              <div className="rounded-2xl border border-violet-200 dark:border-violet-800/50 bg-violet-50 dark:bg-violet-950/30 p-5">
                <div className="flex items-start justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400">Saldo acumulado</p>
                  <div className="p-2 rounded-xl bg-violet-100 dark:bg-violet-900/50"><Wallet className="w-4 h-4 text-violet-600 dark:text-violet-400" /></div>
                </div>
                <p className="text-2xl font-bold text-violet-800 dark:text-violet-300">{fmtFull(totalBalance)}</p>
                <p className="text-xs text-violet-600/70 dark:text-violet-500/70 mt-1.5">{monthlyData.length} {monthlyData.length === 1 ? 'mês' : 'meses'} registrados</p>
              </div>
            </div>

            {/* Accumulated balance line chart */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">Saldo acumulado ao longo do tempo</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#E11D48" strokeDasharray="4 4" opacity={0.5} />
                  <Line type="monotone" dataKey="Saldo Acumulado" stroke="#7C3AED" strokeWidth={2.5} dot={{ fill: '#7C3AED', strokeWidth: 0, r: 4 }} activeDot={{ r: 6, fill: '#7C3AED' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Monthly income vs expense */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">Receitas vs despesas por mês</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} formatter={v => <span style={{ color: 'var(--muted-foreground)' }}>{v}</span>} />
                  <Bar dataKey="Receitas" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Bar dataKey="Despesas" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Net balance */}
            <div className="rounded-2xl border border-border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-5">Saldo líquido por mês</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickLine={false} axisLine={false} width={70} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="4 4" opacity={0.6} />
                  <Bar dataKey="Saldo Líquido" radius={[4, 4, 0, 0]} maxBarSize={40} fill="#7C3AED" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </main>

      {/* ── Bottom Nav (mobile only) ── */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex sm:hidden justify-around items-center px-2 pb-6 pt-3 rounded-t-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl"
        style={{ borderTop: '1px solid rgba(15,23,42,0.06)', boxShadow: '0 -8px 32px rgba(15,23,42,0.07)' }}>
        <BottomNavItem to="/" icon={<LayoutGrid className="w-5 h-5" />} label="Home" />
        <BottomNavItem to="/extrato" icon={<Receipt className="w-5 h-5" />} label="Extrato" />
        <BottomNavItem to="/cartoes" icon={<CreditCard className="w-5 h-5" />} label="Cartões" />
        <BottomNavItem to="/historico" active={location.pathname === '/historico'} icon={<TrendingUp className="w-5 h-5" />} label="Histórico" />
        {/* ✅ Tema button — properly aligned using same flex structure */}
        <button onClick={toggleDarkMode}
          className="flex flex-col items-center justify-center px-3 py-2 rounded-2xl gap-0.5 min-w-0 text-slate-500 dark:text-slate-400 transition-colors active:scale-90">
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="text-[10px] font-semibold uppercase tracking-wider leading-none">Tema</span>
        </button>
      </nav>
    </div>
  );
}
