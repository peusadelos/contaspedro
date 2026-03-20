import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft, LayoutDashboard, LogOut, Moon, Sun,
  Plus, CreditCard, Trash2, Pencil, Receipt, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CreditCardType {
  id: string;
  name: string;
  closing_day: number;
  due_day: number;
  color: string;
}

interface CardPurchase {
  id: string;
  card_id: string;
  description: string;
  amount: number;
  category: string;
  purchase_date: string;
  installments: number;
  installment_number: number;
}

// ✅ Category picker data
const PURCHASE_CATEGORIES = [
  { value: 'Alimentação',  emoji: '🍔', label: 'Alimentação' },
  { value: 'Compras',      emoji: '🛍️', label: 'Compras' },
  { value: 'Contas',       emoji: '🏠', label: 'Contas' },
  { value: 'Saúde',        emoji: '❤️', label: 'Saúde' },
  { value: 'Transporte',   emoji: '🚗', label: 'Transporte' },
  { value: 'Lazer',        emoji: '🎮', label: 'Lazer' },
  { value: 'Viagem',       emoji: '✈️', label: 'Viagem' },
  { value: 'Educação',     emoji: '🎓', label: 'Educação' },
  { value: 'Pet',          emoji: '🐾', label: 'Pet' },
  { value: 'Dívidas',      emoji: '💳', label: 'Dívidas' },
  { value: 'Outros',       emoji: '📦', label: 'Outros' },
];

const CARD_COLORS = [
  { value: '#7C3AED', label: 'Violeta' },
  { value: '#0891B2', label: 'Azul' },
  { value: '#059669', label: 'Verde' },
  { value: '#D97706', label: 'Âmbar' },
  { value: '#E11D48', label: 'Rosa' },
  { value: '#334155', label: 'Grafite' },
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

const getBillingPeriod = (closingDay: number) => {
  const today = new Date();
  const d = today.getDate();
  const m = today.getMonth();
  const y = today.getFullYear();
  let start: Date;
  let end: Date;
  if (d >= closingDay) {
    start = new Date(y, m, closingDay);
    end = new Date(y, m + 1, closingDay - 1);
  } else {
    start = new Date(y, m - 1, closingDay);
    end = new Date(y, m, closingDay - 1);
  }
  return { start, end };
};

const toYMD = (d: Date) => d.toISOString().split('T')[0];

// ─── Card Visual ─────────────────────────────────────────────────────────────

const CardVisual = ({ card, total }: { card: CreditCardType; total: number }) => (
  <div className="relative rounded-2xl p-5 text-white overflow-hidden"
    style={{ background: `linear-gradient(135deg, ${card.color}ee, ${card.color}99)` }}>
    <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10"
      style={{ background: 'white', transform: 'translate(30%, -30%)' }} />
    <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-10"
      style={{ background: 'white', transform: 'translate(-30%, 30%)' }} />
    <div className="relative z-10">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-white/70 text-xs font-medium uppercase tracking-wider">Cartão</p>
          <p className="text-white font-bold text-lg mt-0.5">{card.name}</p>
        </div>
        <CreditCard className="w-8 h-8 text-white/60" />
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-white/70 text-xs">Gasto atual</p>
          <p className="text-white font-bold text-2xl">{formatCurrency(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-white/70 text-xs">Fecha dia {card.closing_day}</p>
          <p className="text-white/70 text-xs">Vence dia {card.due_day}</p>
        </div>
      </div>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

interface CreditCardsProps {
  session: Session;
}

const CreditCards = ({ session }: CreditCardsProps) => {
  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [purchases, setPurchases] = useState<CardPurchase[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCardDialog, setShowCardDialog] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardType | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<CardPurchase | null>(null);

  // Card form
  const [cardName, setCardName] = useState('');
  const [cardClosingDay, setCardClosingDay] = useState('25');
  const [cardDueDay, setCardDueDay] = useState('5');
  const [cardColor, setCardColor] = useState('#7C3AED');

  // Purchase form
  const [purchaseDesc, setPurchaseDesc] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseCategory, setPurchaseCategory] = useState('Alimentação');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseInstallments, setPurchaseInstallments] = useState('1');

  // Bill
  const [billDueDate, setBillDueDate] = useState('');

  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark') ||
        localStorage.getItem('theme') === 'dark' ||
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });

  useEffect(() => {
    if (darkMode) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [darkMode]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [{ data: cardsData }, { data: purchasesData }] = await Promise.all([
        supabase.from('credit_cards').select('*').order('created_at'),
        supabase.from('card_purchases').select('*').order('purchase_date', { ascending: false }),
      ]);
      if (cardsData) {
        setCards(cardsData as CreditCardType[]);
        if (cardsData.length > 0 && !selectedCardId) setSelectedCardId((cardsData as CreditCardType[])[0].id);
      }
      if (purchasesData) setPurchases(purchasesData as CardPurchase[]);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const selectedCard = cards.find(c => c.id === selectedCardId) ?? null;
  const cardPurchases = purchases.filter(p => p.card_id === selectedCardId);
  const { start: periodStart, end: periodEnd } = selectedCard
    ? getBillingPeriod(selectedCard.closing_day)
    : { start: new Date(), end: new Date() };
  const currentPeriodPurchases = cardPurchases.filter(p =>
    p.purchase_date >= toYMD(periodStart) && p.purchase_date <= toYMD(periodEnd)
  );
  const currentTotal = currentPeriodPurchases.reduce((s, p) => s + p.amount, 0);
  const totalByCategory = currentPeriodPurchases.reduce((acc, p) => {
    acc[p.category] = (acc[p.category] || 0) + p.amount;
    return acc;
  }, {} as Record<string, number>);
  const cardTotals = cards.reduce((acc, card) => {
    const { start, end } = getBillingPeriod(card.closing_day);
    acc[card.id] = purchases
      .filter(p => p.card_id === card.id && p.purchase_date >= toYMD(start) && p.purchase_date <= toYMD(end))
      .reduce((s, p) => s + p.amount, 0);
    return acc;
  }, {} as Record<string, number>);

  // ── Card CRUD ─────────────────────────────────────────────────────────────

  const openNewCard = () => {
    setEditingCard(null);
    setCardName(''); setCardClosingDay('25'); setCardDueDay('5'); setCardColor('#7C3AED');
    setShowCardDialog(true);
  };

  const openEditCard = (card: CreditCardType) => {
    setEditingCard(card);
    setCardName(card.name); setCardClosingDay(String(card.closing_day));
    setCardDueDay(String(card.due_day)); setCardColor(card.color);
    setShowCardDialog(true);
  };

  const handleSaveCard = async () => {
    if (!cardName.trim()) { toast.error('Nome do cartão é obrigatório'); return; }
    const payload = { user_id: session.user.id, name: cardName.trim(), closing_day: parseInt(cardClosingDay), due_day: parseInt(cardDueDay), color: cardColor };
    if (editingCard) {
      const { error } = await supabase.from('credit_cards').update(payload).eq('id', editingCard.id);
      if (error) { toast.error('Erro ao atualizar cartão'); return; }
      setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, ...payload } : c));
      toast.success('Cartão atualizado!');
    } else {
      const { data, error } = await supabase.from('credit_cards').insert(payload).select().single();
      if (error) { toast.error('Erro ao criar cartão'); return; }
      setCards(prev => [...prev, data as CreditCardType]);
      setSelectedCardId((data as CreditCardType).id);
      toast.success('Cartão criado!');
    }
    setShowCardDialog(false);
  };

  const handleDeleteCard = async (id: string) => {
    if (!confirm('Excluir este cartão e todas as suas compras?')) return;
    const { error } = await supabase.from('credit_cards').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir cartão'); return; }
    setCards(prev => prev.filter(c => c.id !== id));
    setPurchases(prev => prev.filter(p => p.card_id !== id));
    if (selectedCardId === id) setSelectedCardId(cards.find(c => c.id !== id)?.id ?? null);
    toast.success('Cartão excluído!');
  };

  // ── Purchase CRUD ─────────────────────────────────────────────────────────

  const openNewPurchase = () => {
    setEditingPurchase(null);
    setPurchaseDesc(''); setPurchaseAmount(''); setPurchaseCategory('Alimentação');
    setPurchaseDate(new Date().toISOString().split('T')[0]); setPurchaseInstallments('1');
    setShowPurchaseDialog(true);
  };

  const openEditPurchase = (p: CardPurchase) => {
    setEditingPurchase(p);
    setPurchaseDesc(p.description); setPurchaseAmount(String(p.amount));
    setPurchaseCategory(p.category); setPurchaseDate(p.purchase_date);
    setPurchaseInstallments(String(p.installments));
    setShowPurchaseDialog(true);
  };

  const handleSavePurchase = async () => {
    if (!purchaseDesc.trim()) { toast.error('Descrição é obrigatória'); return; }
    const amt = parseFloat(purchaseAmount);
    if (!amt || amt <= 0) { toast.error('Valor deve ser maior que zero'); return; }
    if (!selectedCardId) return;
    const installments = Math.max(1, parseInt(purchaseInstallments) || 1);

    if (editingPurchase) {
      const payload = { description: purchaseDesc.trim(), amount: amt, category: purchaseCategory, purchase_date: purchaseDate, installments, installment_number: editingPurchase.installment_number };
      const { error } = await supabase.from('card_purchases').update(payload).eq('id', editingPurchase.id);
      if (error) { toast.error('Erro ao atualizar compra'); return; }
      setPurchases(prev => prev.map(p => p.id === editingPurchase.id ? { ...p, ...payload } : p));
      toast.success('Compra atualizada!');
    } else {
      const perInstallment = amt / installments;
      const rows = Array.from({ length: installments }, (_, i) => {
        const date = new Date(purchaseDate + 'T12:00:00');
        date.setMonth(date.getMonth() + i);
        return {
          user_id: session.user.id, card_id: selectedCardId,
          description: installments > 1 ? `${purchaseDesc.trim()} (${i + 1}/${installments})` : purchaseDesc.trim(),
          amount: Math.round(perInstallment * 100) / 100,
          category: purchaseCategory, purchase_date: toYMD(date),
          installments, installment_number: i + 1,
        };
      });
      const { data, error } = await supabase.from('card_purchases').insert(rows).select();
      if (error) { toast.error('Erro ao adicionar compra'); return; }
      setPurchases(prev => [...(data as CardPurchase[]), ...prev]);
      toast.success(installments > 1 ? `${installments} parcelas adicionadas!` : 'Compra adicionada!');
    }
    setShowPurchaseDialog(false);
  };

  const handleDeletePurchase = async (id: string) => {
    const { error } = await supabase.from('card_purchases').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir compra'); return; }
    setPurchases(prev => prev.filter(p => p.id !== id));
    toast.success('Compra excluída!');
  };

  // ── Bill ──────────────────────────────────────────────────────────────────

  const openBillDialog = () => {
    if (!selectedCard) return;
    const today = new Date();
    const due = new Date(today.getFullYear(), today.getMonth(), selectedCard.due_day);
    if (due <= today) due.setMonth(due.getMonth() + 1);
    setBillDueDate(toYMD(due));
    setShowBillDialog(true);
  };

  const handleLaunchBill = async () => {
    if (!selectedCard || currentTotal === 0) return;
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('transactions').insert({
      user_id: session.user.id,
      description: `Fatura ${selectedCard.name}`,
      amount: currentTotal, date: billDueDate, created_date: today,
      due_date: billDueDate, paid_date: null,
      category: 'Pagamento de Dívidas', type: 'expense',
      is_paid: false, recurring_group: null,
    });
    if (error) { toast.error('Erro ao lançar fatura'); return; }
    toast.success(`Fatura de ${formatCurrency(currentTotal)} lançada no Dashboard!`);
    setShowBillDialog(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };
  const days = Array.from({ length: 28 }, (_, i) => String(i + 1));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link to="/"><Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="w-4 h-4" /></Button></Link>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
                <LayoutDashboard className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight hidden sm:block">WeekLeaks</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:block">{session.user.email}</span>
            <Button variant="ghost" size="icon" onClick={() => setDarkMode(!darkMode)} className="h-8 w-8 text-slate-400">
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="h-8 w-8 text-slate-400">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Cartões de Crédito</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gerencie suas faturas e compras</p>
          </div>
          <Button onClick={openNewCard} size="sm" className="h-8 bg-violet-600 hover:bg-violet-700 gap-1.5 text-xs rounded-lg">
            <Plus className="w-3.5 h-3.5" /> Novo Cartão
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <CreditCard className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">Nenhum cartão ainda</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1 mb-4">Adicione seu primeiro cartão para começar</p>
            <Button onClick={openNewCard} size="sm" className="bg-violet-600 hover:bg-violet-700 gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Adicionar cartão
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Left panel */}
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                {cards.map(card => (
                  <button key={card.id} onClick={() => setSelectedCardId(card.id)}
                    className={cn(
                      'flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all',
                      selectedCardId === card.id
                        ? 'border-violet-400 dark:border-violet-600 bg-violet-50 dark:bg-violet-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                    )}>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: card.color }} />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{card.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Fecha dia {card.closing_day} · Vence dia {card.due_day}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{formatCurrency(cardTotals[card.id] ?? 0)}</span>
                      <button onClick={(e) => { e.stopPropagation(); openEditCard(card); }} className="text-slate-400 hover:text-slate-600 p-1"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteCard(card.id); }} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </button>
                ))}
              </div>

              {selectedCard && <CardVisual card={selectedCard} total={currentTotal} />}

              {selectedCard && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Fatura atual</p>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    {periodStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} → {periodEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(currentTotal)}</p>
                  <p className="text-xs text-slate-500">{currentPeriodPurchases.length} compra{currentPeriodPurchases.length !== 1 ? 's' : ''} no período</p>
                  <Button onClick={openBillDialog} disabled={currentTotal === 0} className="w-full mt-2 bg-violet-600 hover:bg-violet-700 gap-2 text-sm h-9 rounded-lg">
                    <Receipt className="w-4 h-4" /> Lançar fatura no Dashboard
                  </Button>
                </div>
              )}

              {Object.keys(totalByCategory).length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Por categoria</p>
                  <div className="space-y-2">
                    {Object.entries(totalByCategory).sort((a, b) => b[1] - a[1]).map(([cat, total]) => {
                      const catData = PURCHASE_CATEGORIES.find(c => c.value === cat);
                      return (
                        <div key={cat} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{catData?.emoji ?? '📦'}</span>
                            <span className="text-xs text-slate-600 dark:text-slate-300">{cat}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div className="h-full rounded-full bg-violet-500" style={{ width: `${(total / currentTotal) * 100}%` }} />
                            </div>
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-20 text-right">{formatCurrency(total)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right: purchases */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Compras — fatura atual</h2>
                <Button onClick={openNewPurchase} size="sm" className="h-7 text-xs gap-1 px-3 bg-violet-600 hover:bg-violet-700 rounded-lg">
                  <Plus className="w-3 h-3" /> Adicionar
                </Button>
              </div>

              {currentPeriodPurchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                    <Plus className="w-4 h-4 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma compra nesta fatura</p>
                  <button onClick={openNewPurchase} className="text-xs text-violet-600 dark:text-violet-400 mt-1 hover:underline">Adicionar primeira compra</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentPeriodPurchases.map(p => {
                    const catData = PURCHASE_CATEGORIES.find(c => c.value === p.category);
                    return (
                      <div key={p.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all group">
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center flex-shrink-0 text-lg">
                          {catData?.emoji ?? '📦'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{p.description}</p>
                            {p.installments > 1 && (
                              <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-md flex-shrink-0">
                                {p.installment_number}/{p.installments}x
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.category} · {formatDate(p.purchase_date)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <p className="text-sm font-bold text-rose-600 dark:text-rose-400">−{formatCurrency(p.amount)}</p>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditPurchase(p)} className="h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => handleDeletePurchase(p.id)} className="h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {cardPurchases.filter(p => p.purchase_date < toYMD(periodStart)).length > 0 && (
                <details className="mt-4">
                  <summary className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-600 dark:hover:text-slate-400 select-none">
                    Faturas anteriores ({cardPurchases.filter(p => p.purchase_date < toYMD(periodStart)).length} compras)
                  </summary>
                  <div className="space-y-2 mt-3">
                    {cardPurchases.filter(p => p.purchase_date < toYMD(periodStart)).map(p => {
                      const catData = PURCHASE_CATEGORIES.find(c => c.value === p.category);
                      return (
                        <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 opacity-60 group hover:opacity-100 transition-opacity">
                          <span className="text-base">{catData?.emoji ?? '📦'}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{p.description}</p>
                            <p className="text-xs text-slate-400">{p.category} · {formatDate(p.purchase_date)}</p>
                          </div>
                          <p className="text-sm font-medium text-rose-500 flex-shrink-0">−{formatCurrency(p.amount)}</p>
                          <button onClick={() => handleDeletePurchase(p.id)} className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Card Dialog */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        {showCardDialog && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowCardDialog(false)} />}
        <DialogContent className="sm:max-w-[380px] z-50">
          <DialogHeader><DialogTitle>{editingCard ? 'Editar Cartão' : 'Novo Cartão'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>Nome do cartão</Label>
              <Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Ex: Nubank, Itaú..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Dia de fechamento</Label>
                <Select value={cardClosingDay} onValueChange={setCardClosingDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200] max-h-48">
                    {days.map(d => <SelectItem key={d} value={d}>Dia {d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Dia de vencimento</Label>
                <Select value={cardDueDay} onValueChange={setCardDueDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200] max-h-48">
                    {days.map(d => <SelectItem key={d} value={d}>Dia {d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {CARD_COLORS.map(c => (
                  <button key={c.value} onClick={() => setCardColor(c.value)}
                    className={cn('w-8 h-8 rounded-full transition-all', cardColor === c.value && 'ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100')}
                    style={{ background: c.value }} title={c.label} />
                ))}
              </div>
            </div>
            <Button onClick={handleSaveCard} className="w-full bg-violet-600 hover:bg-violet-700">
              {editingCard ? 'Salvar alterações' : 'Criar cartão'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Purchase Dialog */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        {showPurchaseDialog && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowPurchaseDialog(false)} />}
        <DialogContent className="sm:max-w-[420px] z-50 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPurchase ? 'Editar Compra' : 'Nova Compra'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">

            <div className="space-y-1.5">
              <Label>Descrição</Label>
              <Input value={purchaseDesc} onChange={e => setPurchaseDesc(e.target.value)} placeholder="Ex: Supermercado Extra" />
            </div>

            <div className="space-y-1.5">
              <Label>Valor total (R$)</Label>
              <Input type="number" step="0.01" min="0.01" value={purchaseAmount} onChange={e => setPurchaseAmount(e.target.value)} placeholder="0.00" />
            </div>

            {/* ✅ Category icon picker */}
            <div className="space-y-2">
              <Label>Categoria</Label>
              <div className="grid grid-cols-4 gap-2">
                {PURCHASE_CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setPurchaseCategory(cat.value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border transition-all',
                      purchaseCategory === cat.value
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40 dark:border-violet-500'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-violet-300 dark:hover:border-violet-700'
                    )}
                  >
                    <span className="text-xl leading-none">{cat.emoji}</span>
                    <span className={cn(
                      'text-xs font-medium leading-tight text-center',
                      purchaseCategory === cat.value
                        ? 'text-violet-700 dark:text-violet-300'
                        : 'text-slate-500 dark:text-slate-400'
                    )}>
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Data da compra</Label>
              <Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
            </div>

            {!editingPurchase && (
              <div className="space-y-1.5">
                <Label>Parcelas</Label>
                <Select value={purchaseInstallments} onValueChange={setPurchaseInstallments}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]">
                    {Array.from({ length: 24 }, (_, i) => String(i + 1)).map(n => (
                      <SelectItem key={n} value={n}>{n === '1' ? 'À vista' : `${n}x`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {parseInt(purchaseInstallments) > 1 && purchaseAmount && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {purchaseInstallments}x de {formatCurrency(parseFloat(purchaseAmount) / parseInt(purchaseInstallments))}
                  </p>
                )}
              </div>
            )}

            <Button onClick={handleSavePurchase} className="w-full bg-violet-600 hover:bg-violet-700">
              {editingPurchase ? 'Salvar' : parseInt(purchaseInstallments) > 1 ? `Parcelar em ${purchaseInstallments}x` : 'Adicionar compra'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bill Dialog */}
      <Dialog open={showBillDialog} onOpenChange={setShowBillDialog}>
        {showBillDialog && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowBillDialog(false)} />}
        <DialogContent className="sm:max-w-[360px] z-50">
          <DialogHeader><DialogTitle>Lançar fatura no Dashboard</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/50 p-4 space-y-1">
              <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">{selectedCard?.name}</p>
              <p className="text-2xl font-bold text-violet-800 dark:text-violet-300">{formatCurrency(currentTotal)}</p>
              <p className="text-xs text-violet-600/70 dark:text-violet-500">{currentPeriodPurchases.length} compras na fatura atual</p>
            </div>
            <div className="space-y-1.5">
              <Label>Data de vencimento</Label>
              <Input type="date" value={billDueDate} onChange={e => setBillDueDate(e.target.value)} />
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Isso criará uma despesa de <strong>{formatCurrency(currentTotal)}</strong> em "Pagamento de Dívidas" no Dashboard.
            </p>
            <Button onClick={handleLaunchBill} className="w-full bg-violet-600 hover:bg-violet-700 gap-2">
              <Check className="w-4 h-4" /> Confirmar e lançar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreditCards;
