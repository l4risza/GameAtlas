import { useState } from 'react';
import { Link } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import { requestPasswordReset } from '../services/settings';
import { checkEmail } from '../services/settings-validation';
import '../styles/senha.css';

// Pede o e-mail e envia o link de redefinição. A resposta é a mesma exista ou não uma conta com esse
// e-mail (não revela quem é cadastrado).
export default function EsqueciSenha() {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [sentTo, setSentTo] = useState('');

    async function submit(event) {
        event.preventDefault();
        setError('');
        const checked = checkEmail(new FormData(event.currentTarget).get('email'));
        if (checked.error) { setError(checked.error); return; }
        setBusy(true);
        try { await requestPasswordReset(checked.value); setSentTo(checked.value); }
        catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir. Tente novamente.'); }
        finally { setBusy(false); }
    }

    return <AccountLayout title="Esqueci minha senha">
        {sentTo ? <div className="account-panel auth-form" role="status">
            <p>Se <strong>{sentTo}</strong> estiver cadastrado, enviamos um link para criar uma nova senha. Confira também a caixa de spam.</p>
            <p><Link to="/login">Voltar ao login</Link></p>
        </div> : <form className="account-form auth-form" onSubmit={submit} noValidate>
            <p>Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.</p>
            <label>E-mail<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>
            {error && <p role="alert">{error}</p>}
            <button className="api-button" disabled={busy}>{busy ? 'Enviando...' : 'Enviar link'}</button>
            <p><Link to="/login">Voltar ao login</Link></p>
        </form>}
    </AccountLayout>;
}
