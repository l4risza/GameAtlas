import { useState } from 'react';
import { Link } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import { useAuth } from '../context/auth-context';
import { resetPassword } from '../services/settings';
import { checkResetPassword } from '../services/settings-validation';
import '../styles/senha.css';

// Página aberta pelo link do e-mail. O Supabase lê o link e cria uma sessão temporária de recuperação;
// com ela já ativa, basta gravar a nova senha. Sem sessão, o link é inválido ou expirou.
export default function RedefinirSenha() {
    const { user, loading } = useAuth();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    async function submit(event) {
        event.preventDefault();
        setError('');
        const data = new FormData(event.currentTarget);
        const next = String(data.get('nova') ?? '');
        const checked = checkResetPassword(next, String(data.get('confirmar') ?? ''));
        if (checked.error) { setError(checked.error); return; }
        setBusy(true);
        try { await resetPassword(next); setDone(true); }
        catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir. Tente novamente.'); }
        finally { setBusy(false); }
    }

    let content;
    if (loading) content = <p role="status">Verificando o link...</p>;
    else if (!user) content = <div className="account-panel auth-form">
        <p role="alert">Este link é inválido ou expirou.</p>
        <p><Link to="/esqueci-senha">Pedir um novo link</Link></p>
    </div>;
    else if (done) content = <div className="account-panel auth-form" role="status">
        <p>Senha alterada com sucesso. Você já está conectado.</p>
        <p><Link to="/perfil">Ir para o perfil</Link></p>
    </div>;
    else content = <form className="account-form auth-form" onSubmit={submit} noValidate>
        <label>Nova senha<input name="nova" type="password" minLength={8} autoComplete="new-password" required />
            <small>Use pelo menos 8 caracteres.</small></label>
        <label>Confirmar nova senha<input name="confirmar" type="password" minLength={8} autoComplete="new-password" required /></label>
        {error && <p role="alert">{error}</p>}
        <button className="api-button" disabled={busy}>{busy ? 'Salvando...' : 'Salvar nova senha'}</button>
    </form>;

    return <AccountLayout title="Criar nova senha">{content}</AccountLayout>;
}
