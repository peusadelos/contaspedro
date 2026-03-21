import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Link, useLocation } from 'react-router-dom';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  LayoutGrid, Receipt as ReceiptNav, TrendingUp, Moon, Sun, Menu,
  LogOut, Plus, CreditCard, Trash2, Pencil, Receipt, Check,
  FileText, History,
} from 'lucide-react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CreditCardType { id: string; name: string; closing_day: number; due_day: number; color: string; }
interface CardPurchase { id: string; card_id: string; description: string; amount: number; category: string; purchase_date: string; installments: number; installment_number: number; }

const CATEGORIES = ['Contas', 'Gastos Pessoais', 'Compras', 'Pagamento de Dívidas', 'Alimentação', 'Transporte', 'Saúde', 'Lazer', 'Outros'];
const CARD_COLORS = [
  { value: '#7C3AED', label: 'Violeta' }, { value: '#0891B2', label: 'Azul' },
  { value: '#059669', label: 'Verde' }, { value: '#D97706', label: 'Âmbar' },
  { value: '#E11D48', label: 'Rosa' }, { value: '#334155', label: 'Grafite' },
];

const fmt = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
const fmtDate = (d: string) => new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

const getBillingPeriod = (closingDay: number) => {
  const today = new Date();
  const d = today.getDate(), m = today.getMonth(), y = today.getFullYear();
  let start: Date, end: Date;
  if (d >= closingDay) { start = new Date(y, m, closingDay); end = new Date(y, m + 1, closingDay - 1); }
  else { start = new Date(y, m - 1, closingDay); end = new Date(y, m, closingDay - 1); }
  return { start, end };
};
const toYMD = (d: Date) => d.toISOString().split('T')[0];

// ─── Card Visual ───────────────────────────────────────────────────────────────
const CardVisual = ({ card, total }: { card: CreditCardType; total: number }) => (
  <div className="relative rounded-2xl p-5 text-white overflow-hidden"
    style={{ background: `linear-gradient(135deg, ${card.color}ee, ${card.color}99)` }}>
    <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(30%,-30%)' }} />
    <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(-30%,30%)' }} />
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
          <p className="text-white font-bold text-2xl">{fmt(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-white/70 text-xs">Fecha dia {card.closing_day}</p>
          <p className="text-white/70 text-xs">Vence dia {card.due_day}</p>
        </div>
      </div>
    </div>
  </div>
);

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
interface CreditCardsProps { session: Session; }

export default function CreditCards({ session }: CreditCardsProps) {
  const location = useLocation();
  const { darkMode, toggleDarkMode } = useDarkMode(); // ✅ shared hook — fixes dark mode

  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [purchases, setPurchases] = useState<CardPurchase[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [showCardDialog, setShowCardDialog] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardType | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<CardPurchase | null>(null);

  const [cardName, setCardName] = useState('');
  const [cardClosingDay, setCardClosingDay] = useState('25');
  const [cardDueDay, setCardDueDay] = useState('5');
  const [cardColor, setCardColor] = useState('#7C3AED');

  const [purchaseDesc, setPurchaseDesc] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseCategory, setPurchaseCategory] = useState('Compras');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseInstallments, setPurchaseInstallments] = useState('1');
  const [billDueDate, setBillDueDate] = useState('');

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [{ data: cardsData }, { data: purchasesData }] = await Promise.all([
        supabase.from('credit_cards').select('*').order('created_at'),
        supabase.from('card_purchases').select('*').order('purchase_date', { ascending: false }),
      ]);
      if (cardsData) { setCards(cardsData as CreditCardType[]); if (cardsData.length > 0 && !selectedCardId) setSelectedCardId(cardsData[0].id); }
      if (purchasesData) setPurchases(purchasesData as CardPurchase[]);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const selectedCard = cards.find(c => c.id === selectedCardId) ?? null;
  const cardPurchases = purchases.filter(p => p.card_id === selectedCardId);
  const { start: periodStart, end: periodEnd } = selectedCard ? getBillingPeriod(selectedCard.closing_day) : { start: new Date(), end: new Date() };
  const currentPeriodPurchases = cardPurchases.filter(p => p.purchase_date >= toYMD(periodStart) && p.purchase_date <= toYMD(periodEnd));
  const currentTotal = currentPeriodPurchases.reduce((s, p) => s + p.amount, 0);
  const totalByCategory = currentPeriodPurchases.reduce((acc, p) => { acc[p.category] = (acc[p.category] || 0) + p.amount; return acc; }, {} as Record<string, number>);
  const cardTotals = cards.reduce((acc, card) => {
    const { start, end } = getBillingPeriod(card.closing_day);
    acc[card.id] = purchases.filter(p => p.card_id === card.id && p.purchase_date >= toYMD(start) && p.purchase_date <= toYMD(end)).reduce((s, p) => s + p.amount, 0);
    return acc;
  }, {} as Record<string, number>);

  const openNewCard = () => { setEditingCard(null); setCardName(''); setCardClosingDay('25'); setCardDueDay('5'); setCardColor('#7C3AED'); setShowCardDialog(true); };
  const openEditCard = (card: CreditCardType) => { setEditingCard(card); setCardName(card.name); setCardClosingDay(String(card.closing_day)); setCardDueDay(String(card.due_day)); setCardColor(card.color); setShowCardDialog(true); };

  const handleSaveCard = async () => {
    if (!cardName.trim()) { toast.error('Nome obrigatório'); return; }
    const payload = { user_id: session.user.id, name: cardName.trim(), closing_day: parseInt(cardClosingDay), due_day: parseInt(cardDueDay), color: cardColor };
    if (editingCard) {
      const { error } = await supabase.from('credit_cards').update(payload).eq('id', editingCard.id);
      if (error) { toast.error('Erro ao atualizar'); return; }
      setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, ...payload } : c));
      toast.success('Cartão atualizado!');
    } else {
      const { data, error } = await supabase.from('credit_cards').insert(payload).select().single();
      if (error) { toast.error('Erro ao criar'); return; }
      setCards(prev => [...prev, data as CreditCardType]);
      setSelectedCardId((data as CreditCardType).id);
      toast.success('Cartão criado!');
    }
    setShowCardDialog(false);
  };

  const handleDeleteCard = async (id: string) => {
    if (!confirm('Excluir este cartão e todas as suas compras?')) return;
    const { error } = await supabase.from('credit_cards').delete().eq('id', id);
    if (error) { toast.error('Erro'); return; }
    setCards(prev => prev.filter(c => c.id !== id));
    setPurchases(prev => prev.filter(p => p.card_id !== id));
    if (selectedCardId === id) setSelectedCardId(cards.find(c => c.id !== id)?.id ?? null);
    toast.success('Cartão excluído!');
  };

  const openNewPurchase = () => { setEditingPurchase(null); setPurchaseDesc(''); setPurchaseAmount(''); setPurchaseCategory('Compras'); setPurchaseDate(new Date().toISOString().split('T')[0]); setPurchaseInstallments('1'); setShowPurchaseDialog(true); };
  const openEditPurchase = (p: CardPurchase) => { setEditingPurchase(p); setPurchaseDesc(p.description); setPurchaseAmount(String(p.amount)); setPurchaseCategory(p.category); setPurchaseDate(p.purchase_date); setPurchaseInstallments(String(p.installments)); setShowPurchaseDialog(true); };

  const handleSavePurchase = async () => {
    if (!purchaseDesc.trim()) { toast.error('Descrição obrigatória'); return; }
    const amt = parseFloat(purchaseAmount);
    if (!amt || amt <= 0) { toast.error('Valor inválido'); return; }
    if (!selectedCardId) return;
    const installments = Math.max(1, parseInt(purchaseInstallments) || 1);
    if (editingPurchase) {
      const payload = { description: purchaseDesc.trim(), amount: amt, category: purchaseCategory, purchase_date: purchaseDate, installments, installment_number: editingPurchase.installment_number };
      const { error } = await supabase.from('card_purchases').update(payload).eq('id', editingPurchase.id);
      if (error) { toast.error('Erro ao atualizar'); return; }
      setPurchases(prev => prev.map(p => p.id === editingPurchase.id ? { ...p, ...payload } : p));
      toast.success('Compra atualizada!');
    } else {
      const perInstallment = amt / installments;
      const rows = Array.from({ length: installments }, (_, i) => {
        const date = new Date(purchaseDate + 'T12:00:00'); date.setMonth(date.getMonth() + i);
        return { user_id: session.user.id, card_id: selectedCardId, description: installments > 1 ? `${purchaseDesc.trim()} (${i + 1}/${installments})` : purchaseDesc.trim(), amount: Math.round(perInstallment * 100) / 100, category: purchaseCategory, purchase_date: toYMD(date), installments, installment_number: i + 1 };
      });
      const { data, error } = await supabase.from('card_purchases').insert(rows).select();
      if (error) { toast.error('Erro ao adicionar'); return; }
      setPurchases(prev => [...(data as CardPurchase[]), ...prev]);
      toast.success(installments > 1 ? `${installments} parcelas adicionadas!` : 'Compra adicionada!');
    }
    setShowPurchaseDialog(false);
  };

  const handleDeletePurchase = async (id: string) => {
    const { error } = await supabase.from('card_purchases').delete().eq('id', id);
    if (error) { toast.error('Erro'); return; }
    setPurchases(prev => prev.filter(p => p.id !== id));
    toast.success('Compra excluída!');
  };

  const openBillDialog = () => {
    if (!selectedCard) return;
    const today = new Date(); const y = today.getFullYear(); const m = today.getMonth();
    const due = new Date(y, m, selectedCard.due_day);
    if (due <= today) due.setMonth(due.getMonth() + 1);
    setBillDueDate(toYMD(due)); setShowBillDialog(true);
  };

  const handleLaunchBill = async () => {
    if (!selectedCard || currentTotal === 0) return;
    const today = new Date().toISOString().split('T')[0];
    const payload = { user_id: session.user.id, description: `Fatura ${selectedCard.name}`, amount: currentTotal, date: billDueDate, created_date: today, due_date: billDueDate, paid_date: null, category: 'Pagamento de Dívidas', type: 'expense', is_paid: false, recurring_group: null };
    const { error } = await supabase.from('transactions').insert(payload);
    if (error) { toast.error('Erro ao lançar fatura'); return; }
    toast.success(`Fatura de ${fmt(currentTotal)} lançada no Dashboard!`);
    setShowBillDialog(false);
  };

  const days = Array.from({ length: 28 }, (_, i) => String(i + 1));

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
            <Button onClick={openNewCard} size="sm" className="h-8 bg-indigo-600 hover:bg-indigo-700 gap-1.5 text-xs rounded-lg px-3">
              <Plus className="w-3.5 h-3.5" /><span className="hidden sm:inline">Novo Cartão</span>
            </Button>
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
                  <DropdownMenuItem asChild><Link to="/historico" className="flex items-center gap-2 cursor-pointer"><History className="w-4 h-4 text-slate-500" /> Histórico</Link></DropdownMenuItem>
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Cartões de Crédito</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Gerencie suas faturas e compras</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin" />
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <CreditCard className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">Nenhum cartão ainda</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1 mb-4">Adicione seu primeiro cartão para começar</p>
            <Button onClick={openNewCard} size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-1.5"><Plus className="w-3.5 h-3.5" /> Adicionar cartão</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Card list + visual */}
            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                {cards.map(card => (
                  <button key={card.id} onClick={() => setSelectedCardId(card.id)}
                    className={cn('flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all',
                      selectedCardId === card.id ? 'border-indigo-400 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-950/30' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700')}>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: card.color }} />
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{card.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Fecha dia {card.closing_day} · Vence dia {card.due_day}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{fmt(cardTotals[card.id] ?? 0)}</span>
                      <button onClick={e => { e.stopPropagation(); openEditCard(card); }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteCard(card.id); }} className="text-slate-400 hover:text-rose-600 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
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
                  <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{fmt(currentTotal)}</p>
                  <p className="text-xs text-slate-500">{currentPeriodPurchases.length} compra{currentPeriodPurchases.length !== 1 ? 's' : ''} no período</p>
                  <Button onClick={openBillDialog} disabled={currentTotal === 0} className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 gap-2 text-sm h-9 rounded-lg">
                    <Receipt className="w-4 h-4" /> Lançar fatura no Dashboard
                  </Button>
                </div>
              )}

              {Object.keys(totalByCategory).length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">Por categoria</p>
                  <div className="space-y-2">
                    {Object.entries(totalByCategory).sort((a, b) => b[1] - a[1]).map(([cat, total]) => (
                      <div key={cat} className="flex items-center justify-between">
                        <span className="text-xs text-slate-600 dark:text-slate-300">{cat}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(total / currentTotal) * 100}%` }} />
                          </div>
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 w-20 text-right">{fmt(total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Purchases */}
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Compras — fatura atual</h2>
                <Button onClick={openNewPurchase} size="sm" className="h-7 text-xs gap-1 px-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg">
                  <Plus className="w-3 h-3" /> Adicionar
                </Button>
              </div>

              {currentPeriodPurchases.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3"><Plus className="w-4 h-4 text-slate-400" /></div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Nenhuma compra nesta fatura</p>
                  <button onClick={openNewPurchase} className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 hover:underline">Adicionar primeira compra</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentPeriodPurchases.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-all group">
                      <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center flex-shrink-0 text-sm">💳</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{p.description}</p>
                          {p.installments > 1 && <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded-md flex-shrink-0">{p.installment_number}/{p.installments}x</span>}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{p.category} · {fmtDate(p.purchase_date)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <p className="text-sm font-bold text-rose-600 dark:text-rose-400">−{fmt(p.amount)}</p>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditPurchase(p)} className="h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil className="w-3 h-3" /></button>
                          <button onClick={() => handleDeletePurchase(p.id)} className="h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"><Trash2 className="w-3 h-3" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {cardPurchases.filter(p => p.purchase_date < toYMD(periodStart)).length > 0 && (
                <details className="mt-4">
                  <summary className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 cursor-pointer hover:text-slate-600 dark:hover:text-slate-400 select-none">
                    Faturas anteriores ({cardPurchases.filter(p => p.purchase_date < toYMD(periodStart)).length} compras)
                  </summary>
                  <div className="space-y-2 mt-3">
                    {cardPurchases.filter(p => p.purchase_date < toYMD(periodStart)).map(p => (
                      <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-800/60 bg-white/50 dark:bg-slate-900/50 opacity-60 group hover:opacity-100 transition-opacity">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{p.description}</p>
                          <p className="text-xs text-slate-400">{p.category} · {fmtDate(p.purchase_date)}</p>
                        </div>
                        <p className="text-sm font-medium text-rose-500 flex-shrink-0">−{fmt(p.amount)}</p>
                        <button onClick={() => handleDeletePurchase(p.id)} className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Bottom Nav (mobile only) ── */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex sm:hidden justify-around items-center px-2 pb-6 pt-3 rounded-t-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl"
        style={{ borderTop: '1px solid rgba(15,23,42,0.06)', boxShadow: '0 -8px 32px rgba(15,23,42,0.07)' }}>
        <BottomNavItem to="/" icon={<LayoutGrid className="w-5 h-5" />} label="Home" />
        <BottomNavItem to="/extrato" icon={<ReceiptNav className="w-5 h-5" />} label="Extrato" />
        <BottomNavItem to="/cartoes" active={location.pathname === '/cartoes'} icon={<CreditCard className="w-5 h-5" />} label="Cartões" />
        <BottomNavItem to="/historico" icon={<TrendingUp className="w-5 h-5" />} label="Histórico" />
        {/* ✅ Tema button — properly aligned using same flex structure */}
        <button onClick={toggleDarkMode}
          className="flex flex-col items-center justify-center px-3 py-2 rounded-2xl gap-0.5 min-w-0 text-slate-500 dark:text-slate-400 transition-colors active:scale-90">
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="text-[10px] font-semibold uppercase tracking-wider leading-none">Tema</span>
        </button>
      </nav>

      {/* ── Dialogs ── */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        {showCardDialog && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowCardDialog(false)} />}
        <DialogContent className="sm:max-w-[380px] z-50">
          <DialogHeader><DialogTitle>{editingCard ? 'Editar Cartão' : 'Novo Cartão'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Nome do cartão</Label><Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Ex: Nubank, Itaú..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Dia de fechamento</Label>
                <Select value={cardClosingDay} onValueChange={setCardClosingDay}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent className="z-[200] max-h-48">{days.map(d => <SelectItem key={d} value={d}>Dia {d}</SelectItem>)}</SelectContent></Select>
              </div>
              <div className="space-y-1.5"><Label>Dia de vencimento</Label>
                <Select value={cardDueDay} onValueChange={setCardDueDay}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent className="z-[200] max-h-48">{days.map(d => <SelectItem key={d} value={d}>Dia {d}</SelectItem>)}</SelectContent></Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Cor</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {CARD_COLORS.map(c => (<button key={c.value} onClick={() => setCardColor(c.value)} className={cn('w-8 h-8 rounded-full transition-all', cardColor === c.value && 'ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100')} style={{ background: c.value }} title={c.label} />))}
              </div>
            </div>
            <Button onClick={handleSaveCard} className="w-full bg-indigo-600 hover:bg-indigo-700">{editingCard ? 'Salvar alterações' : 'Criar cartão'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        {showPurchaseDialog && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowPurchaseDialog(false)} />}
        <DialogContent className="sm:max-w-[380px] z-50">
          <DialogHeader><DialogTitle>{editingPurchase ? 'Editar Compra' : 'Nova Compra'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Descrição</Label><Input value={purchaseDesc} onChange={e => setPurchaseDesc(e.target.value)} placeholder="Ex: Supermercado" /></div>
            <div className="space-y-1.5"><Label>Valor total (R$)</Label><Input type="number" step="0.01" min="0.01" value={purchaseAmount} onChange={e => setPurchaseAmount(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-1.5"><Label>Categoria</Label>
              <Select value={purchaseCategory} onValueChange={setPurchaseCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent className="z-[200]">{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="space-y-1.5"><Label>Data da compra</Label><Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} /></div>
            {!editingPurchase && (
              <div className="space-y-1.5"><Label>Parcelas</Label>
                <Select value={purchaseInstallments} onValueChange={setPurchaseInstallments}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]">{Array.from({ length: 24 }, (_, i) => String(i + 1)).map(n => (<SelectItem key={n} value={n}>{n === '1' ? 'À vista' : `${n}x`}</SelectItem>))}</SelectContent>
                </Select>
                {parseInt(purchaseInstallments) > 1 && purchaseAmount && (<p className="text-xs text-slate-500 dark:text-slate-400">{purchaseInstallments}x de {fmt(parseFloat(purchaseAmount) / parseInt(purchaseInstallments))}</p>)}
              </div>
            )}
            <Button onClick={handleSavePurchase} className="w-full bg-indigo-600 hover:bg-indigo-700">{editingPurchase ? 'Salvar' : parseInt(purchaseInstallments) > 1 ? `Parcelar em ${purchaseInstallments}x` : 'Adicionar compra'}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBillDialog} onOpenChange={setShowBillDialog}>
        {showBillDialog && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowBillDialog(false)} />}
        <DialogContent className="sm:max-w-[360px] z-50">
          <DialogHeader><DialogTitle>Lançar fatura no Dashboard</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="rounded-xl bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 p-4 space-y-1">
              <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{selectedCard?.name}</p>
              <p className="text-2xl font-bold text-indigo-800 dark:text-indigo-300">{fmt(currentTotal)}</p>
              <p className="text-xs text-indigo-600/70 dark:text-indigo-500">{currentPeriodPurchases.length} compras na fatura atual</p>
            </div>
            <div className="space-y-1.5"><Label>Data de vencimento</Label><Input type="date" value={billDueDate} onChange={e => setBillDueDate(e.target.value)} /></div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Isso criará uma despesa de <strong>{fmt(currentTotal)}</strong> na categoria "Pagamento de Dívidas" no seu Dashboard.</p>
            <Button onClick={handleLaunchBill} className="w-full bg-indigo-600 hover:bg-indigo-700 gap-2"><Check className="w-4 h-4" /> Confirmar e lançar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
