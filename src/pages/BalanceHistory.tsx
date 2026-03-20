import { useDarkMode } from '@/hooks/useDarkMode';
import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, SupabaseTransaction } from '@/lib/supabase';
import { Transaction } from '@/types/financial';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft, LogOut, Moon, Sun, Menu, FileText,
  CreditCard, LayoutGrid, Receipt, TrendingUp,
  TrendingDown, Wallet, Sparkles, Calendar,
  Search, X
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, ReferenceLine,
} from 'recharts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getTransactionStatus } from '@/lib/financialUtils';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  primary:          '#4F46E5',
  primaryDark:      '#3730A3',
  primaryLight:     '#818CF8',
  primaryBg:        '#EEF2FF',
  primaryFixed:     '#E2DFFF',
  tertiary:         '#10B981',
  tertiaryFixed:    '#6FFBBE',
  tertiaryBg:       '#D1FAE5',
  error:            '#EF4444',
  errorBg:          '#FEE2E2',
  surface:          '#F8F9FF',
  surfaceLowest:    '#FFFFFF',
  surfaceLow:       '#EFF4FF',
  surfaceMid:       '#E5EEFF',
  surfaceHigh:      '#DCE9FF',
  onSurface:        '#0B1C30',
  onSurfaceVariant: '#464555',
  neutral:          '#64748B',
  outline:          '#777587',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
const toMonthKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Math.abs(v));

const fmtCompact = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    notation: 'compact', style: 'currency', currency: 'BRL', maximumFractionDigits: 1,
  }).format(v);

const fromSupabase = (row: SupabaseTransaction): Transaction => ({
  id: row.id, description: row.description, amount: row.amount,
  date: row.date, createdDate: row.created_date, dueDate: row.due_date,
  paidDate: row.paid_date ?? undefined,
  category: row.category as Transaction['category'],
  type: row.type as Transaction['type'],
  isPaid: row.is_paid, recurringGroup: row.recurring_group ?? undefined,
});

const categoryEmoji: Record<string, string> = {
  'Contas': '🏠', 'Gastos Pessoais': '🛒', 'Compras': '🛍️',
  'Pagamento de Dívidas': '💳', 'Salário': '💼', 'Freela': '💻', 'Extra': '⭐',
  'Alimentação': '🍔', 'Transporte': '🚗', 'Lazer': '🎮',
  'Viagem': '✈️', 'Educação': '🎓', 'Pet': '🐾', 'Saúde': '❤️',
};

// Group transactions by relative date label
const getDateLabel = (dateStr: string): string => {
  const today = new Date();
  const txDate = new Date(dateStr + 'T12:00:00');
  const todayKey = toMonthKey(today) + '-' + String(today.getDate()).padStart(2, '0');
  const txKey = dateStr.slice(0, 7) + '-' + dateStr.slice(8, 10);
  if (txKey === todayKey) return 'Hoje';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = toMonthKey(yesterday) + '-' + String(yesterday.getDate()).padStart(2, '0');
  if (txKey === yKey) return 'Ontem';
  return txDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
};

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl px-4 py-3 shadow-lg text-sm min-w-[160px]"
      style={{ background: C.surfaceLowest, border: `1px solid ${C.surfaceMid}` }}>
      <p className="font-semibold mb-2" style={{ color: C.onSurface }}>{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-xs" style={{ color: C.onSurfaceVariant }}>{p.name}</span>
          </div>
          <span className="text-xs font-bold" style={{ color: C.onSurface }}>{fmtCompact(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Bottom Nav Item ───────────────────────────────────────────────────────────
const BottomNavItem = ({ icon, label, to, active }: {
  icon: React.ReactNode; label: string; to: string; active?: boolean;
}) => (
  <Link to={to}
    className={cn('flex flex-col items-center justify-center px-4 py-2 rounded-2xl transition-all duration-200 active:scale-90 gap-0.5',
      active ? 'text-[#4F46E5] dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400 hover:text-[#4F46E5]'
    )}
    style={active ? { background: C.surfaceLow } : {}}
  >
    {icon}
    <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
  </Link>
);

// ─── Main Component ────────────────────────────────────────────────────────────
interface BalanceHistoryProps { session: Session; }

export default function BalanceHistory({ session }: BalanceHistoryProps) {
  const location = useLocation();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

 const { darkMode, toggleDarkMode } = useDarkMode();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions').select('*').order('due_date', { ascending: true });
      if (error) toast.error('Erro ao carregar transações');
      else setTransactions((data as SupabaseTransaction[]).map(fromSupabase));
      setLoading(false);
    };
    load();
  }, []);

  // Monthly chart data
  const monthlyData = (() => {
    const map = new Map<string, { income: number; expense: number }>();
    transactions.forEach(t => {
      const key = t.dueDate.slice(0, 7);
      if (!map.has(key)) map.set(key, { income: 0, expense: 0 });
      const e = map.get(key)!;
      if (t.type === 'income') e.income += t.amount;
      else e.expense += t.amount;
    });
    const sorted = Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let running = 0;
    return sorted.map(([key, { income, expense }]) => {
      const [y, m] = key.split('-');
      const label = new Date(Number(y), Number(m) - 1, 1)
        .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const net = income - expense;
      running += net;
      return { month: label, Receitas: income, Despesas: expense, 'Saldo Líquido': net, 'Acumulado': running };
    });
  })();

  // Overall stats
  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const netBalance   = totalIncome - totalExpense;

  // Spending by category (all time)
  const expByCat = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => { acc[t.category] = (acc[t.category] || 0) + t.amount; return acc; }, {} as Record<string, number>);
  const totalExp = Object.values(expByCat).reduce((s, v) => s + v, 0);
  const topCats = Object.entries(expByCat).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Best / worst month
  const bestMonth  = monthlyData.reduce((b, m) => m['Saldo Líquido'] > (b?.['Saldo Líquido'] ?? -Infinity) ? m : b, null as any);
  const worstMonth = monthlyData.reduce((w, m) => m['Saldo Líquido'] < (w?.['Saldo Líquido'] ?? Infinity) ? m : w, null as any);

  // Filtered & searched transactions for the list
  const filtered = transactions
    .filter(t => {
      if (filter === 'income' && t.type !== 'income') return false;
      if (filter === 'expense' && t.type !== 'expense') return false;
      if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

  // Group by date label
  const grouped: { label: string; transactions: Transaction[] }[] = [];
  filtered.forEach(tx => {
    const label = getDateLabel(tx.dueDate);
    const existing = grouped.find(g => g.label === label);
    if (existing) existing.transactions.push(tx);
    else grouped.push({ label, transactions: [tx] });
  });

  // Pending bills (upcoming)
  const upcoming = transactions
    .filter(t => !t.isPaid && getTransactionStatus(t) === 'future')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 4);

  return (
    <div className="min-h-screen pb-20 sm:pb-0" style={{ background: C.surface }}>

      {/* ── Header ── */}
      <header className="fixed top-0 left-0 w-full z-50 backdrop-blur-md"
        style={{ background: `${C.surface}E8`, borderBottom: `1px solid ${C.onSurface}08` }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Link to="/">
              <button className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                style={{ color: C.onSurfaceVariant }}>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` }}>W</div>
            <span className="font-bold text-base hidden sm:block" style={{ color: C.onSurface }}>WeekLeaks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs hidden md:block truncate max-w-[160px]" style={{ color: C.neutral }}>{session.user.email}</span>
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
                  <DropdownMenuItem onClick={() => setDarkMode(!darkMode)} className="flex items-center gap-2 cursor-pointer">
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

      <main className="pt-20 max-w-6xl mx-auto px-4 sm:px-6 pb-8 space-y-8">

        {/* ── Search + Filter ── */}
        <div className="space-y-4 pt-2">
          {/* Search */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
              <Search className="w-4 h-4" style={{ color: C.outline }} />
            </div>
            <input
              className="w-full pl-12 pr-10 py-4 rounded-xl text-sm outline-none transition-all"
              style={{
                background: C.surfaceLowest,
                color: C.onSurface,
                boxShadow: `0 20px 40px rgba(11,28,48,0.04)`,
              }}
              placeholder="Buscar transações, categorias..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button onClick={() => setSearch('')}
                className="absolute inset-y-0 right-4 flex items-center"
                style={{ color: C.outline }}>
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {(['all', 'expense', 'income'] as const).map(f => (
              <button key={f}
                onClick={() => setFilter(f)}
                className="px-5 py-2 rounded-full text-sm font-semibold transition-all active:scale-95 whitespace-nowrap flex-shrink-0"
                style={filter === f
                  ? { background: C.primary, color: '#fff', boxShadow: `0 8px 20px ${C.primary}30` }
                  : { background: C.surfaceLow, color: C.onSurfaceVariant }
                }
              >
                {f === 'all' ? 'Todos' : f === 'expense' ? 'Despesas' : 'Receitas'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 animate-spin"
              style={{ borderColor: C.primary, borderTopColor: 'transparent' }} />
          </div>
        ) : (
          /* ── Asymmetric Bento Grid ── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

            {/* ── Left: Transaction List (8 cols) ── */}
            <div className="lg:col-span-8 space-y-8">
              {grouped.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-base font-medium" style={{ color: C.onSurfaceVariant }}>
                    {search ? `Nenhum resultado para "${search}"` : 'Nenhuma transação ainda'}
                  </p>
                </div>
              ) : (
                grouped.map(group => (
                  <section key={group.label}>
                    <h2 className="font-bold text-lg mb-4 px-1" style={{ color: C.onSurfaceVariant }}>
                      {group.label}
                    </h2>
                    <div className="space-y-3">
                      {group.transactions.map(tx => {
                        const isIncome = tx.type === 'income';
                        const emoji = categoryEmoji[tx.category] || '📌';
                        const time = new Date(tx.dueDate + 'T12:00:00')
                          .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

                        return (
                          <div key={tx.id}
                            className="group flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer"
                            style={{
                              background: C.surfaceLowest,
                              boxShadow: '0 4px 20px rgba(11,28,48,0.02)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = C.surfaceLow)}
                            onMouseLeave={e => (e.currentTarget.style.background = C.surfaceLowest)}
                          >
                            <div className="flex items-center gap-4">
                              {/* Icon */}
                              <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform"
                                style={{
                                  background: isIncome ? '#D1FAE5' : '#FEE2E220',
                                }}
                              >
                                {emoji}
                              </div>
                              <div>
                                <p className="font-semibold text-sm" style={{ color: C.onSurface }}>
                                  {tx.description}
                                  {/* Highlight search match */}
                                  {search && tx.description.toLowerCase().includes(search.toLowerCase()) && (
                                    <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded font-bold"
                                      style={{ background: `${C.primary}18`, color: C.primary }}>
                                      ●
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: C.onSurfaceVariant }}>
                                  {tx.category} · {time}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-sm"
                                style={{ color: isIncome ? '#059669' : C.error }}>
                                {isIncome ? '+' : '−'}{fmt(tx.amount)}
                              </p>
                              <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5"
                                style={{ color: C.outline }}>
                                {tx.isPaid ? 'Pago' : tx.type === 'income' ? 'Pendente' : 'A pagar'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))
              )}

              {/* ── Bar chart: Receitas vs Despesas ── */}
              {monthlyData.length > 0 && (
                <section className="space-y-4">
                  <h2 className="font-bold text-lg px-1" style={{ color: C.onSurfaceVariant }}>
                    Receitas vs Despesas
                  </h2>
                  <div className="rounded-[1.5rem] p-6"
                    style={{ background: C.surfaceLowest, boxShadow: '0 10px 30px rgba(11,28,48,0.03)' }}>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }} barGap={4}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.surfaceMid} opacity={0.8} />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: C.neutral }} tickLine={false} axisLine={false} />
                        <YAxis tickFormatter={v => fmtCompact(v)} tick={{ fontSize: 10, fill: C.neutral }} tickLine={false} axisLine={false} width={60} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="Receitas" fill={C.tertiary} radius={[4, 4, 0, 0]} maxBarSize={36} />
                        <Bar dataKey="Despesas" fill={C.error} radius={[4, 4, 0, 0]} maxBarSize={36} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}
            </div>

            {/* ── Right: Analytics Bento (4 cols) ── */}
            <div className="lg:col-span-4 space-y-5">

              {/* Monthly summary — gradient card */}
              <div
                className="p-6 rounded-[1.5rem] text-white"
                style={{
                  background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
                  boxShadow: `0 20px 40px ${C.primary}30`,
                }}
              >
                <p className="text-sm font-medium opacity-80 mb-1">Total Gasto (tudo)</p>
                <h3 className="text-3xl font-extrabold mb-6">{fmt(totalExpense)}</h3>
                <div className="space-y-4">
                  {topCats.map(([cat, val]) => {
                    const pct = totalExp > 0 ? Math.round((val / totalExp) * 100) : 0;
                    return (
                      <div key={cat}>
                        <div className="flex justify-between items-center text-sm mb-1.5">
                          <span className="opacity-80">{cat}</span>
                          <span className="font-bold">{pct}%</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.2)' }}>
                          <div className="h-full rounded-full bg-white transition-all duration-700" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Savings Insight — mint green card */}
              <div
                className="p-6 rounded-[1.5rem]"
                style={{
                  background: C.tertiaryFixed,
                  boxShadow: '0 10px 30px rgba(111,251,190,0.15)',
                }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="w-6 h-6" style={{ color: '#005236' }} />
                  <p className="font-bold text-xs uppercase tracking-widest" style={{ color: '#005236' }}>
                    Insight Financeiro
                  </p>
                </div>
                {bestMonth ? (
                  <p className="font-bold text-xl leading-snug" style={{ color: '#003D27' }}>
                    Melhor mês: <span style={{ color: C.primaryDark }}>{bestMonth.month}</span>
                    {' '}com saldo de {fmtCompact(bestMonth['Saldo Líquido'])}.
                  </p>
                ) : (
                  <p className="font-bold text-xl leading-snug" style={{ color: '#003D27' }}>
                    Adicione transações para ver seus insights financeiros.
                  </p>
                )}
              </div>

              {/* Accumulated balance line chart */}
              {monthlyData.length > 0 && (
                <div className="rounded-[1.5rem] p-5"
                  style={{ background: C.surfaceLowest, boxShadow: '0 10px 30px rgba(11,28,48,0.03)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-bold text-sm" style={{ color: C.onSurface }}>Saldo Acumulado</p>
                    <span className="text-xs font-bold px-2 py-1 rounded-full"
                      style={{ background: C.primaryBg, color: C.primary }}>
                      {monthlyData.length} meses
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={130}>
                    <LineChart data={monthlyData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <XAxis dataKey="month" tick={{ fontSize: 9, fill: C.neutral }} tickLine={false} axisLine={false} />
                      <YAxis hide />
                      <Tooltip content={<ChartTooltip />} />
                      <ReferenceLine y={0} stroke={C.error} strokeDasharray="4 4" opacity={0.4} />
                      <Line type="monotone" dataKey="Acumulado" stroke={C.primary} strokeWidth={2.5}
                        dot={{ fill: C.primary, strokeWidth: 0, r: 3 }}
                        activeDot={{ r: 5, fill: C.primary }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Summary stats */}
              <div className="rounded-[1.5rem] p-5 space-y-3"
                style={{ background: C.surfaceLowest, boxShadow: '0 10px 30px rgba(11,28,48,0.03)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-bold text-sm" style={{ color: C.onSurface }}>Resumo Geral</p>
                  <Calendar className="w-4 h-4" style={{ color: C.primary }} />
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: 'Total recebido', value: fmt(totalIncome), color: C.tertiary },
                    { label: 'Total gasto', value: fmt(totalExpense), color: C.error },
                    { label: 'Saldo líquido', value: fmt(netBalance), color: netBalance >= 0 ? C.primary : C.error },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between py-2"
                      style={{ borderBottom: `1px solid ${C.surfaceLow}` }}>
                      <span className="text-sm" style={{ color: C.onSurfaceVariant }}>{label}</span>
                      <span className="text-sm font-bold" style={{ color }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Upcoming bills */}
              {upcoming.length > 0 && (
                <div className="rounded-[1.5rem] p-5"
                  style={{ background: C.surfaceLow, boxShadow: '0 10px 30px rgba(11,28,48,0.03)' }}>
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-bold text-sm" style={{ color: C.onSurface }}>Próximos Vencimentos</p>
                    <Calendar className="w-4 h-4" style={{ color: C.primary }} />
                  </div>
                  <div className="space-y-2.5">
                    {upcoming.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{categoryEmoji[tx.category] || '📌'}</span>
                          <span className="text-sm" style={{ color: C.onSurfaceVariant }}>{tx.description}</span>
                        </div>
                        <span className="text-sm font-bold" style={{ color: C.onSurface }}>{fmt(tx.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Bottom Nav (mobile only) ── */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex sm:hidden justify-around items-center px-4 pb-6 pt-3 rounded-t-3xl"
        style={{
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(24px)',
          borderTop: `1px solid ${C.onSurface}0D`,
          boxShadow: '0 -8px 32px rgba(15,23,42,0.06)',
        }}>
        <BottomNavItem to="/" icon={<LayoutGrid className="w-5 h-5" />} label="Home" />
        <BottomNavItem to="/extrato" icon={<Receipt className="w-5 h-5" />} label="Extrato" />
        <BottomNavItem to="/cartoes" icon={<CreditCard className="w-5 h-5" />} label="Cartões" />
        <BottomNavItem to="/historico" active={location.pathname === '/historico'} icon={<TrendingUp className="w-5 h-5" />} label="Histórico" />
        <button onClick={() => setDarkMode(!darkMode)}
          className="flex flex-col items-center justify-center px-4 py-2 gap-0.5 transition-colors active:scale-90"
          style={{ color: C.neutral }}>
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="text-[10px] font-semibold uppercase tracking-wider">Tema</span>
        </button>
      </nav>
    </div>
  );
}
