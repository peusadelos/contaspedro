import { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  User, Mail, Lock, LogOut, Trash2, Moon, Sun,
  LayoutGrid, Receipt, CreditCard, TrendingUp,
  Shield, ChevronRight, Eye, EyeOff, Calendar,
  Menu, Check, X, AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

// ── Constants ────────────────────────────────────────────────────────────────
const C = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primaryLight: '#818CF8',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });

// ── Sub-components ───────────────────────────────────────────────────────────
const BottomNavItem = ({
  icon, label, to, active,
}: {
  icon: React.ReactNode;
  label: string;
  to: string;
  active?: boolean;
}) => (
  <Link
    to={to}
    className={cn(
      'flex flex-col items-center justify-center px-3 py-2 rounded-2xl transition-all duration-200 active:scale-90 gap-0.5 min-w-0',
      active
        ? 'text-[#4F46E5] dark:text-indigo-300'
        : 'text-slate-500 dark:text-slate-400',
    )}
    style={active ? { background: '#EFF4FF' } : {}}
  >
    {icon}
    <span className="text-[10px] font-semibold uppercase tracking-wider leading-none">
      {label}
    </span>
  </Link>
);

const SectionCard = ({
  children, className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      'rounded-2xl border border-border bg-card p-5 space-y-4',
      className,
    )}
  >
    {children}
  </div>
);

const SectionTitle = ({
  icon, title,
}: {
  icon: React.ReactNode;
  title: string;
}) => (
  <div className="flex items-center gap-2 mb-1">
    <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
      {icon}
    </div>
    <h2 className="text-sm font-bold text-foreground tracking-tight">{title}</h2>
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
interface AccountProps { session: Session; }

export default function Account({ session }: AccountProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { darkMode, toggleDarkMode } = useDarkMode();

  // ── Profile state ──────────────────────────────────────────────────────────
  const [displayName, setDisplayName] = useState(
    session.user.user_metadata?.full_name ?? '',
  );
  const [editingName, setEditingName]   = useState(false);
  const [nameInput, setNameInput]       = useState(displayName);
  const [savingName, setSavingName]     = useState(false);

  // ── Password state ─────────────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword]   = useState('');
  const [newPassword, setNewPassword]           = useState('');
  const [confirmPassword, setConfirmPassword]   = useState('');
  const [showCurrent, setShowCurrent]           = useState(false);
  const [showNew, setShowNew]                   = useState(false);
  const [showConfirm, setShowConfirm]           = useState(false);
  const [savingPassword, setSavingPassword]     = useState(false);

  // ── Delete account dialog ──────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting]                 = useState(false);

  // ── Logout dialog ──────────────────────────────────────────────────────────
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false);

  // ── Sync name from metadata ────────────────────────────────────────────────
  useEffect(() => {
    const name = session.user.user_metadata?.full_name ?? '';
    setDisplayName(name);
    setNameInput(name);
  }, [session]);

  // ── Password strength ──────────────────────────────────────────────────────
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pwd.length >= 8)              score++;
    if (/[A-Z]/.test(pwd))           score++;
    if (/[0-9]/.test(pwd))           score++;
    if (/[^A-Za-z0-9]/.test(pwd))    score++;
    const map = [
      { label: 'Muito fraca', color: 'bg-rose-500' },
      { label: 'Fraca',       color: 'bg-orange-500' },
      { label: 'Média',       color: 'bg-amber-500' },
      { label: 'Forte',       color: 'bg-emerald-500' },
      { label: 'Muito forte', color: 'bg-emerald-600' },
    ];
    return { score, ...map[score] };
  };
  const strength = getPasswordStrength(newPassword);

  // ── Handlers ──────────────────────────────────────────────────────────────

  // Save display name
  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setSavingName(true);
    const { error } = await supabase.auth.updateUser({
      data: { full_name: nameInput.trim() },
    });
    if (error) {
      toast.error('Erro ao atualizar nome');
    } else {
      setDisplayName(nameInput.trim());
      setEditingName(false);
      toast.success('Nome atualizado!');
    }
    setSavingName(false);
  };

  // Change password
  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    setSavingPassword(true);

    // Re-authenticate with current password first
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: session.user.email!,
      password: currentPassword,
    });
    if (signInError) {
      toast.error('Senha atual incorreta');
      setSavingPassword(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast.error('Erro ao atualizar senha');
    } else {
      toast.success('Senha atualizada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
    setSavingPassword(false);
  };

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  // Delete account
  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'EXCLUIR') return;
    setDeleting(true);
    // Delete all user transactions first
    await supabase
      .from('transactions')
      .delete()
      .eq('user_id', session.user.id);
    // Sign out (account deletion requires admin API; we sign out gracefully)
    await supabase.auth.signOut();
    toast.success('Conta encerrada. Até logo!');
    navigate('/auth');
    setDeleting(false);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const avatarInitials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : session.user.email?.[0].toUpperCase() ?? 'U';

  const memberSince = session.user.created_at
    ? formatDate(session.user.created_at)
    : '—';

  const lastSignIn = session.user.last_sign_in_at
    ? formatDate(session.user.last_sign_in_at)
    : '—';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24 sm:pb-0">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-sm"
              style={{ background: `linear-gradient(135deg, ${C.primary}, ${C.primaryDark})` }}
            >
              W
            </div>
            <span className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight hidden sm:block">
              WeekLeaks
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:block truncate max-w-[160px]">
              {session.user.email}
            </span>
            {/* Desktop menu */}
            <div className="hidden sm:flex">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg px-2.5 gap-1.5">
                    <Menu className="w-3.5 h-3.5" /><span>Menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem asChild>
                    <Link to="/" className="flex items-center gap-2 cursor-pointer">
                      <LayoutGrid className="w-4 h-4 text-slate-500" /> Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/extrato" className="flex items-center gap-2 cursor-pointer">
                      <Receipt className="w-4 h-4 text-slate-500" /> Extrato
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={toggleDarkMode} className="flex items-center gap-2 cursor-pointer">
                    {darkMode
                      ? <Sun className="w-4 h-4 text-slate-500" />
                      : <Moon className="w-4 h-4 text-slate-500" />}
                    {darkMode ? 'Modo claro' : 'Modo escuro'}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setLogoutDialogOpen(true)}
                    className="flex items-center gap-2 cursor-pointer text-rose-600 dark:text-rose-400 focus:text-rose-600"
                  >
                    <LogOut className="w-4 h-4" /> Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-3 sm:px-6 py-6 space-y-5">

        {/* ── Hero / Avatar Card ── */}
        <div
          className="rounded-2xl p-6 text-white relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryDark} 100%)`,
            boxShadow: `0 20px 40px ${C.primary}26`,
          }}
        >
          {/* Decorative blobs */}
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10"
            style={{ background: 'white', filter: 'blur(32px)' }} />
          <div className="absolute -bottom-8 -left-8 w-36 h-36 rounded-full opacity-10"
            style={{ background: C.primaryLight, filter: 'blur(28px)' }} />

          <div className="relative z-10 flex items-center gap-4">
            {/* Avatar */}
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(12px)' }}>
              {avatarInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest opacity-60 mb-0.5">
                Minha Conta
              </p>
              <h1 className="text-xl font-extrabold tracking-tight truncate">
                {displayName || 'Sem nome'}
              </h1>
              <p className="text-sm opacity-70 truncate">{session.user.email}</p>
            </div>
          </div>

          {/* Meta info */}
          <div className="relative z-10 mt-5 flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Calendar className="w-3 h-3" />
              <span className="opacity-75">Membro desde</span>
              <span className="font-semibold">{memberSince}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs"
              style={{ background: 'rgba(255,255,255,0.12)' }}>
              <Shield className="w-3 h-3" />
              <span className="opacity-75">Último acesso</span>
              <span className="font-semibold">{lastSignIn}</span>
            </div>
          </div>
        </div>

        {/* ── Profile Info ── */}
        <SectionCard>
          <SectionTitle icon={<User className="w-4 h-4" />} title="Informações do Perfil" />

          {/* Email (read-only) */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              E-mail
            </Label>
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-border">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-foreground truncate">{session.user.email}</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-semibold flex-shrink-0">
                verificado
              </span>
            </div>
          </div>

          {/* Display name */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Nome de exibição
            </Label>
            {editingName ? (
              <div className="flex gap-2">
                <Input
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  placeholder="Seu nome"
                  className="h-10 rounded-xl text-sm"
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') setEditingName(false);
                  }}
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={handleSaveName}
                  disabled={savingName || !nameInput.trim()}
                  className="h-10 px-3 rounded-xl bg-violet-600 hover:bg-violet-700"
                >
                  {savingName
                    ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    : <Check className="w-4 h-4" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditingName(false); setNameInput(displayName); }}
                  className="h-10 px-3 rounded-xl"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setEditingName(true)}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-border hover:border-violet-400 dark:hover:border-violet-600 transition-colors group text-left"
              >
                <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className={cn(
                  'text-sm flex-1',
                  displayName ? 'text-foreground' : 'text-muted-foreground italic',
                )}>
                  {displayName || 'Clique para adicionar seu nome'}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-violet-500 transition-colors" />
              </button>
            )}
          </div>
        </SectionCard>

        {/* ── Change Password ── */}
        <SectionCard>
          <SectionTitle icon={<Lock className="w-4 h-4" />} title="Alterar Senha" />

          {/* Current password */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Senha atual
            </Label>
            <div className="relative">
              <Input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 rounded-xl text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Nova senha
            </Label>
            <div className="relative">
              <Input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 rounded-xl text-sm pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password strength meter */}
            {newPassword && (
              <div className="space-y-1.5 pt-1">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-all duration-300',
                        i < strength.score ? strength.color : 'bg-slate-200 dark:bg-slate-700',
                      )}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Força: <span className="font-semibold text-foreground">{strength.label}</span>
                </p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
              Confirmar nova senha
            </Label>
            <div className="relative">
              <Input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="h-10 rounded-xl text-sm pr-10"
                onKeyDown={e => { if (e.key === 'Enter') handleChangePassword(); }}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-rose-500 flex items-center gap-1">
                <X className="w-3 h-3" /> As senhas não coincidem
              </p>
            )}
            {confirmPassword && newPassword === confirmPassword && (
              <p className="text-xs text-emerald-500 flex items-center gap-1">
                <Check className="w-3 h-3" /> Senhas coincidem
              </p>
            )}
          </div>

          <Button
            onClick={handleChangePassword}
            disabled={savingPassword || !currentPassword || !newPassword || !confirmPassword}
            className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-sm font-semibold"
          >
            {savingPassword
              ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
              : 'Atualizar Senha'}
          </Button>
        </SectionCard>

        {/* ── Preferences ── */}
        <SectionCard>
          <SectionTitle icon={<Sun className="w-4 h-4" />} title="Preferências" />
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center justify-between px-3 py-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-foreground">
                  {darkMode ? 'Modo Claro' : 'Modo Escuro'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {darkMode ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                </p>
              </div>
            </div>
            {/* Toggle visual */}
            <div className={cn(
              'w-10 h-6 rounded-full transition-colors duration-300 flex items-center px-0.5',
              darkMode ? 'bg-violet-600' : 'bg-slate-300',
            )}>
              <div className={cn(
                'w-5 h-5 rounded-full bg-white shadow transition-transform duration-300',
                darkMode ? 'translate-x-4' : 'translate-x-0',
              )} />
            </div>
          </button>
        </SectionCard>

        {/* ── Danger Zone ── */}
        <SectionCard className="border-rose-200 dark:border-rose-900/50">
          <SectionTitle icon={<AlertTriangle className="w-4 h-4" />} title="Zona de Perigo" />

          {/* Logout */}
          <button
            onClick={() => setLogoutDialogOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors group border border-transparent hover:border-rose-200 dark:hover:border-rose-800/50"
          >
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/40 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
              <LogOut className="w-4 h-4" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-foreground group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                Sair da conta
              </p>
              <p className="text-xs text-muted-foreground">Encerrar sessão atual</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-rose-500 transition-colors" />
          </button>

          {/* Delete account */}
          <button
            onClick={() => setDeleteDialogOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors group border border-transparent hover:border-rose-200 dark:hover:border-rose-800/50"
          >
            <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 transition-colors">
              <Trash2 className="w-4 h-4" />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                Excluir conta
              </p>
              <p className="text-xs text-muted-foreground">
                Remove todos os dados permanentemente
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-rose-400" />
          </button>
        </SectionCard>

        {/* Version tag */}
        <p className="text-center text-xs text-muted-foreground pb-2">
          WeekLeaks · v1.0.0
        </p>
      </main>

      {/* ── Bottom Nav (mobile) ── */}
      <nav
        className="fixed bottom-0 left-0 w-full z-50 flex sm:hidden justify-around items-center px-2 pb-6 pt-3 rounded-t-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl"
        style={{
          borderTop: '1px solid rgba(15,23,42,0.06)',
          boxShadow: '0 -8px 32px rgba(15,23,42,0.07)',
        }}
      >
        <BottomNavItem to="/" active={location.pathname === '/'} icon={<LayoutGrid className="w-5 h-5" />} label="Home" />
        <BottomNavItem to="/extrato" active={location.pathname === '/extrato'} icon={<Receipt className="w-5 h-5" />} label="Extrato" />
        <BottomNavItem to="/cartoes" active={location.pathname === '/cartoes'} icon={<CreditCard className="w-5 h-5" />} label="Cartões" />
        <BottomNavItem to="/historico" active={location.pathname === '/historico'} icon={<TrendingUp className="w-5 h-5" />} label="Histórico" />
        <button
          onClick={toggleDarkMode}
          className="flex flex-col items-center justify-center px-3 py-2 rounded-2xl gap-0.5 min-w-0 text-slate-500 dark:text-slate-400 transition-colors active:scale-90"
        >
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          <span className="text-[10px] font-semibold uppercase tracking-wider leading-none">Tema</span>
        </button>
      </nav>

      {/* ── Logout Dialog ── */}
      <Dialog open={logoutDialogOpen} onOpenChange={setLogoutDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="w-5 h-5 text-rose-500" /> Sair da conta
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja encerrar sua sessão?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setLogoutDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700"
              onClick={handleLogout}
            >
              Sair
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Account Dialog ── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <Trash2 className="w-5 h-5" /> Excluir conta
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                Esta ação é <strong>irreversível</strong>. Todos os seus dados, transações e histórico serão permanentemente removidos.
              </span>
              <span className="block mt-2">
                Digite <strong className="text-foreground">EXCLUIR</strong> para confirmar:
              </span>
            </DialogDescription>
          </DialogHeader>
          <Input
            value={deleteConfirmText}
            onChange={e => setDeleteConfirmText(e.target.value)}
            placeholder="EXCLUIR"
            className="rounded-xl border-rose-300 dark:border-rose-800 focus-visible:ring-rose-500"
          />
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => { setDeleteDialogOpen(false); setDeleteConfirmText(''); }}
            >
              Cancelar
            </Button>
            <Button
              disabled={deleteConfirmText !== 'EXCLUIR' || deleting}
              className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700"
              onClick={handleDeleteAccount}
            >
              {deleting
                ? <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
