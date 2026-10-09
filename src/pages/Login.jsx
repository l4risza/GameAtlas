import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import { useAuth } from '../context/auth-context';
import { accountError, database } from '../services/supabase';

export default function Login() {
    const { user, loading, error: sessionError } = useAuth();
    const [params] = useSearchParams();
    const requested = params.get('voltar') || '/perfil';
    const destination = /^\/(?!\/)/.test(requested) && !requested.includes('\\')
        && !/^\/(login|cadastro)([/?#]|$)/.test(requested) ? requested : '/perfil';
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    if (user && !loading) return <Navigate to={destination} replace />;
    async function submit(event) {
        event.preventDefault(); setBusy(true); setError('');
        const form = new FormData(event.currentTarget);
        try {
            const { error: authError } = await database().auth.signInWithPassword({
                email: form.get('email').trim(), password: form.get('senha'),
            });
            if (authError) throw authError;
            navigate(destination, { replace: true });
        } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
    }
    return <AccountLayout title="Entrar"><form className="account-form auth-form" onSubmit={submit}>
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input name="senha" type="password" autoComplete="current-password" required /></label>
        {(error || sessionError) && <p role="alert">{error || sessionError}</p>}
        <button className="api-button" disabled={busy || loading}>{busy ? 'Entrando...' : 'Entrar'}</button>
        <p>Não tem uma conta? <Link to="/cadastro">Cadastre-se</Link></p>
    </form></AccountLayout>;
}
