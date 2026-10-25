import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import { useAuth } from '../context/auth-context';
import { accountError, database } from '../services/supabase';
import { registerWithPassword } from '../services/auth';

export default function Cadastro() {
    const { user, loading } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    if (user) return <Navigate to="/perfil" replace />;
    async function submit(event) {
        event.preventDefault(); setError('');
        const form = new FormData(event.currentTarget);
        if (form.get('senha') !== form.get('confirmar')) { setError('As senhas precisam ser iguais.'); return; }
        const nome = form.get('nome').trim();
        if (!nome) { setError('Preencha seu nome de exibição.'); return; }
        setBusy(true);
        try {
            await registerWithPassword(database().auth, {
                email: form.get('email').trim(), password: form.get('senha'),
                name: nome,
            });
        } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
    }
    return <AccountLayout title="Criar conta"><form className="account-form auth-form" onSubmit={submit}>
        <label>Nome de exibição<input name="nome" maxLength={100} autoComplete="name" required /></label>
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input name="senha" type="password" minLength={8} autoComplete="new-password" required />
            <small>Use pelo menos 8 caracteres.</small></label>
        <label>Confirmar senha<input name="confirmar" type="password" minLength={8} autoComplete="new-password" required /></label>
        {error && <p role="alert">{error}</p>}
        <button className="api-button" disabled={busy || loading}>{busy ? 'Aguarde...' : 'Cadastrar'}</button>
        <p>Já tem uma conta? <Link to="/login">Entre</Link></p>
    </form></AccountLayout>;
}
