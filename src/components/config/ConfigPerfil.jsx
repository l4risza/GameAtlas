import { useCallback, useId, useRef, useState } from 'react';
import ApiFeedback from '../ApiFeedback';
import EditableField from './EditableField';
import { useAccountData } from '../../hooks/useAccountData';
import { PROFILE_EXTRAS_DEFAULTS, discardAvatar, loadSettingsProfile, pruneAvatars, updateProfile, uploadAvatar } from '../../services/settings';
import { BIO_MAX, FAVORITES_MAX, FAVORITE_MAX_LENGTH, NAME_MAX, SOCIALS_MAX, SOCIAL_NETWORKS,
    checkBio, checkDisplayName, checkFavorite, checkSocial, checkUsername } from '../../services/settings-validation';

const ORDER_LABEL = { recentes: 'Mais recentes', antigas: 'Mais antigas' };
const message = (error) => (error instanceof Error ? error.message : 'Não foi possível salvar.');
const safeHref = (url) => (/^https:\/\//i.test(url) ? url : undefined);

function Switch({ checked, onChange, label, disabled }) {
    return <label className="config-switch">
        <span>{label}</span>
        <button type="button" role="switch" aria-checked={checked} className="config-switch__track" disabled={disabled}
            onClick={() => onChange(!checked)}><span className="config-switch__knob"></span></button>
    </label>;
}

function FavoriteGamesEditor({ items, disabled, onChange }) {
    const labelId = useId();
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function change(next, done) {
        setBusy(true); setError('');
        try { await onChange(next); done?.(); } catch (e) { setError(message(e)); } finally { setBusy(false); }
    }
    function add(event) {
        event.preventDefault();
        const checked = checkFavorite(draft, items);
        if (checked.error) { setError(checked.error); return; }
        change([...items, checked.value], () => { setDraft(''); setAdding(false); });
    }
    return <div className="config-row">
        <span className="config-label" id={labelId}>Jogos favoritos:</span>
        <div className="config-field config-field--wrap">
            <ul className="config-pills" aria-labelledby={labelId}>
                {items.map((name) => <li className="config-pill" key={name}>{name}
                    <button type="button" className="config-pill__remove" disabled={disabled || busy} aria-label={`Remover ${name}`}
                        onClick={() => change(items.filter((item) => item !== name))}><i className="bi bi-x" aria-hidden="true"></i></button>
                </li>)}
            </ul>
            {!adding && <button type="button" className="config-add-btn" aria-label="Adicionar jogo favorito"
                disabled={disabled || busy || items.length >= FAVORITES_MAX} onClick={() => { setAdding(true); setError(''); }}>
                <i className="bi bi-plus-lg" aria-hidden="true"></i></button>}
        </div>
        {adding && <form className="config-inline-form" onSubmit={add} noValidate>
            <input className="config-input" value={draft} maxLength={FAVORITE_MAX_LENGTH} placeholder="Nome do jogo"
                aria-label="Nome do jogo favorito" autoFocus onChange={(event) => setDraft(event.target.value)} />
            <button className="config-btn" disabled={busy}>Adicionar</button>
            <button type="button" className="config-btn config-btn--outline" disabled={busy}
                onClick={() => { setAdding(false); setDraft(''); setError(''); }}>Cancelar</button>
        </form>}
        {error && <p className="config-error" role="alert">{error}</p>}
    </div>;
}

function SocialLinksEditor({ items, disabled, onChange }) {
    const labelId = useId();
    const [adding, setAdding] = useState(false);
    const [network, setNetwork] = useState('instagram');
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    async function change(next, done) {
        setBusy(true); setError('');
        try { await onChange(next); done?.(); } catch (e) { setError(message(e)); } finally { setBusy(false); }
    }
    function add(event) {
        event.preventDefault();
        const checked = checkSocial(network, url, items);
        if (checked.error) { setError(checked.error); return; }
        change([...items, checked.value], () => { setUrl(''); setAdding(false); });
    }
    return <div className="config-row">
        <span className="config-label" id={labelId}>Redes sociais:</span>
        <div className="config-field config-field--wrap">
            <ul className="config-pills" aria-labelledby={labelId}>
                {items.map((item) => {
                    const info = SOCIAL_NETWORKS[item.rede];
                    const href = safeHref(item.url);
                    const content = <><i className={`bi ${info?.icon ?? 'bi-link-45deg'}`} aria-hidden="true"></i> {info?.label ?? item.rede}</>;
                    return <li className="config-pill" key={item.rede}>
                        {href ? <a href={href} target="_blank" rel="noopener noreferrer">{content}</a> : <span>{content}</span>}
                        <button type="button" className="config-pill__remove" disabled={disabled || busy}
                            aria-label={`Remover ${info?.label ?? item.rede}`}
                            onClick={() => change(items.filter((other) => other.rede !== item.rede))}><i className="bi bi-x" aria-hidden="true"></i></button>
                    </li>;
                })}
            </ul>
            {!adding && <button type="button" className="config-add-btn" aria-label="Adicionar rede social"
                disabled={disabled || busy || items.length >= SOCIALS_MAX} onClick={() => { setAdding(true); setError(''); }}>
                <i className="bi bi-plus-lg" aria-hidden="true"></i></button>}
        </div>
        {adding && <form className="config-inline-form" onSubmit={add} noValidate>
            <select className="config-input config-input--auto" value={network} aria-label="Rede social"
                onChange={(event) => setNetwork(event.target.value)}>
                {Object.entries(SOCIAL_NETWORKS).map(([key, info]) => <option key={key} value={key}>{info.label}</option>)}
            </select>
            <input className="config-input" value={url} maxLength={190} placeholder="https://..." aria-label="Endereço do perfil"
                autoFocus onChange={(event) => setUrl(event.target.value)} />
            <button className="config-btn" disabled={busy}>Adicionar</button>
            <button type="button" className="config-btn config-btn--outline" disabled={busy}
                onClick={() => { setAdding(false); setUrl(''); setError(''); }}>Cancelar</button>
        </form>}
        {error && <p className="config-error" role="alert">{error}</p>}
    </div>;
}

// Parte visual da aba. Recebe os dados prontos e uma função "onSave(campos)" que devolve uma promessa.
export function ConfigPerfilForm({ userId, values, extrasAvailable, onSave }) {
    const fileRef = useRef(null);
    const [status, setStatus] = useState('');
    const [problem, setProblem] = useState('');
    const [busy, setBusy] = useState(false);
    const extrasOff = !extrasAvailable;

    async function run(task, success) {
        setStatus(''); setProblem(''); setBusy(true);
        try { await task(); setStatus(success); } catch (e) { setProblem(message(e)); } finally { setBusy(false); }
    }
    function chooseAvatar(event) {
        const file = event.target.files?.[0];
        event.target.value = ''; // permite escolher o mesmo arquivo de novo
        if (!file) return;
        run(async () => {
            const { url, path } = await uploadAvatar(userId, file);
            try { await onSave({ avatar_url: url }); } catch (error) { await discardAvatar(path); throw error; }
            await pruneAvatars(userId, path);
        }, 'Foto atualizada.');
    }
    function clearAvatar() {
        run(async () => { await onSave({ avatar_url: null }); await pruneAvatars(userId, null); }, 'Foto removida.');
    }
    const toggleOrder = (key) => run(() => onSave({ [key]: values[key] === 'recentes' ? 'antigas' : 'recentes' }), 'Preferência salva.');
    const savePreference = (fields) => run(() => onSave(fields), 'Preferência salva.');

    return <>
        <h2 className="config-section-title">Foto de perfil:</h2>
        <div className="config-avatar-row">
            <img className="config-avatar" src={values.avatar_url || '/images/perfil.png'} alt="Foto de perfil atual" />
            <div className="config-actions">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={chooseAvatar} />
                <button type="button" className="config-btn" disabled={busy} onClick={() => fileRef.current?.click()}>Escolher</button>
                <button type="button" className="config-btn config-btn--outline" disabled={busy || !values.avatar_url} onClick={clearAvatar}>Sem foto</button>
            </div>
        </div>

        <EditableField label="Nome de exibição:" value={values.nome} maxLength={NAME_MAX} check={checkDisplayName}
            onSave={(value) => onSave({ nome: value })} />
        <EditableField label="Nome de usuário:" value={values.username} maxLength={30} placeholder="Sem nome de usuário"
            check={checkUsername} onSave={(value) => onSave({ username: value })} />

        <hr className="config-divider" />

        <EditableField label="Sobre mim:" value={values.bio} maxLength={BIO_MAX} multiline placeholder="Conte um pouco sobre você"
            check={checkBio} onSave={(value) => onSave({ bio: value })} />
        {extrasOff && <p className="config-hint">Jogos favoritos, redes sociais e preferências do perfil serão liberados quando a atualização
            do banco (arquivo <code>20261014000100_configuracoes.sql</code>) for aplicada.</p>}
        <FavoriteGamesEditor items={values.jogos_favoritos} disabled={extrasOff}
            onChange={(next) => onSave({ jogos_favoritos: next })} />
        <SocialLinksEditor items={values.redes_sociais} disabled={extrasOff}
            onChange={(next) => onSave({ redes_sociais: next })} />

        <hr className="config-divider" />

        <div className="config-row">
            <span className="config-label">Mostrar no perfil:</span>
            <div className="config-prefs">
                <Switch label="Reviews" checked={values.mostrar_reviews} disabled={extrasOff || busy}
                    onChange={(checked) => savePreference({ mostrar_reviews: checked })} />
                <Switch label="Listas" checked={values.mostrar_listas} disabled={extrasOff || busy}
                    onChange={(checked) => savePreference({ mostrar_listas: checked })} />
            </div>
        </div>
        <div className="config-row">
            <span className="config-label">Ordenar:</span>
            <div className="config-prefs">
                <span className="config-order-group">Reviews
                    <button type="button" className="config-order" disabled={extrasOff || busy} onClick={() => toggleOrder('ordem_reviews')}>
                        <i className="bi bi-arrow-left-right" aria-hidden="true"></i> {ORDER_LABEL[values.ordem_reviews]}</button></span>
                <span className="config-order-group">Listas
                    <button type="button" className="config-order" disabled={extrasOff || busy} onClick={() => toggleOrder('ordem_listas')}>
                        <i className="bi bi-arrow-left-right" aria-hidden="true"></i> {ORDER_LABEL[values.ordem_listas]}</button></span>
            </div>
        </div>

        <p className="config-status" role="status">{status}</p>
        {problem && <p className="config-error" role="alert">{problem}</p>}
    </>;
}

export default function ConfigPerfil({ userId }) {
    const load = useCallback(() => loadSettingsProfile(userId), [userId]);
    const { data, loading, error, reload } = useAccountData(`config:${userId}`, load);
    const [overrides, setOverrides] = useState({});
    const save = useCallback(async (fields) => {
        const saved = await updateProfile(userId, fields);
        setOverrides((current) => ({ ...current, ...saved }));
        return saved;
    }, [userId]);
    return <>
        {loading && <p className="config-status" role="status">Carregando suas configurações...</p>}
        <ApiFeedback loading={false} error={error} onRetry={reload} />
        {data && <ConfigPerfilForm userId={userId} extrasAvailable={Boolean(data.extras)} onSave={save}
            values={{ ...PROFILE_EXTRAS_DEFAULTS, ...data.profile, ...data.extras, ...overrides }} />}
    </>;
}
