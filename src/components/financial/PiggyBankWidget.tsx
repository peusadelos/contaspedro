import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PiggyBank, Plus, Minus, Target, TrendingUp, History } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SavingsTransaction {
  id: string;
  amount: number;
  type: 'deposit' | 'withdraw';
  description: string;
  created_at: string;
}

interface PiggyBankWidgetProps {
  session: Session;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

export const PiggyBankWidget = ({ session }: PiggyBankWidgetProps) => {
  const [balance, setBalance] = useState(0);
  const [goal, setGoal] = useState(0);
  const [history, setHistory] = useState<SavingsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Transaction form
  const [txType, setTxType] = useState<'deposit' | 'withdraw'>('deposit');
  const [txAmount, setTxAmount] = useState('');
  const [txDesc, setTxDesc] = useState('');

  // Goal form
  const [newGoal, setNewGoal] = useState('');

  // Load savings data
  useEffect(() => {
    const fetchSavings = async () => {
      setLoading(true);

      // Get or create savings record
      const { data: savingsData } = await supabase
        .from('savings')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      if (savingsData) {
        setBalance(savingsData.balance);
        setGoal(savingsData.goal);
      } else {
        // Create initial record
        await supabase.from('savings').insert({
          user_id: session.user.id,
          balance: 0,
          goal: 0,
        });
      }

      // Get transaction history
      const { data: historyData } = await supabase
        .from('savings_transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (historyData) setHistory(historyData as SavingsTransaction[]);
      setLoading(false);
    };

    fetchSavings();
  }, [session.user.id]);

  const handleTransaction = async () => {
    const amt = parseFloat(txAmount);
    if (!amt || amt <= 0) { toast.error('Valor deve ser maior que zero'); return; }
    if (!txDesc.trim()) { toast.error('Descrição é obrigatória'); return; }
    if (txType === 'withdraw' && amt > balance) {
      toast.error('Saldo insuficiente na poupança'); return;
    }

    const newBalance = txType === 'deposit' ? balance + amt : balance - amt;

    // Update balance
    const { error: balanceError } = await supabase
      .from('savings')
      .upsert({
        user_id: session.user.id,
        balance: newBalance,
        goal,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (balanceError) { toast.error('Erro ao atualizar poupança'); return; }

    // Record transaction
    const { data: txData, error: txError } = await supabase
      .from('savings_transactions')
      .insert({
        user_id: session.user.id,
        amount: amt,
        type: txType,
        description: txDesc.trim(),
      })
      .select()
      .single();

    if (txError) { toast.error('Erro ao registrar transação'); return; }

    setBalance(newBalance);
    setHistory(prev => [txData as SavingsTransaction, ...prev.slice(0, 9)]);
    toast.success(txType === 'deposit' ? `+${formatCurrency(amt)} guardado!` : `-${formatCurrency(amt)} retirado!`);
    setShowDialog(false);
    setTxAmount('');
    setTxDesc('');
  };

  const handleSetGoal = async () => {
    const g = parseFloat(newGoal);
    if (!g || g <= 0) { toast.error('Meta deve ser maior que zero'); return; }

    const { error } = await supabase
      .from('savings')
      .upsert({
        user_id: session.user.id,
        balance,
        goal: g,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) { toast.error('Erro ao salvar meta'); return; }
    setGoal(g);
    toast.success('Meta atualizada!');
    setShowGoalDialog(false);
    setNewGoal('');
  };

  const progress = goal > 0 ? Math.min((balance / goal) * 100, 100) : 0;
  const remaining = goal > 0 ? Math.max(goal - balance, 0) : 0;

  // Progress bar color
  const progressColor = progress >= 100
    ? 'bg-emerald-500'
    : progress >= 75
    ? 'bg-violet-500'
    : progress >= 40
    ? 'bg-blue-500'
    : 'bg-amber-500';

  if (loading) return null;

  return (
    <>
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
              <PiggyBank className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Poupança</p>
            </div>
          </div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            title="Histórico"
          >
            <History className="w-4 h-4" />
          </button>
        </div>

        {/* Balance */}
        <div>
          <p className="text-3xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
            {formatCurrency(balance)}
          </p>
          {goal > 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {progress >= 100
                ? '🎉 Meta atingida!'
                : `Faltam ${formatCurrency(remaining)} para a meta`}
            </p>
          )}
        </div>

        {/* Progress bar */}
        {goal > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>{progress.toFixed(0)}%</span>
              <button
                onClick={() => { setNewGoal(String(goal)); setShowGoalDialog(true); }}
                className="flex items-center gap-1 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                <Target className="w-3 h-3" />
                Meta: {formatCurrency(goal)}
              </button>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', progressColor)}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* No goal yet */}
        {goal === 0 && (
          <button
            onClick={() => setShowGoalDialog(true)}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
          >
            <Target className="w-3.5 h-3.5" />
            Definir uma meta de poupança
          </button>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            onClick={() => { setTxType('deposit'); setShowDialog(true); }}
            className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 rounded-lg"
          >
            <Plus className="w-3.5 h-3.5" />
            Guardar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setTxType('withdraw'); setShowDialog(true); }}
            disabled={balance === 0}
            className="h-8 text-xs gap-1.5 rounded-lg border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
          >
            <Minus className="w-3.5 h-3.5" />
            Retirar
          </Button>
        </div>

        {/* History (collapsible) */}
        {showHistory && history.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Últimas movimentações
            </p>
            {history.map(tx => (
              <div key={tx.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                    tx.type === 'deposit'
                      ? 'bg-emerald-100 dark:bg-emerald-900/40'
                      : 'bg-rose-100 dark:bg-rose-900/40'
                  )}>
                    {tx.type === 'deposit'
                      ? <Plus className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                      : <Minus className="w-2.5 h-2.5 text-rose-600 dark:text-rose-400" />
                    }
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 truncate">{tx.description}</p>
                </div>
                <p className={cn(
                  'text-xs font-semibold flex-shrink-0',
                  tx.type === 'deposit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                )}>
                  {tx.type === 'deposit' ? '+' : '−'}{formatCurrency(tx.amount)}
                </p>
              </div>
            ))}
          </div>
        )}

        {showHistory && history.length === 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">Nenhuma movimentação ainda</p>
          </div>
        )}
      </div>

      {/* Transaction Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        {showDialog && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowDialog(false)} />}
        <DialogContent className="sm:max-w-[340px] z-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {txType === 'deposit'
                ? <><Plus className="w-4 h-4 text-emerald-600" /> Guardar dinheiro</>
                : <><Minus className="w-4 h-4 text-rose-600" /> Retirar dinheiro</>
              }
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">

            {/* Toggle deposit/withdraw */}
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                onClick={() => setTxType('deposit')}
                className={cn(
                  'py-1.5 rounded-lg text-xs font-medium transition-all',
                  txType === 'deposit'
                    ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                )}
              >
                Guardar
              </button>
              <button
                onClick={() => setTxType('withdraw')}
                className={cn(
                  'py-1.5 rounded-lg text-xs font-medium transition-all',
                  txType === 'withdraw'
                    ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                )}
              >
                Retirar
              </button>
            </div>

            <div className="space-y-1.5">
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={txAmount}
                onChange={e => setTxAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input
                value={txDesc}
                onChange={e => setTxDesc(e.target.value)}
                placeholder={txType === 'deposit' ? 'Ex: Sobra do mês' : 'Ex: Viagem'}
              />
            </div>

            {txType === 'withdraw' && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Saldo disponível: <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(balance)}</span>
              </p>
            )}

            <Button
              onClick={handleTransaction}
              className={cn(
                'w-full',
                txType === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
              )}
            >
              {txType === 'deposit' ? 'Guardar' : 'Retirar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Goal Dialog */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        {showGoalDialog && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowGoalDialog(false)} />}
        <DialogContent className="sm:max-w-[320px] z-50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="w-4 h-4 text-violet-600" /> Meta de poupança
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Valor da meta (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={newGoal}
                onChange={e => setNewGoal(e.target.value)}
                placeholder="Ex: 10000.00"
                autoFocus
              />
            </div>
            <Button onClick={handleSetGoal} className="w-full bg-violet-600 hover:bg-violet-700">
              Salvar meta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
