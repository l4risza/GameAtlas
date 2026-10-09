import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { useAccountData } from '../hooks/useAccountData';
import { loadGameAccount, loadLists, saveGame, removeSaved, saveReview, deleteReview, addToList } from '../services/account';
import { accountError } from '../services/supabase';
import { Pagination } from './AccountLayout';
import ApiFeedback from './ApiFeedback';
import '../styles/account.css';

function ReviewForm({ review, busy, onSave, onDelete }) {
    const [rating, setRating] = useState(review?.nota || '');
    const [text, setText] = useState(review?.texto || '');
    return <form className="account-form" onSubmit={(event) => { event.preventDefault(); onSave(Number(rating), text); }}>
        <h3>Minha avaliação</h3>
        <label>Nota<select required value={rating} onChange={(event) => setRating(event.target.value)}>
            <option value="">Selecione uma nota</option>{[1, 2, 3, 4, 5].map((note) => <option key={note} value={note}>{note} / 5</option>)}
        </select></label>
        <label>Comentário (opcional)<textarea value={text} onChange={(event) => setText(event.target.value)} maxLength={10000} rows={4} /></label>
        <div className="account-actions"><button className="api-button" disabled={busy}>{review ? 'Atualizar avaliação' : 'Salvar avaliação'}</button>
            {review && <button className="api-button" type="button" disabled={busy} onClick={onDelete}>Remover avaliação</button>}</div>
    </form>;
}

function SignedGameAccount({ game, userId }) {
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState('');
    const [actionError, setActionError] = useState('');
    const [listPage, setListPage] = useState(1);
    const [listId, setListId] = useState('');
    const load = useCallback(() => loadGameAccount(game.id, userId), [game.id, userId]);
    const { data, loading, error, reload } = useAccountData(`jogo:${game.id}:${userId}`, load);
    const loadOwnLists = useCallback(() => loadLists(listPage, userId), [listPage, userId]);
    const lists = useAccountData(`escolher-lista:${userId}:${listPage}`, loadOwnLists);
    async function run(action, message, refresh = true) {
        setBusy(true); setActionError(''); setNotice('');
        try { await action(); setNotice(message); if (refresh) reload(); }
        catch (e) { setActionError(accountError(e)); } finally { setBusy(false); }
    }
    return <section className="game-account"><h2>Meu jogo</h2>
        <ApiFeedback loading={loading} error={error} onRetry={reload} />
        {actionError && <p role="alert">{actionError}</p>}{notice && <p role="status">{notice}</p>}
        {data && <>
            <ReviewForm key={`${data.review?.id}:${data.review?.nota}:${data.review?.texto}`} review={data.review} busy={busy}
                onSave={(nota, texto) => run(() => saveReview(game.id, userId, nota, texto, data.review?.id), 'Avaliação salva.')}
                onDelete={() => run(() => deleteReview(data.review.id, userId), 'Avaliação removida.')} />
            <h3>Adicionar à lista</h3>
            <ApiFeedback loading={lists.loading} error={lists.error} onRetry={lists.reload} />
            {lists.data?.items.length > 0 && <form className="account-form" onSubmit={(event) => {
                event.preventDefault(); run(() => addToList(game.id, listId), 'Jogo adicionado à lista.', false);
            }}><label>Escolha sua lista<select required value={listId} onChange={(event) => setListId(event.target.value)}>
                <option value="">Selecione uma lista</option>{lists.data.items.map((list) => <option key={list.id} value={list.id}>
                    {list.nome} ({list.publica ? 'pública' : 'privada'})
                </option>)}
            </select></label><button className="api-button" disabled={busy || !listId}>Adicionar à lista</button></form>}
            {lists.data && <Pagination page={listPage} count={lists.data.count} onChange={(page) => { setListPage(page); setListId(''); }} />}
            <p><Link to="/listas?minhas=1">Criar ou gerenciar minhas listas</Link></p>
        </>}
    </section>;
}

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
    const label = error ? 'Tentar carregar Jogos Salvos novamente' : data?.saved ? 'Remover de Jogos Salvos' : 'Salvar jogo';
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
