import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { useAccountData } from '../hooks/useAccountData';
import { loadGameAccount, loadLists, saveGame, removeSaved, saveReview, deleteReview, addToList } from '../services/account';
import { accountError } from '../services/supabase';
import { Pagination } from './AccountLayout';
import ApiFeedback from './ApiFeedback';
import '../styles/account.css';

/* ---------------- avaliação (aba Reviews do jogo) ---------------- */
function StarInput({ value, onChange }) {
    const [hover, setHover] = useState(0);
    const shown = hover || value;
    return (
        <div className="star-input" role="radiogroup" aria-label="Nota" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((note) => (
                <button
                    key={note}
                    type="button"
                    role="radio"
                    aria-checked={value === note}
                    aria-label={`${note} de 5`}
                    className={note <= shown ? 'on' : ''}
                    onMouseEnter={() => setHover(note)}
                    onClick={() => onChange(note)}
                >
                    <i className={`bi ${note <= shown ? 'bi-star-fill' : 'bi-star'}`} aria-hidden="true"></i>
                </button>
            ))}
            <span>{value ? `${value} / 5` : 'Escolha uma nota'}</span>
        </div>
    );
}

function ReviewForm({ review, busy, onSave, onDelete }) {
    const [rating, setRating] = useState(review?.nota || 0);
    const [text, setText] = useState(review?.texto || '');
    return (
        <form className="review-box-form" onSubmit={(event) => { event.preventDefault(); if (rating) onSave(rating, text); }}>
            <StarInput value={rating} onChange={setRating} />
            <label className="review-box-label">Comentário (opcional)
                <textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={10000} rows={4}
                    placeholder="Conte o que você achou do jogo..." />
            </label>
            <div className="review-box-actions">
                <button className="api-button" disabled={busy || !rating}>{review ? 'Atualizar avaliação' : 'Salvar avaliação'}</button>
                {review && <button className="api-button" type="button" disabled={busy} onClick={onDelete}>Remover avaliação</button>}
            </div>
        </form>
    );
}

function SignedReviewBox({ rawgId, userId }) {
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [actionError, setActionError] = useState('');
    const load = useCallback(() => loadGameAccount(rawgId, userId), [rawgId, userId]);
    const { data, loading, error, reload } = useAccountData(`avaliar:${rawgId}:${userId}`, load);

    async function run(action, message) {
        setBusy(true); setActionError(''); setNotice('');
        try { await action(); setNotice(message); reload(); }
        catch (e) { setActionError(accountError(e)); } finally { setBusy(false); }
    }

    return (
        <section className="review-box">
            <h2>Minha avaliação</h2>
            <ApiFeedback loading={loading} error={error} onRetry={reload} />
            {actionError && <p className="review-box-msg" role="alert">{actionError}</p>}
            {notice && <p className="review-box-msg ok" role="status">{notice}</p>}
            {data && (
                <ReviewForm
                    key={`${data.review?.id}:${data.review?.nota}:${data.review?.texto}`}
                    review={data.review}
                    busy={busy}
                    onSave={(nota, texto) => run(() => saveReview(rawgId, userId, nota, texto, data.review?.id), 'Avaliação salva.')}
                    onDelete={() => run(() => deleteReview(data.review.id, userId), 'Avaliação removida.')}
                />
            )}
            {data?.review && <p className="review-box-link"><Link to={`/reviews/${data.review.id}`}>Ver minha avaliação</Link></p>}
        </section>
    );
}

export function GameReviewBox({ rawgId }) {
    const { user, loading, configured } = useAuth();
    if (!configured) return null;
    if (loading) return <p role="status">Carregando sua conta...</p>;
    if (!user) {
        return (
            <section className="review-box">
                <h2>Minha avaliação</h2>
                <p><Link to={`/login?voltar=${encodeURIComponent(`/reviews?jogo=${rawgId}`)}`}>Entre na sua conta</Link> para avaliar este jogo.</p>
            </section>
        );
    }
    return <SignedReviewBox key={`${rawgId}:${user.id}`} rawgId={rawgId} userId={user.id} />;
}

/* ---------------- listas (página do jogo) ---------------- */
function SignedGameAccount({ game, userId }) {
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [actionError, setActionError] = useState('');
    const [listPage, setListPage] = useState(1);
    const [listId, setListId] = useState('');
    const loadOwnLists = useCallback(() => loadLists(listPage, userId), [listPage, userId]);
    const lists = useAccountData(`escolher-lista:${userId}:${listPage}`, loadOwnLists);

    async function run(action, message) {
        setBusy(true); setActionError(''); setNotice('');
        try { await action(); setNotice(message); }
        catch (e) { setActionError(accountError(e)); } finally { setBusy(false); }
    }

    return (
        <section className="game-account">
            <h2>Adicionar às minhas listas</h2>
            {actionError && <p role="alert">{actionError}</p>}
            {notice && <p role="status">{notice}</p>}
            <ApiFeedback loading={lists.loading} error={lists.error} onRetry={lists.reload} />
            {lists.data?.items.length > 0 && (
                <form className="account-form" onSubmit={(event) => {
                    event.preventDefault(); run(() => addToList(game.id, listId), 'Jogo adicionado à lista.');
                }}>
                    <label>Escolha sua lista
                        <select required value={listId} onChange={(event) => setListId(event.target.value)}>
                            <option value="">Selecione uma lista</option>
                            {lists.data.items.map((list) => (
                                <option key={list.id} value={list.id}>{list.nome} ({list.publica ? 'pública' : 'privada'})</option>
                            ))}
                        </select>
                    </label>
                    <button className="api-button" disabled={busy || !listId}>Adicionar à lista</button>
                </form>
            )}
            {lists.data && !lists.data.items.length && <p>Você ainda não criou nenhuma lista.</p>}
            {lists.data && <Pagination page={listPage} count={lists.data.count} onChange={(page) => { setListPage(page); setListId(''); }} />}
            <p>
                <Link to={`/reviews?jogo=${game.id}`}>Avaliar este jogo</Link> · <Link to="/listas/salvos">Ver meus jogos salvos</Link> · <Link to="/listas?aba=minhas">Gerenciar minhas listas</Link>
            </p>
        </section>
    );
}

/* ---------------- botão de salvar ---------------- */
function SignedSaveButton({ game, userId }) {
    const load = useCallback(() => loadGameAccount(game.id, userId), [game.id, userId]);
    const { data, loading, error, reload } = useAccountData(`salvar:${game.id}:${userId}`, load);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState('');
    async function toggle() {
        if (error) { reload(); return; }
        setBusy(true); setActionError('');
        try {
            if (data.saved) await removeSaved(data.gameId, userId);
            else await saveGame(game.id, userId);
            reload();
        } catch (e) { setActionError(accountError(e)); } finally { setBusy(false); }
    }
    const label = error ? 'Tentar novamente' : data?.saved ? 'Remover dos jogos salvos' : 'Salvar jogo';
    return <div className="save-control"><button type="button" className={`btn-save${data?.saved ? ' saved' : ''}`}
        title={label} aria-label={label} aria-pressed={Boolean(data?.saved)} aria-busy={busy || loading}
        disabled={busy || loading} onClick={toggle}>
        <i className={`bi ${data?.saved ? 'bi-bookmark-fill' : 'bi-bookmark'}`} aria-hidden="true"></i>
    </button>{(error || actionError) && <p className="save-error" role="alert">{actionError || error}</p>}</div>;
}

export function GameSaveButton({ game }) {
    const { user, loading, configured } = useAuth();
    if (loading || !configured) return <button className="btn-save" type="button" disabled aria-label="Salvar jogo"><i className="bi bi-bookmark" aria-hidden="true"></i></button>;
    if (!user) return <Link className="btn-save" title="Entre para salvar este jogo" aria-label="Entre para salvar este jogo"
        to={`/login?voltar=${encodeURIComponent(`/jogo/${game.id}`)}`}><i className="bi bi-bookmark" aria-hidden="true"></i></Link>;
    return <SignedSaveButton key={`${game.id}:${user.id}`} game={game} userId={user.id} />;
}

export default function GameAccount({ game }) {
    const { user, loading, configured } = useAuth();
    if (!configured) return <section className="game-account"><p>A conexão com o banco ainda não está configurada.</p></section>;
    if (loading) return <p role="status">Carregando sua conta...</p>;
    if (!user) return <section className="game-account"><Link to={`/login?voltar=${encodeURIComponent(`/jogo/${game.id}`)}`}>
        Entre na sua conta</Link> para salvar este jogo, avaliar ou adicionar às suas listas.</section>;
    return <SignedGameAccount key={`${game.id}:${user.id}`} game={game} userId={user.id} />;
}