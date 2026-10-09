import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import { useAuth } from '../context/auth-context';
import { accountError, database } from '../services/supabase';

export default function Cadastro() {
    const { user } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    if (user) return <Navigate to="/perfil" replace />;
    async function submit(event) {
        event.preventDefault(); setError(''); setMessage('');
        const form = new FormData(event.currentTarget);
        if (form.get('senha') !== form.get('confirmar')) { setError('As senhas precisam ser iguais.'); return; }
        const nome = form.get('nome').trim();
        if (!nome) { setError('Preencha seu nome de exibição.'); return; }
        setBusy(true);
        try {
            const { data, error: authError } = await database().auth.signUp({
                email: form.get('email').trim(), password: form.get('senha'),
                options: { data: { nome }, emailRedirectTo: window.location.origin + '/perfil' },
            });
            if (authError) throw authError;
            if (!data.session) setMessage('Confira seu e-mail para confirmar o cadastro. Se já tiver uma conta, entre com sua senha.');
        } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
    }
    return <AccountLayout title="Criar conta"><form className="account-form auth-form" onSubmit={submit}>
        <label>Nome de exibição<input name="nome" maxLength={100} autoComplete="name" required /></label>
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input name="senha" type="password" minLength={8} autoComplete="new-password" required />
            <small>Use pelo menos 8 caracteres.</small></label>
        <label>Confirmar senha<input name="confirmar" type="password" minLength={8} autoComplete="new-password" required /></label>
        {error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}
        <button className="api-button" disabled={busy}>{busy ? 'Criando conta...' : 'Cadastrar'}</button>
        <p>Já tem uma conta? <Link to="/login">Entre</Link></p>
    </form></AccountLayout>;
}
