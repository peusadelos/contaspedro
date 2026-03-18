import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { CategorySummary } from '@/types/financial';

interface CategoryChartProps {
  data: CategorySummary[];
}

const COLORS: Record<string, string> = {
  'Contas': '#7C3AED',
  'Gastos Pessoais': '#0891B2',
  'Compras': '#D97706',
  'Pagamento de Dívidas': '#E11D48',
};

const DEFAULT_COLORS = ['#7C3AED', '#0891B2', '#D97706', '#E11D48', '#059669', '#DC2626'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-sm">
        <p className="font-medium text-foreground">{item.name}</p>
        <p className="text-muted-foreground">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.value)}
        </p>
      </div>
    );
  }
  return null;
};

export const CategoryChart = ({ data }: CategoryChartProps) => {
  const chartData = data.map((item, i) => ({
    name: item.category,
    value: item.total,
    color: COLORS[item.category] || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
  }));

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  if (chartData.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5 flex flex-col items-center justify-center min-h-[280px]">
        <p className="text-muted-foreground text-sm">Nenhuma despesa neste mês</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Despesas por categoria
      </p>

      <div className="flex items-center gap-4">
        {/* Donut chart */}
        <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={62}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-sm font-bold text-foreground leading-tight">
              {new Intl.NumberFormat('pt-BR', {
                notation: 'compact',
                style: 'currency',
                currency: 'BRL',
                maximumFractionDigits: 1,
              }).format(total)}
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2.5 flex-1 min-w-0">
          {chartData.map((item) => {
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
            return (
              <div key={item.name} className="flex items-center gap-2 min-w-0">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <p className="text-xs text-muted-foreground truncate flex-1">{item.name}</p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <p className="text-xs font-medium text-foreground">{formatCurrency(item.value)}</p>
                  <span className="text-xs text-muted-foreground/60">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
