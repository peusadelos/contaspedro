import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { LayoutDashboard, ArrowRight } from 'lucide-react';

const Auth = () => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error('Preencha email e senha'); return; }
    if (password.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return; }
    setLoading(true);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error('Email ou senha incorretos');
    } else {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) { toast.error(error.message); }
      else { toast.success('Conta criada! Verifique seu email para confirmar.'); setMode('login'); }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-violet-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">WeekLeaks</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Controle financeiro simples</p>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {mode === 'login' ? 'Entrar na sua conta' : 'Criar nova conta'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-sm rounded-lg border-slate-200 dark:border-slate-700"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Senha
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-9 text-sm rounded-lg border-slate-200 dark:border-slate-700"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full h-9 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 gap-2"
              disabled={loading}
            >
              {loading ? (
                <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Entrar' : 'Criar conta'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </Button>
          </form>

          <div className="text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === 'login' ? (
              <>
                Não tem conta?{' '}
                <button onClick={() => setMode('signup')} className="text-violet-600 font-medium hover:underline">
                  Criar grátis
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button onClick={() => setMode('login')} className="text-violet-600 font-medium hover:underline">
                  Entrar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
