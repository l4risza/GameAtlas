import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import { useAuth } from '../context/auth-context';
import { accountError, database } from '../services/supabase';
import { requestJson } from '../services/api';
import { loginWithIdentifier, safeAuthDestination } from '../services/auth';
import '../styles/senha.css';

export default function Login() {
    const { user, loading, error: sessionError } = useAuth();
    const [params] = useSearchParams();
    const requested = params.get('voltar') || '/perfil';
    const destination = safeAuthDestination(requested);
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    if (user && !loading) return <Navigate to={destination} replace />;
    async function submit(event) {
        event.preventDefault(); setBusy(true); setError('');
        const form = new FormData(event.currentTarget);
        try {
            await loginWithIdentifier(database().auth, {
                identifier: form.get('identificador'), password: form.get('senha'),
            }, requestJson);
            navigate(destination, { replace: true });
        } catch (e) {
            setError(accountError(e));
        } finally { setBusy(false); }
    }
    return <AccountLayout title="Entrar"><form className="account-form auth-form" onSubmit={submit}>
        <label>E-mail ou nome de usuário<input name="identificador" maxLength={254} autoComplete="username" required /></label>
        <label>Senha<input name="senha" type="password" autoComplete="current-password" required /></label>
        <p className="auth-forgot"><Link to="/esqueci-senha">Esqueci minha senha</Link></p>
        {(error || sessionError) && <p role="alert">{error || sessionError}</p>}
        <button className="api-button" disabled={busy || loading}>{busy ? 'Aguarde...' : 'Entrar'}</button>
        <p>Não tem uma conta? <Link to="/cadastro">Cadastre-se</Link></p>
    </form></AccountLayout>;
}
