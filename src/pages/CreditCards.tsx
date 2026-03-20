import { useDarkMode } from '@/hooks/useDarkMode';
import { useState, useEffect, useCallback } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  ArrowLeft, LogOut, Moon, Sun, Menu, FileText, History,
  Plus, CreditCard, Trash2, Pencil, Receipt, Check,
  RefreshCw, Layers, X, Lock, Eye, SlidersHorizontal,
  LayoutGrid, TrendingUp, ChevronRight, ShoppingBag,
  Zap, Tv
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  primary:          '#4F46E5',
  primaryDark:      '#3730A3',
  primaryLight:     '#818CF8',
  primaryBg:        '#EEF2FF',
  primaryFixed:     '#E2DFFF',
  tertiary:         '#10B981',
  tertiaryDark:     '#059669',
  tertiaryBg:       '#D1FAE5',
  secondaryContainer: '#D5E0F8',
  surface:          '#F8F9FF',
  surfaceLowest:    '#FFFFFF',
  surfaceLow:       '#EFF4FF',
  surfaceMid:       '#E5EEFF',
  surfaceHigh:      '#DCE9FF',
  onSurface:        '#0B1C30',
  onSurfaceVariant: '#464555',
  neutral:          '#64748B',
  error:            '#EF4444',
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface CreditCardType {
  id: string; name: string; closing_day: number; due_day: number; color: string;
}
interface CardPurchase {
  id: string; card_id: string; description: string; amount: number;
  category: string; purchase_date: string; installments: number;
  installment_number: number; recurring_charge_id?: string | null;
  is_recurring?: boolean; total_installments?: number; installment_group?: string | null;
}
interface RecurringCharge {
  id: string; card_id: string; description: string; amount: number;
  category: string; active: boolean; created_at: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PURCHASE_CATEGORIES = [
  { value: 'Alimentação', emoji: '🍔', label: 'Alimentação' },
  { value: 'Compras',     emoji: '🛍️', label: 'Compras' },
  { value: 'Contas',      emoji: '🏠', label: 'Contas' },
  { value: 'Saúde',       emoji: '❤️', label: 'Saúde' },
  { value: 'Transporte',  emoji: '🚗', label: 'Transporte' },
  { value: 'Lazer',       emoji: '🎮', label: 'Lazer' },
  { value: 'Viagem',      emoji: '✈️', label: 'Viagem' },
  { value: 'Educação',    emoji: '🎓', label: 'Educação' },
  { value: 'Pet',         emoji: '🐾', label: 'Pet' },
  { value: 'Dívidas',     emoji: '💳', label: 'Dívidas' },
  { value: 'Outros',      emoji: '📦', label: 'Outros' },
];

const CARD_COLORS = [
  { value: '#4F46E5', label: 'Índigo' },
  { value: '#3730A3', label: 'Azul escuro' },
  { value: '#059669', label: 'Verde' },
  { value: '#D97706', label: 'Âmbar' },
  { value: '#E11D48', label: 'Rosa' },
  { value: '#334155', label: 'Grafite' },
];

const fmt = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const formatDate = (d: string) =>
  new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

const toYMD = (d: Date) => d.toISOString().split('T')[0];

const getBillingPeriod = (closingDay: number) => {
  const today = new Date();
  const d = today.getDate(), m = today.getMonth(), y = today.getFullYear();
  let start: Date, end: Date;
  if (d >= closingDay) { start = new Date(y, m, closingDay); end = new Date(y, m + 1, closingDay - 1); }
  else { start = new Date(y, m - 1, closingDay); end = new Date(y, m, closingDay - 1); }
  return { start, end };
};

const getClosingDate = (closingDay: number, offset = 0): string => {
  const today = new Date();
  const baseMonth = today.getDate() < closingDay ? today.getMonth() : today.getMonth() + 1;
  return toYMD(new Date(today.getFullYear(), baseMonth + offset, closingDay));
};

// ─── Credit Card Visual ───────────────────────────────────────────────────────
const CardVisual = ({ card, total, variant = 'primary' }: {
  card: CreditCardType; total: number; variant?: 'primary' | 'virtual';
}) => {
  const isPrimary = variant === 'primary';
  const bg = isPrimary
    ? `linear-gradient(135deg, ${card.color} 0%, ${card.color}cc 100%)`
    : `linear-gradient(135deg, #059669 0%, #065f46 100%)`;

  return (
    <div
      className="relative rounded-[1.5rem] p-6 text-white overflow-hidden"
      style={{
        background: bg,
        boxShadow: isPrimary
          ? `0 20px 40px ${card.color}40`
          : '0 16px 32px rgba(5,150,105,0.3)',
        aspectRatio: '1.58 / 1',
      }}
    >
      {/* Decorative contactless icon */}
      <div className="absolute top-0 right-0 p-6 opacity-10">
        <div className="w-16 h-16 rounded-full border-4 border-white" />
      </div>

      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest opacity-80 mb-0.5">
            {isPrimary ? 'Cartão Principal' : 'Virtual'}
          </p>
          <p className="font-bold text-base">{card.name}</p>
        </div>
        <div className="w-10 h-7 rounded bg-yellow-400/80 flex items-center justify-center">
          <div className="w-6 h-4 rounded border border-yellow-600/40" />
        </div>
      </div>

      <p className="text-sm tracking-[0.25em] opacity-90 mb-4 font-mono">
        •••• •••• •••• {Math.floor(Math.random() * 9000 + 1000)}
      </p>

      <div className="flex justify-between items-end">
        <div>
          <p className="text-[10px] uppercase opacity-60 mb-0.5">Titular</p>
          <p className="text-xs font-semibold uppercase tracking-wide">{card.name}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase opacity-60 mb-0.5">Gasto atual</p>
          <p className="text-sm font-bold">{fmt(total)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] opacity-60">Fecha dia {card.closing_day}</p>
          <p className="text-[10px] opacity-60">Vence dia {card.due_day}</p>
        </div>
      </div>
    </div>
  );
};

// ─── Bottom Nav Item ──────────────────────────────────────────────────────────
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

// ─── Main Component ───────────────────────────────────────────────────────────
interface CreditCardsProps { session: Session; }

const CreditCards = ({ session }: CreditCardsProps) => {
  const location = useLocation();
  const [cards, setCards] = useState<CreditCardType[]>([]);
  const [purchases, setPurchases] = useState<CardPurchase[]>([]);
  const [recurringCharges, setRecurringCharges] = useState<RecurringCharge[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'purchases' | 'recurring'>('purchases');

  const [showCardDialog, setShowCardDialog] = useState(false);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [showRecurringDialog, setShowRecurringDialog] = useState(false);
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [editingCard, setEditingCard] = useState<CreditCardType | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<CardPurchase | null>(null);
  const [editingRecurring, setEditingRecurring] = useState<RecurringCharge | null>(null);

  const [purchaseMode, setPurchaseMode] = useState<'single' | 'installment'>('single');
  const [purchaseDesc, setPurchaseDesc] = useState('');
  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [purchaseCategory, setPurchaseCategory] = useState('Alimentação');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseInstallments, setPurchaseInstallments] = useState('2');
  const [recurringDesc, setRecurringDesc] = useState('');
  const [recurringAmount, setRecurringAmount] = useState('');
  const [recurringCategory, setRecurringCategory] = useState('Contas');
  const [cardName, setCardName] = useState('');
  const [cardClosingDay, setCardClosingDay] = useState('25');
  const [cardDueDay, setCardDueDay] = useState('5');
  const [cardColor, setCardColor] = useState('#4F46E5');
  const [billDueDate, setBillDueDate] = useState('');

  const { darkMode, toggleDarkMode } = useDarkMode();

  const syncRecurringCharges = useCallback(async (
    card: CreditCardType, charges: RecurringCharge[], existingPurchases: CardPurchase[]
  ) => {
    const activeCharges = charges.filter(c => c.card_id === card.id && c.active);
    if (!activeCharges.length) return [];
    const closingDate = getClosingDate(card.closing_day, 0);
    const newPurchases: CardPurchase[] = [];
    for (const charge of activeCharges) {
      const exists = existingPurchases.some(p => p.recurring_charge_id === charge.id && p.purchase_date === closingDate);
      if (exists) continue;
      const { data, error } = await supabase.from('card_purchases').insert({
        user_id: session.user.id, card_id: card.id, description: charge.description,
        amount: charge.amount, category: charge.category, purchase_date: closingDate,
        installments: 1, installment_number: 1, recurring_charge_id: charge.id,
        is_recurring: true, total_installments: 1, installment_group: null,
      }).select().single();
      if (!error && data) newPurchases.push(data as CardPurchase);
    }
    return newPurchases;
  }, [session.user.id]);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [{ data: cardsData }, { data: purchasesData }, { data: recurringData }] = await Promise.all([
        supabase.from('credit_cards').select('*').order('created_at'),
        supabase.from('card_purchases').select('*').order('purchase_date', { ascending: false }),
        supabase.from('recurring_charges').select('*').order('created_at'),
      ]);
      const c = (cardsData ?? []) as CreditCardType[];
      const p = (purchasesData ?? []) as CardPurchase[];
      const r = (recurringData ?? []) as RecurringCharge[];
      setCards(c);
      setRecurringCharges(r);
      if (c.length > 0 && !selectedCardId) setSelectedCardId(c[0].id);
      let allPurchases = [...p];
      for (const card of c) {
        const newOnes = await syncRecurringCharges(card, r, allPurchases);
        allPurchases = [...newOnes, ...allPurchases];
      }
      setPurchases(allPurchases);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const selectedCard = cards.find(c => c.id === selectedCardId) ?? null;
  const cardPurchases = purchases.filter(p => p.card_id === selectedCardId);
  const cardRecurring = recurringCharges.filter(r => r.card_id === selectedCardId);
  const { start: periodStart, end: periodEnd } = selectedCard ? getBillingPeriod(selectedCard.closing_day) : { start: new Date(), end: new Date() };
  const currentPeriodPurchases = cardPurchases.filter(p => p.purchase_date >= toYMD(periodStart) && p.purchase_date <= toYMD(periodEnd));
  const currentTotal = currentPeriodPurchases.reduce((s, p) => s + p.amount, 0);
  const totalByCategory = currentPeriodPurchases.reduce((acc, p) => { acc[p.category] = (acc[p.category] || 0) + p.amount; return acc; }, {} as Record<string, number>);
  const cardTotals = cards.reduce((acc, card) => {
    const { start, end } = getBillingPeriod(card.closing_day);
    acc[card.id] = purchases.filter(p => p.card_id === card.id && p.purchase_date >= toYMD(start) && p.purchase_date <= toYMD(end)).reduce((s, p) => s + p.amount, 0);
    return acc;
  }, {} as Record<string, number>);

  // Card CRUD
  const openNewCard = () => { setEditingCard(null); setCardName(''); setCardClosingDay('25'); setCardDueDay('5'); setCardColor('#4F46E5'); setShowCardDialog(true); };
  const openEditCard = (card: CreditCardType) => { setEditingCard(card); setCardName(card.name); setCardClosingDay(String(card.closing_day)); setCardDueDay(String(card.due_day)); setCardColor(card.color); setShowCardDialog(true); };
  const handleSaveCard = async () => {
    if (!cardName.trim()) { toast.error('Nome é obrigatório'); return; }
    const payload = { user_id: session.user.id, name: cardName.trim(), closing_day: parseInt(cardClosingDay), due_day: parseInt(cardDueDay), color: cardColor };
    if (editingCard) {
      const { error } = await supabase.from('credit_cards').update(payload).eq('id', editingCard.id);
      if (error) { toast.error('Erro'); return; }
      setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, ...payload } : c));
      toast.success('Cartão atualizado!');
    } else {
      const { data, error } = await supabase.from('credit_cards').insert(payload).select().single();
      if (error) { toast.error('Erro'); return; }
      setCards(prev => [...prev, data as CreditCardType]);
      setSelectedCardId((data as CreditCardType).id);
      toast.success('Cartão criado!');
    }
    setShowCardDialog(false);
  };
  const handleDeleteCard = async (id: string) => {
    if (!confirm('Excluir este cartão?')) return;
    await supabase.from('credit_cards').delete().eq('id', id);
    setCards(prev => prev.filter(c => c.id !== id));
    setPurchases(prev => prev.filter(p => p.card_id !== id));
    setRecurringCharges(prev => prev.filter(r => r.card_id !== id));
    if (selectedCardId === id) setSelectedCardId(cards.find(c => c.id !== id)?.id ?? null);
    toast.success('Cartão excluído!');
  };

  // Purchase CRUD
  const openNewPurchase = () => { setEditingPurchase(null); setPurchaseMode('single'); setPurchaseDesc(''); setPurchaseAmount(''); setPurchaseCategory('Alimentação'); setPurchaseDate(new Date().toISOString().split('T')[0]); setPurchaseInstallments('2'); setShowPurchaseDialog(true); };
  const openEditPurchase = (p: CardPurchase) => { setEditingPurchase(p); setPurchaseMode('single'); setPurchaseDesc(p.description); setPurchaseAmount(String(p.amount)); setPurchaseCategory(p.category); setPurchaseDate(p.purchase_date); setShowPurchaseDialog(true); };
  const handleSavePurchase = async () => {
    if (!purchaseDesc.trim()) { toast.error('Descrição é obrigatória'); return; }
    const amt = parseFloat(purchaseAmount);
    if (!amt || amt <= 0) { toast.error('Valor inválido'); return; }
    if (!selectedCardId || !selectedCard) return;
    if (editingPurchase) {
      const payload = { description: purchaseDesc.trim(), amount: amt, category: purchaseCategory, purchase_date: purchaseDate };
      const { error } = await supabase.from('card_purchases').update(payload).eq('id', editingPurchase.id);
      if (error) { toast.error('Erro'); return; }
      setPurchases(prev => prev.map(p => p.id === editingPurchase.id ? { ...p, ...payload } : p));
      toast.success('Compra atualizada!');
    } else if (purchaseMode === 'installment') {
      const n = Math.max(2, Math.min(48, parseInt(purchaseInstallments) || 2));
      const per = Math.round((amt / n) * 100) / 100;
      const group = `inst_${Date.now()}`;
      const rows = Array.from({ length: n }, (_, i) => ({
        user_id: session.user.id, card_id: selectedCardId,
        description: `${purchaseDesc.trim()} (${i + 1}/${n})`,
        amount: per, category: purchaseCategory,
        purchase_date: getClosingDate(selectedCard.closing_day, i),
        installments: n, installment_number: i + 1,
        recurring_charge_id: null, is_recurring: false, total_installments: n, installment_group: group,
      }));
      const { data, error } = await supabase.from('card_purchases').insert(rows).select();
      if (error) { toast.error('Erro'); return; }
      setPurchases(prev => [...(data as CardPurchase[]), ...prev]);
      toast.success(`${n}x de ${fmt(per)} adicionadas!`);
    } else {
      const { data, error } = await supabase.from('card_purchases').insert({
        user_id: session.user.id, card_id: selectedCardId, description: purchaseDesc.trim(),
        amount: amt, category: purchaseCategory, purchase_date: purchaseDate,
        installments: 1, installment_number: 1, recurring_charge_id: null,
        is_recurring: false, total_installments: 1, installment_group: null,
      }).select().single();
      if (error) { toast.error('Erro'); return; }
      setPurchases(prev => [data as CardPurchase, ...prev]);
      toast.success('Compra adicionada!');
    }
    setShowPurchaseDialog(false);
  };
  const handleDeletePurchase = async (purchase: CardPurchase) => {
    if (purchase.installment_group && !purchase.is_recurring) {
      const deleteAll = confirm('Excluir TODAS as parcelas? (Cancelar = só esta)');
      if (deleteAll) {
        await supabase.from('card_purchases').delete().eq('installment_group', purchase.installment_group);
        setPurchases(prev => prev.filter(p => p.installment_group !== purchase.installment_group));
        toast.success('Parcelas excluídas!');
        return;
      }
    }
    await supabase.from('card_purchases').delete().eq('id', purchase.id);
    setPurchases(prev => prev.filter(p => p.id !== purchase.id));
    toast.success('Compra excluída!');
  };

  // Recurring CRUD
  const openNewRecurring = () => { setEditingRecurring(null); setRecurringDesc(''); setRecurringAmount(''); setRecurringCategory('Contas'); setShowRecurringDialog(true); };
  const openEditRecurring = (r: RecurringCharge) => { setEditingRecurring(r); setRecurringDesc(r.description); setRecurringAmount(String(r.amount)); setRecurringCategory(r.category); setShowRecurringDialog(true); };
  const handleSaveRecurring = async () => {
    if (!recurringDesc.trim()) { toast.error('Descrição é obrigatória'); return; }
    const amt = parseFloat(recurringAmount);
    if (!amt || amt <= 0) { toast.error('Valor inválido'); return; }
    if (!selectedCardId || !selectedCard) return;
    const payload = { user_id: session.user.id, card_id: selectedCardId, description: recurringDesc.trim(), amount: amt, category: recurringCategory, active: true };
    if (editingRecurring) {
      const { error } = await supabase.from('recurring_charges').update(payload).eq('id', editingRecurring.id);
      if (error) { toast.error('Erro'); return; }
      setRecurringCharges(prev => prev.map(r => r.id === editingRecurring.id ? { ...r, ...payload } : r));
      toast.success('Atualizado!');
    } else {
      const { data, error } = await supabase.from('recurring_charges').insert(payload).select().single();
      if (error) { toast.error('Erro'); return; }
      const newCharge = data as RecurringCharge;
      setRecurringCharges(prev => [...prev, newCharge]);
      const closingDate = getClosingDate(selectedCard.closing_day, 0);
      const { data: pd } = await supabase.from('card_purchases').insert({
        user_id: session.user.id, card_id: selectedCardId, description: newCharge.description,
        amount: newCharge.amount, category: newCharge.category, purchase_date: closingDate,
        installments: 1, installment_number: 1, recurring_charge_id: newCharge.id,
        is_recurring: true, total_installments: 1, installment_group: null,
      }).select().single();
      if (pd) setPurchases(prev => [pd as CardPurchase, ...prev]);
      toast.success('Cobrança recorrente criada!');
    }
    setShowRecurringDialog(false);
  };
  const handleCancelRecurring = async (charge: RecurringCharge) => {
    if (!confirm(`Cancelar "${charge.description}"?`)) return;
    await supabase.from('recurring_charges').update({ active: false }).eq('id', charge.id);
    const today = toYMD(new Date());
    await supabase.from('card_purchases').delete().eq('recurring_charge_id', charge.id).gte('purchase_date', today);
    setRecurringCharges(prev => prev.map(r => r.id === charge.id ? { ...r, active: false } : r));
    setPurchases(prev => prev.filter(p => !(p.recurring_charge_id === charge.id && p.purchase_date >= today)));
    toast.success('Cancelado!');
  };
  const handleDeleteRecurring = async (charge: RecurringCharge) => {
    if (!confirm('Excluir cobrança e todos os lançamentos?')) return;
    await supabase.from('recurring_charges').delete().eq('id', charge.id);
    setRecurringCharges(prev => prev.filter(r => r.id !== charge.id));
    setPurchases(prev => prev.filter(p => p.recurring_charge_id !== charge.id));
    toast.success('Excluído!');
  };

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
    const today = toYMD(new Date());
    const { error } = await supabase.from('transactions').insert({
      user_id: session.user.id, description: `Fatura ${selectedCard.name}`,
      amount: currentTotal, date: billDueDate, created_date: today,
      due_date: billDueDate, paid_date: null, category: 'Pagamento de Dívidas',
      type: 'expense', is_paid: false, recurring_group: null,
    });
    if (error) { toast.error('Erro'); return; }
    toast.success(`Fatura de ${fmt(currentTotal)} lançada!`);
    setShowBillDialog(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };
  const days = Array.from({ length: 28 }, (_, i) => String(i + 1));

  return (
    <div className="min-h-screen pb-20 sm:pb-0" style={{ background: C.surface }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 backdrop-blur-md border-b" style={{ background: `${C.surface}CC`, borderColor: `${C.onSurface}10` }}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Link to="/">
              <button className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-slate-100 dark:hover:bg-slate-800" style={{ color: C.onSurfaceVariant }}>
                <ArrowLeft className="w-4 h-4" />
              </button>
            </Link>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` }}>W</div>
            <span className="font-bold text-base hidden sm:block" style={{ color: C.onSurface }}>WeekLeaks</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs hidden md:block" style={{ color: C.neutral }}>{session.user.email}</span>
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
                  <DropdownMenuItem onClick={() => setDarkMode(!darkMode)} className="flex items-center gap-2 cursor-pointer">
                    {darkMode ? <Sun className="w-4 h-4 text-slate-500" /> : <Moon className="w-4 h-4 text-slate-500" />}
                    {darkMode ? 'Modo claro' : 'Modo escuro'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 cursor-pointer text-rose-600 dark:text-rose-400">
                    <LogOut className="w-4 h-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">

        {/* ── Page title ── */}
        <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight" style={{ color: C.onSurface }}>
              Cartões de Crédito
            </h2>
            <p className="mt-1 text-sm" style={{ color: C.onSurfaceVariant }}>
              Gerencie suas faturas, compras e cobranças recorrentes.
            </p>
          </div>
          <button
            onClick={openNewCard}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-95"
            style={{ background: C.primary, boxShadow: '0 20px 40px rgba(11,28,48,0.06)' }}
          >
            <Plus className="w-4 h-4" /> Novo Cartão
          </button>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: C.primary, borderTopColor: 'transparent' }} />
          </div>
        ) : cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-5" style={{ background: C.surfaceLow }}>
              <CreditCard className="w-10 h-10" style={{ color: C.primary }} />
            </div>
            <h3 className="font-bold text-xl mb-2" style={{ color: C.onSurface }}>Nenhum cartão ainda</h3>
            <p className="text-sm mb-6" style={{ color: C.onSurfaceVariant }}>Adicione seu primeiro cartão de crédito</p>
            <button onClick={openNewCard} className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white"
              style={{ background: C.primary }}>
              <Plus className="w-4 h-4" /> Adicionar cartão
            </button>
          </div>
        ) : (
          <>
            {/* ── Bento grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

              {/* Physical Cards — left/main column */}
              <div className="lg:col-span-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold" style={{ color: C.onSurface }}>Seus Cartões</h3>
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest"
                    style={{ background: C.surfaceMid, color: C.primary }}>
                    Ativos ({cards.length})
                  </span>
                </div>

                {/* Card selector + visual */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Card visual */}
                  {selectedCard && (
                    <CardVisual card={selectedCard} total={currentTotal} />
                  )}

                  {/* Card controls */}
                  <div className="rounded-[1.5rem] p-5 space-y-3" style={{ background: C.surfaceLow }}>
                    {/* Card selector tabs */}
                    {cards.length > 1 && (
                      <div className="flex flex-col gap-1.5 mb-4">
                        {cards.map(card => (
                          <button key={card.id}
                            onClick={() => setSelectedCardId(card.id)}
                            className={cn('flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all text-sm',
                              selectedCardId === card.id ? 'font-semibold' : 'opacity-60 hover:opacity-80'
                            )}
                            style={selectedCardId === card.id ? { background: C.surfaceLowest, color: C.primary } : { color: C.onSurface }}
                          >
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: card.color }} />
                            {card.name}
                            <span className="ml-auto text-xs font-medium">{fmt(cardTotals[card.id] ?? 0)}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Lock card */}
                    <div className="flex items-center gap-3 p-3.5 rounded-xl cursor-pointer group transition-colors"
                      style={{ background: C.surfaceLowest }}
                      onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHigh)}
                      onMouseLeave={e => (e.currentTarget.style.background = C.surfaceLowest)}>
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
                        style={{ background: C.primaryFixed }}>
                        <Lock className="w-5 h-5" style={{ color: C.primary }} />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color: C.onSurface }}>Bloquear Cartão</p>
                        <p className="text-xs" style={{ color: C.onSurfaceVariant }}>Desabilitar temporariamente</p>
                      </div>
                      <div className="w-10 h-6 rounded-full relative" style={{ background: '#C7C4D8' }}>
                        <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow-sm" />
                      </div>
                    </div>

                    {/* Edit card */}
                    {selectedCard && (
                      <div onClick={() => openEditCard(selectedCard)}
                        className="flex items-center gap-3 p-3.5 rounded-xl cursor-pointer group transition-colors"
                        style={{ background: C.surfaceLowest }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.surfaceHigh)}
                        onMouseLeave={e => (e.currentTarget.style.background = C.surfaceLowest)}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
                          style={{ background: '#6FFBBE30' }}>
                          <Pencil className="w-5 h-5" style={{ color: C.tertiary }} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm" style={{ color: C.onSurface }}>Editar Cartão</p>
                          <p className="text-xs" style={{ color: C.onSurfaceVariant }}>Nome, datas e cor</p>
                        </div>
                        <ChevronRight className="w-4 h-4" style={{ color: C.onSurfaceVariant }} />
                      </div>
                    )}

                    {/* Delete card */}
                    {selectedCard && (
                      <div onClick={() => handleDeleteCard(selectedCard.id)}
                        className="flex items-center gap-3 p-3.5 rounded-xl cursor-pointer group transition-colors"
                        style={{ background: C.surfaceLowest }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#FEE2E2')}
                        onMouseLeave={e => (e.currentTarget.style.background = C.surfaceLowest)}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
                          style={{ background: '#FEE2E2' }}>
                          <Trash2 className="w-5 h-5" style={{ color: C.error }} />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-sm" style={{ color: C.error }}>Excluir Cartão</p>
                          <p className="text-xs" style={{ color: C.onSurfaceVariant }}>Remove todos os dados</p>
                        </div>
                        <ChevronRight className="w-4 h-4" style={{ color: C.onSurfaceVariant }} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabs: Compras / Recorrentes */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 p-1 rounded-xl flex-1" style={{ background: C.surfaceLow }}>
                      <button onClick={() => setActiveTab('purchases')}
                        className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all',
                          activeTab === 'purchases' ? 'text-white shadow-sm' : 'hover:opacity-70')}
                        style={activeTab === 'purchases' ? { background: C.primary } : { color: C.onSurfaceVariant }}>
                        <Layers className="w-3.5 h-3.5" /> Compras
                      </button>
                      <button onClick={() => setActiveTab('recurring')}
                        className={cn('flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all',
                          activeTab === 'recurring' ? 'text-white shadow-sm' : 'hover:opacity-70')}
                        style={activeTab === 'recurring' ? { background: C.primary } : { color: C.onSurfaceVariant }}>
                        <RefreshCw className="w-3.5 h-3.5" /> Recorrentes
                        {cardRecurring.filter(r => r.active).length > 0 && (
                          <span className="ml-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white"
                            style={{ background: C.tertiary }}>
                            {cardRecurring.filter(r => r.active).length}
                          </span>
                        )}
                      </button>
                    </div>
                    <button
                      onClick={activeTab === 'purchases' ? openNewPurchase : openNewRecurring}
                      className="h-9 px-4 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-all active:scale-95"
                      style={{ background: C.primary }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar
                    </button>
                  </div>

                  {/* Purchases */}
                  {activeTab === 'purchases' && (
                    <div className="rounded-[1.5rem] overflow-hidden" style={{ background: C.surfaceLowest, boxShadow: '0 10px 30px rgba(11,28,48,0.04)' }}>
                      {/* Billing period header */}
                      <div className="px-6 py-4 flex items-center justify-between" style={{ background: C.surfaceLow }}>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: C.onSurfaceVariant }}>
                            Fatura atual
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: C.onSurfaceVariant }}>
                            {periodStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} →{' '}
                            {periodEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-lg" style={{ color: C.onSurface }}>{fmt(currentTotal)}</p>
                          <p className="text-xs" style={{ color: C.onSurfaceVariant }}>{currentPeriodPurchases.length} lançamentos</p>
                        </div>
                      </div>

                      {currentPeriodPurchases.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-sm" style={{ color: C.onSurfaceVariant }}>Nenhuma compra nesta fatura</p>
                          <button onClick={openNewPurchase} className="text-xs font-semibold mt-1" style={{ color: C.primary }}>
                            Adicionar primeira compra
                          </button>
                        </div>
                      ) : (
                        <div>
                          {currentPeriodPurchases.map((p, i) => {
                            const catData = PURCHASE_CATEGORIES.find(c => c.value === p.category);
                            return (
                              <div key={p.id}
                                className="flex items-center justify-between px-6 py-4 cursor-pointer group transition-colors"
                                style={{ borderTop: i > 0 ? `1px solid ${C.surfaceLow}` : 'none' }}
                                onMouseEnter={e => (e.currentTarget.style.background = C.surfaceLow)}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
                                    style={{ background: C.surfaceMid }}>
                                    {catData?.emoji ?? '📦'}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-sm" style={{ color: C.onSurface }}>{p.description}</p>
                                      {p.is_recurring && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: `${C.primary}15`, color: C.primary }}>↺</span>
                                      )}
                                      {p.installment_group && !p.is_recurring && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: `${C.tertiary}15`, color: C.tertiaryDark }}>
                                          {p.installment_number}/{p.total_installments}x
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs" style={{ color: C.onSurfaceVariant }}>
                                      {p.category} · {formatDate(p.purchase_date)}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <p className="font-bold" style={{ color: C.onSurface }}>−{fmt(p.amount)}</p>
                                  {!p.is_recurring && (
                                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button onClick={() => openEditPurchase(p)}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                                        style={{ color: C.neutral }}
                                        onMouseEnter={e => (e.currentTarget.style.background = C.surfaceMid)}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button onClick={() => handleDeletePurchase(p)}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                                        style={{ color: C.error }}
                                        onMouseEnter={e => (e.currentTarget.style.background = '#FEE2E2')}
                                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Past purchases */}
                      {cardPurchases.filter(p => p.purchase_date < toYMD(periodStart)).length > 0 && (
                        <details className="px-6 py-4" style={{ borderTop: `1px solid ${C.surfaceLow}` }}>
                          <summary className="text-xs font-semibold uppercase tracking-widest cursor-pointer select-none" style={{ color: C.onSurfaceVariant }}>
                            Faturas anteriores ({cardPurchases.filter(p => p.purchase_date < toYMD(periodStart)).length})
                          </summary>
                          <div className="mt-3 space-y-2">
                            {cardPurchases.filter(p => p.purchase_date < toYMD(periodStart)).map(p => {
                              const catData = PURCHASE_CATEGORIES.find(c => c.value === p.category);
                              return (
                                <div key={p.id} className="flex items-center justify-between py-2 opacity-50 group hover:opacity-80 transition-opacity">
                                  <div className="flex items-center gap-3">
                                    <span className="text-base">{catData?.emoji ?? '📦'}</span>
                                    <div>
                                      <p className="text-sm" style={{ color: C.onSurface }}>{p.description}</p>
                                      <p className="text-xs" style={{ color: C.onSurfaceVariant }}>{formatDate(p.purchase_date)}</p>
                                    </div>
                                  </div>
                                  <p className="text-sm font-medium" style={{ color: C.onSurface }}>−{fmt(p.amount)}</p>
                                </div>
                              );
                            })}
                          </div>
                        </details>
                      )}
                    </div>
                  )}

                  {/* Recurring */}
                  {activeTab === 'recurring' && (
                    <div className="rounded-[1.5rem] overflow-hidden" style={{ background: C.surfaceLowest, boxShadow: '0 10px 30px rgba(11,28,48,0.04)' }}>
                      {cardRecurring.length === 0 ? (
                        <div className="text-center py-12">
                          <p className="text-sm" style={{ color: C.onSurfaceVariant }}>Nenhuma cobrança recorrente</p>
                          <button onClick={openNewRecurring} className="text-xs font-semibold mt-1" style={{ color: C.primary }}>
                            Adicionar cobrança
                          </button>
                        </div>
                      ) : (
                        <>
                          {cardRecurring.map((r, i) => {
                            const catData = PURCHASE_CATEGORIES.find(c => c.value === r.category);
                            return (
                              <div key={r.id}
                                className="flex items-center justify-between px-6 py-4 group transition-colors"
                                style={{ borderTop: i > 0 ? `1px solid ${C.surfaceLow}` : 'none', opacity: r.active ? 1 : 0.4 }}
                                onMouseEnter={e => (e.currentTarget.style.background = C.surfaceLow)}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl"
                                    style={{ background: `${C.primary}15` }}>
                                    {catData?.emoji ?? '📦'}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-bold text-sm" style={{ color: C.onSurface }}>{r.description}</p>
                                      <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-bold',
                                        r.active ? 'text-emerald-700' : 'text-slate-500')}
                                        style={{ background: r.active ? '#D1FAE5' : C.surfaceLow }}>
                                        {r.active ? '● Ativo' : 'Cancelado'}
                                      </span>
                                    </div>
                                    <p className="text-xs" style={{ color: C.onSurfaceVariant }}>
                                      {r.category} · Todo dia {selectedCard?.closing_day}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <p className="font-bold" style={{ color: C.onSurface }}>−{fmt(r.amount)}</p>
                                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    {r.active && <button onClick={() => openEditRecurring(r)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: C.neutral }}><Pencil className="w-3.5 h-3.5" /></button>}
                                    {r.active && <button onClick={() => handleCancelRecurring(r)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: '#D97706' }}><X className="w-3.5 h-3.5" /></button>}
                                    <button onClick={() => handleDeleteRecurring(r)} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ color: C.error }}><Trash2 className="w-3.5 h-3.5" /></button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {cardRecurring.filter(r => r.active).length > 0 && (
                            <div className="px-6 py-3 flex items-center justify-between" style={{ background: C.surfaceLow }}>
                              <p className="text-xs font-medium" style={{ color: C.onSurfaceVariant }}>Total mensal automático</p>
                              <p className="text-sm font-bold" style={{ color: C.primary }}>
                                {fmt(cardRecurring.filter(r => r.active).reduce((s, r) => s + r.amount, 0))}
                              </p>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right column */}
              <div className="lg:col-span-4 space-y-5">
                <h3 className="text-xl font-bold" style={{ color: C.onSurface }}>Fatura & Resumo</h3>

                {/* Spending widget */}
                <div className="rounded-[1.5rem] p-5 space-y-4" style={{ background: C.surfaceLowest, boxShadow: '0 20px 40px rgba(11,28,48,0.04)' }}>
                  <div className="flex justify-between items-center">
                    <p className="font-bold" style={{ color: C.onSurface }}>Gasto no Período</p>
                    <span className="text-xs font-bold" style={{ color: C.primary }}>
                      {fmt(currentTotal)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 w-full rounded-full overflow-hidden" style={{ background: C.surfaceMid }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: currentTotal > 0 ? '100%' : '0%', background: C.primary }} />
                  </div>

                  {/* Category breakdown */}
                  {Object.keys(totalByCategory).length > 0 && (
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(totalByCategory).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat, total]) => {
                        const catData = PURCHASE_CATEGORIES.find(c => c.value === cat);
                        return (
                          <div key={cat} className="p-3 rounded-xl" style={{ background: C.surfaceLow }}>
                            <p className="text-[10px] uppercase font-bold mb-1" style={{ color: C.onSurfaceVariant }}>
                              {catData?.emoji} {cat.slice(0, 10)}
                            </p>
                            <p className="text-sm font-bold" style={{ color: C.onSurface }}>{fmt(total)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={openBillDialog}
                    disabled={currentTotal === 0}
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-all hover:opacity-90 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white"
                    style={{ background: C.primary }}
                  >
                    <Receipt className="w-4 h-4" /> Lançar Fatura no Dashboard
                  </button>

                  <button
                    className="w-full py-3 rounded-xl font-semibold text-sm transition-colors"
                    style={{ border: `1px solid ${C.onSurface}18`, color: C.onSurface }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.surfaceLow)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    onClick={openNewPurchase}
                  >
                    + Adicionar Compra
                  </button>
                </div>

                {/* Quick stats */}
                <div className="rounded-[1.5rem] p-5 space-y-3" style={{ background: C.surfaceLowest, boxShadow: '0 10px 30px rgba(11,28,48,0.03)' }}>
                  <p className="font-bold text-sm" style={{ color: C.onSurface }}>Recorrentes Ativos</p>
                  {cardRecurring.filter(r => r.active).length === 0 ? (
                    <p className="text-xs" style={{ color: C.onSurfaceVariant }}>Nenhuma cobrança automática</p>
                  ) : (
                    <div className="space-y-2">
                      {cardRecurring.filter(r => r.active).slice(0, 3).map(r => {
                        const catData = PURCHASE_CATEGORIES.find(c => c.value === r.category);
                        return (
                          <div key={r.id} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{catData?.emoji}</span>
                              <span className="text-xs font-medium truncate max-w-[100px]" style={{ color: C.onSurface }}>{r.description}</span>
                            </div>
                            <span className="text-xs font-bold" style={{ color: C.primary }}>−{fmt(r.amount)}</span>
                          </div>
                        );
                      })}
                      <div className="flex items-center justify-between pt-2" style={{ borderTop: `1px solid ${C.surfaceLow}` }}>
                        <span className="text-xs font-medium" style={{ color: C.onSurfaceVariant }}>Total/mês</span>
                        <span className="text-sm font-bold" style={{ color: C.primary }}>
                          {fmt(cardRecurring.filter(r => r.active).reduce((s, r) => s + r.amount, 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Recent Activity (full width) ── */}
            <section className="space-y-4">
              <h3 className="text-xl font-bold" style={{ color: C.onSurface }}>Atividade Recente</h3>
              <div className="rounded-[2rem] overflow-hidden" style={{ background: C.surfaceLowest, boxShadow: '0 10px 30px rgba(11,28,48,0.03)' }}>
                {purchases.slice(0, 6).length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-sm" style={{ color: C.onSurfaceVariant }}>Nenhuma atividade recente</p>
                  </div>
                ) : (
                  purchases.slice(0, 6).map((p, i) => {
                    const catData = PURCHASE_CATEGORIES.find(c => c.value === p.category);
                    const card = cards.find(c => c.id === p.card_id);
                    return (
                      <div key={p.id}
                        className="flex items-center justify-between px-6 py-4 cursor-pointer transition-colors"
                        style={{ borderTop: i > 0 ? `1px solid ${C.surfaceLow}` : 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.background = C.surfaceLow)}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl"
                            style={{ background: C.surfaceMid }}>
                            {catData?.emoji ?? '📦'}
                          </div>
                          <div>
                            <p className="font-bold" style={{ color: C.onSurface }}>{p.description}</p>
                            <p className="text-xs" style={{ color: C.onSurfaceVariant }}>
                              {formatDate(p.purchase_date)} · {card?.name ?? 'Cartão'}
                            </p>
                          </div>
                        </div>
                        <p className="font-bold" style={{ color: C.onSurface }}>−{fmt(p.amount)}</p>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {/* ── Bottom Nav (mobile only) ── */}
      <nav className="fixed bottom-0 left-0 w-full z-50 flex sm:hidden justify-around items-center px-4 pb-6 pt-3 rounded-t-3xl"
        style={{ background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(24px)', borderTop: `1px solid ${C.onSurface}0D`, boxShadow: '0 -8px 32px rgba(15,23,42,0.06)' }}>
        <BottomNavItem to="/" icon={<LayoutGrid className="w-5 h-5" />} label="Home" />
        <BottomNavItem to="/extrato" icon={<Receipt className="w-5 h-5" />} label="Extrato" />
        <BottomNavItem to="/cartoes" active={location.pathname === '/cartoes'} icon={<CreditCard className="w-5 h-5" />} label="Cartões" />
        <BottomNavItem to="/historico" icon={<TrendingUp className="w-5 h-5" />} label="Histórico" />
        <button onClick={() => setDarkMode(!darkMode)}
          className="flex flex-col items-center justify-center px-4 py-2 gap-0.5 transition-colors active:scale-90"
          style={{ color: C.neutral }}>
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="text-[10px] font-semibold uppercase tracking-wider">Tema</span>
        </button>
      </nav>

      {/* ── Card Dialog ── */}
      <Dialog open={showCardDialog} onOpenChange={setShowCardDialog}>
        {showCardDialog && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowCardDialog(false)} />}
        <DialogContent className="sm:max-w-[380px] z-50">
          <DialogHeader><DialogTitle>{editingCard ? 'Editar Cartão' : 'Novo Cartão'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><Label>Nome</Label><Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="Ex: Nubank, Itaú..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Fechamento</Label>
                <Select value={cardClosingDay} onValueChange={setCardClosingDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200] max-h-48">{days.map(d => <SelectItem key={d} value={d}>Dia {d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Vencimento</Label>
                <Select value={cardDueDay} onValueChange={setCardDueDay}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200] max-h-48">{days.map(d => <SelectItem key={d} value={d}>Dia {d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label>Cor</Label>
              <div className="flex gap-2 flex-wrap">
                {CARD_COLORS.map(c => (
                  <button key={c.value} onClick={() => setCardColor(c.value)}
                    className={cn('w-8 h-8 rounded-full transition-all', cardColor === c.value && 'ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100')}
                    style={{ background: c.value }} title={c.label} />
                ))}
              </div>
            </div>
            <Button onClick={handleSaveCard} className="w-full" style={{ background: C.primary }}>
              {editingCard ? 'Salvar' : 'Criar cartão'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Purchase Dialog ── */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        {showPurchaseDialog && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowPurchaseDialog(false)} />}
        <DialogContent className="sm:max-w-[420px] z-50 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingPurchase ? 'Editar Compra' : 'Nova Compra'}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            {!editingPurchase && (
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button onClick={() => setPurchaseMode('single')}
                  className={cn('py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
                    purchaseMode === 'single' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500')}
                  style={purchaseMode === 'single' ? { color: C.primary } : {}}>
                  <Layers className="w-3.5 h-3.5" /> Compra única
                </button>
                <button onClick={() => setPurchaseMode('installment')}
                  className={cn('py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
                    purchaseMode === 'installment' ? 'bg-white dark:bg-slate-700 shadow-sm' : 'text-slate-500')}
                  style={purchaseMode === 'installment' ? { color: C.primary } : {}}>
                  <RefreshCw className="w-3.5 h-3.5" /> Parcelado
                </button>
              </div>
            )}
            <div className="space-y-1.5"><Label>Descrição</Label><Input value={purchaseDesc} onChange={e => setPurchaseDesc(e.target.value)} placeholder="Ex: Supermercado" /></div>
            <div className="space-y-1.5"><Label>Valor {purchaseMode === 'installment' ? 'total' : ''} (R$)</Label><Input type="number" step="0.01" min="0.01" value={purchaseAmount} onChange={e => setPurchaseAmount(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-2"><Label>Categoria</Label>
              <div className="grid grid-cols-4 gap-2">
                {PURCHASE_CATEGORIES.map(cat => (
                  <button key={cat.value} type="button" onClick={() => setPurchaseCategory(cat.value)}
                    className={cn('flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border transition-all',
                      purchaseCategory === cat.value ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900')}>
                    <span className="text-xl leading-none">{cat.emoji}</span>
                    <span className={cn('text-xs font-medium text-center leading-tight',
                      purchaseCategory === cat.value ? 'text-violet-700 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400')}>
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {(purchaseMode === 'single' || editingPurchase) && (
              <div className="space-y-1.5"><Label>Data</Label><Input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} /></div>
            )}
            {purchaseMode === 'installment' && !editingPurchase && (
              <div className="space-y-1.5"><Label>Parcelas</Label>
                <Select value={purchaseInstallments} onValueChange={setPurchaseInstallments}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent className="z-[200]">
                    {Array.from({ length: 47 }, (_, i) => String(i + 2)).map(n => <SelectItem key={n} value={n}>{n}x</SelectItem>)}
                  </SelectContent>
                </Select>
                {purchaseAmount && <p className="text-xs text-slate-500">{purchaseInstallments}x de {fmt(parseFloat(purchaseAmount) / parseInt(purchaseInstallments))}</p>}
              </div>
            )}
            <Button onClick={handleSavePurchase} className="w-full" style={{ background: C.primary }}>
              {editingPurchase ? 'Salvar' : purchaseMode === 'installment' ? `Parcelar em ${purchaseInstallments}x` : 'Adicionar compra'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Recurring Dialog ── */}
      <Dialog open={showRecurringDialog} onOpenChange={setShowRecurringDialog}>
        {showRecurringDialog && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowRecurringDialog(false)} />}
        <DialogContent className="sm:max-w-[420px] z-50 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" style={{ color: C.primary }} />
              {editingRecurring ? 'Editar Recorrente' : 'Nova Cobrança Recorrente'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="rounded-xl p-3 text-sm" style={{ background: C.primaryBg, color: C.primary }}>
              Esta cobrança será adicionada automaticamente todo mês no dia {selectedCard?.closing_day}.
            </div>
            <div className="space-y-1.5"><Label>Descrição</Label><Input value={recurringDesc} onChange={e => setRecurringDesc(e.target.value)} placeholder="Ex: Academia, Netflix..." /></div>
            <div className="space-y-1.5"><Label>Valor mensal (R$)</Label><Input type="number" step="0.01" min="0.01" value={recurringAmount} onChange={e => setRecurringAmount(e.target.value)} placeholder="0.00" /></div>
            <div className="space-y-2"><Label>Categoria</Label>
              <div className="grid grid-cols-4 gap-2">
                {PURCHASE_CATEGORIES.map(cat => (
                  <button key={cat.value} type="button" onClick={() => setRecurringCategory(cat.value)}
                    className={cn('flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl border transition-all',
                      recurringCategory === cat.value ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/40' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900')}>
                    <span className="text-xl leading-none">{cat.emoji}</span>
                    <span className={cn('text-xs font-medium text-center leading-tight',
                      recurringCategory === cat.value ? 'text-violet-700 dark:text-violet-300' : 'text-slate-500 dark:text-slate-400')}>
                      {cat.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleSaveRecurring} className="w-full gap-2" style={{ background: C.primary }}>
              <RefreshCw className="w-4 h-4" /> {editingRecurring ? 'Salvar' : 'Ativar cobrança'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bill Dialog ── */}
      <Dialog open={showBillDialog} onOpenChange={setShowBillDialog}>
        {showBillDialog && <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowBillDialog(false)} />}
        <DialogContent className="sm:max-w-[360px] z-50">
          <DialogHeader><DialogTitle>Lançar Fatura no Dashboard</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="rounded-xl p-4 space-y-1" style={{ background: C.primaryBg }}>
              <p className="text-xs font-semibold" style={{ color: C.primary }}>{selectedCard?.name}</p>
              <p className="text-2xl font-bold" style={{ color: C.primaryDark }}>{fmt(currentTotal)}</p>
              <p className="text-xs" style={{ color: C.primary }}>{currentPeriodPurchases.length} lançamentos na fatura atual</p>
            </div>
            <div className="space-y-1.5"><Label>Data de vencimento</Label><Input type="date" value={billDueDate} onChange={e => setBillDueDate(e.target.value)} /></div>
            <p className="text-xs" style={{ color: C.onSurfaceVariant }}>
              Cria uma despesa de <strong>{fmt(currentTotal)}</strong> em "Pagamento de Dívidas" no Dashboard.
            </p>
            <Button onClick={handleLaunchBill} className="w-full gap-2 text-white" style={{ background: C.primary }}>
              <Check className="w-4 h-4" /> Confirmar e lançar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreditCards;
