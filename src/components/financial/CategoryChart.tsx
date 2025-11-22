import { Card } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { CategorySummary } from '@/types/financial';

interface CategoryChartProps {
  data: CategorySummary[];
}

const COLORS: Record<string, string> = {
  'Contas': '#EF4444',
  'Gastos Pessoais': '#F59E0B',
  'Compras': '#8B5CF6',
  'Pagamento de Dívidas': '#EC4899',
};

export const CategoryChart = ({ data }: CategoryChartProps) => {
  const chartData = data.map(item => ({
    name: item.category,
    value: item.total,
    color: COLORS[item.category] || '#6B7280',
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Gastos por Categoria</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => formatCurrency(value)} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
};
