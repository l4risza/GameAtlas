import { useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import { useAuth } from '../context/auth-context';
import { accountError, database } from '../services/supabase';
import { loginWithPassword, resendSignup, safeAuthDestination } from '../services/auth';

export default function Login() {
    const { user, loading, error: sessionError } = useAuth();
    const [params] = useSearchParams();
    const requested = params.get('voltar') || '/perfil';
    const destination = safeAuthDestination(requested);
    const navigate = useNavigate();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [confirmationEmail, setConfirmationEmail] = useState('');
    const [message, setMessage] = useState('');
    if (user && !loading) return <Navigate to={destination} replace />;
    async function submit(event) {
        event.preventDefault(); setBusy(true); setError(''); setMessage(''); setConfirmationEmail('');
        const form = new FormData(event.currentTarget);
        try {
            await loginWithPassword(database().auth, {
                email: form.get('email').trim(), password: form.get('senha'),
            });
            navigate(destination, { replace: true });
        } catch (e) {
            setError(accountError(e));
            if (e.code === 'email_not_confirmed') setConfirmationEmail(form.get('email').trim());
        } finally { setBusy(false); }
    }
    async function resend() {
        setBusy(true); setError(''); setMessage('');
        try {
            await resendSignup(database().auth, confirmationEmail, window.location.origin);
            setMessage('Se o cadastro estiver pendente, a confirmação será enviada. Confira também a pasta de spam.');
        } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
    }
    return <AccountLayout title="Entrar"><form className="account-form auth-form" onSubmit={submit}>
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input name="senha" type="password" autoComplete="current-password" required /></label>
        {(error || sessionError) && <p role="alert">{error || sessionError}</p>}
        {message && <p role="status">{message}</p>}
        {confirmationEmail && <button type="button" className="api-button" disabled={busy} onClick={resend}>Reenviar confirmação de e-mail</button>}
        <button className="api-button" disabled={busy || loading}>{busy ? 'Aguarde...' : 'Entrar'}</button>
        <p>Não tem uma conta? <Link to="/cadastro">Cadastre-se</Link></p>
    </form></AccountLayout>;
}
