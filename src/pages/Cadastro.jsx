import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import { useAuth } from '../context/auth-context';
import { accountError, database } from '../services/supabase';
import { registerWithPassword } from '../services/auth';
import { isUsernameAvailable } from '../services/settings';
import { checkSignupUsername } from '../services/settings-validation';

export default function Cadastro() {
    const { user, loading } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [hint, setHint] = useState('');
    if (user) return <Navigate to="/perfil" replace />;

    // Ao sair do campo, avisa se o nome de usuário está livre.
    async function checkAvailability(event) {
        const checked = checkSignupUsername(event.target.value);
        if (checked.error) { setHint(checked.error); return; }
        const free = await isUsernameAvailable(checked.value);
        setHint(free === false ? 'Esse nome de usuário já está em uso.' : free ? 'Nome de usuário disponível.' : '');
    }
    async function submit(event) {
        event.preventDefault(); setError('');
        const form = new FormData(event.currentTarget);
        if (form.get('senha') !== form.get('confirmar')) { setError('As senhas precisam ser iguais.'); return; }
        const username = checkSignupUsername(form.get('usuario'));
        if (username.error) { setError(username.error); return; }
        setBusy(true);
        try {
            if (await isUsernameAvailable(username.value) === false) { setError('Esse nome de usuário já está em uso. Escolha outro.'); return; }
            await registerWithPassword(database().auth, {
                email: form.get('email').trim(), password: form.get('senha'),
                username: username.value,
            });
        } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
    }
    return <AccountLayout title="Criar conta"><form className="account-form auth-form" onSubmit={submit}>
        <label>Nome de usuário<input name="usuario" maxLength={30} autoComplete="username" onBlur={checkAvailability} required />
            <small role="status">{hint || 'De 3 a 30 letras, números ou sublinhados. Cada nome de usuário é único.'}</small></label>
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input name="senha" type="password" minLength={8} autoComplete="new-password" required />
            <small>Use pelo menos 8 caracteres.</small></label>
        <label>Confirmar senha<input name="confirmar" type="password" minLength={8} autoComplete="new-password" required /></label>
        {error && <p role="alert">{error}</p>}
        <button className="api-button" disabled={busy || loading}>{busy ? 'Aguarde...' : 'Cadastrar'}</button>
        <p>Já tem uma conta? <Link to="/login">Entre</Link></p>
    </form></AccountLayout>;
}
