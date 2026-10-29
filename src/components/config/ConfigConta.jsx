import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/auth-context';
import { checkEmail, checkPasswordChange } from '../../services/settings-validation';
import { changePassword, requestEmailChange, requestPasswordReset, signOutLocal } from '../../services/settings';

const message = (error) => (error instanceof Error ? error.message : 'Não foi possível concluir. Tente novamente.');

function EmailForm({ email, pendingEmail }) {
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [problem, setProblem] = useState('');
    async function submit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        setStatus(''); setProblem('');
        const checked = checkEmail(new FormData(form).get('novo'), email);
        if (checked.error) { setProblem(checked.error); return; }
        setBusy(true);
        try {
            await requestEmailChange(checked.value);
            form.reset();
            setStatus(`Enviamos um link de confirmação para ${checked.value}. A troca só vale depois que você abrir o link
                (pode ser preciso confirmar também no e-mail atual).`);
        } catch (e) { setProblem(message(e)); } finally { setBusy(false); }
    }
    return <section aria-labelledby="config-email-title">
        <h2 className="config-section-title" id="config-email-title">Alterar e-mail</h2>
        <div className="config-row">
            <label className="config-label config-label--light" htmlFor="config-email-atual">E-mail atual:</label>
            <input id="config-email-atual" className="config-input" value={email ?? ''} readOnly />
        </div>
        {pendingEmail && <p className="config-hint">Aguardando confirmação do novo e-mail: {pendingEmail}</p>}
        <form className="config-row" onSubmit={submit} noValidate>
            <label className="config-label config-label--light" htmlFor="config-email-novo">Novo e-mail:</label>
            <div className="config-field">
                <input id="config-email-novo" name="novo" type="email" className="config-input" autoComplete="email" maxLength={254} />
                <button className="config-btn" disabled={busy}>{busy ? 'Enviando...' : 'Confirmar'}</button>
            </div>
        </form>
        {problem && <p className="config-error" role="alert">{problem}</p>}
        {status && <p className="config-status" role="status">{status}</p>}
    </section>;
}

function PasswordForm({ email }) {
    const [busy, setBusy] = useState(false);
    const [sending, setSending] = useState(false);
    const [status, setStatus] = useState('');
    const [problem, setProblem] = useState('');
    async function submit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        setStatus(''); setProblem('');
        const data = new FormData(form);
        const current = String(data.get('atual') ?? '');
        const next = String(data.get('nova') ?? '');
        const checked = checkPasswordChange(current, next);
        if (checked.error) { setProblem(checked.error); return; }
        setBusy(true);
        try { await changePassword(email, current, next); form.reset(); setStatus('Senha alterada com sucesso.'); }
        catch (e) { setProblem(message(e)); } finally { setBusy(false); }
    }
    async function forgot() {
        setStatus(''); setProblem(''); setSending(true);
        try {
            await requestPasswordReset(email);
            setStatus(`Se o envio de e-mails estiver ativo, o link para criar uma nova senha chega em ${email}. Confira também o spam.`);
        } catch (e) { setProblem(message(e)); } finally { setSending(false); }
    }
    return <section aria-labelledby="config-senha-title">
        <h2 className="config-section-title" id="config-senha-title">Alterar senha</h2>
        <form onSubmit={submit} noValidate>
            <div className="config-row">
                <label className="config-label config-label--light" htmlFor="config-senha-atual">Senha atual:</label>
                <input id="config-senha-atual" name="atual" type="password" className="config-input" autoComplete="current-password" />
            </div>
            <div className="config-row">
                <label className="config-label config-label--light" htmlFor="config-senha-nova">Nova senha:</label>
                <div className="config-field">
                    <input id="config-senha-nova" name="nova" type="password" className="config-input" autoComplete="new-password" />
                    <button className="config-btn" disabled={busy}>{busy ? 'Salvando...' : 'Confirmar'}</button>
                </div>
            </div>
            <div className="config-row">
                <span aria-hidden="true"></span>
                <div><button type="button" className="config-link" disabled={busy || sending} onClick={forgot}>
                    {sending ? 'Enviando link...' : 'Esqueci minha senha'}</button></div>
            </div>
        </form>
        {problem && <p className="config-error" role="alert">{problem}</p>}
        {status && <p className="config-status" role="status">{status}</p>}
    </section>;
}

export default function ConfigConta() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [leaving, setLeaving] = useState(false);
    const [problem, setProblem] = useState('');
    async function leave() {
        setLeaving(true); setProblem('');
        try { await signOutLocal(); navigate('/'); } catch (e) { setProblem(message(e)); setLeaving(false); }
    }
    return <>
        <EmailForm email={user?.email} pendingEmail={user?.new_email} />
        <hr className="config-divider" />
        <PasswordForm email={user?.email} />
        <hr className="config-divider" />
        <div className="config-actions">
            <button type="button" className="config-btn" disabled={leaving} onClick={leave}>{leaving ? 'Saindo...' : 'Sair'}</button>
        </div>
        {problem && <p className="config-error" role="alert">{problem}</p>}
        <hr className="config-divider" />
        <div className="config-actions">
            <button type="button" className="config-btn config-btn--outline" disabled title="Em breve">Desativar conta</button>
        </div>
        <p className="config-hint">A desativação de conta ainda não está disponível.</p>
    </>;
}
