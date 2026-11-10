import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AccountLayout, { GameTile, Pagination } from '../components/AccountLayout';
import ApiFeedback from '../components/ApiFeedback';
import GamePicker from '../components/GamePicker';
import { useAuth } from '../context/auth-context';
import { useAccountData } from '../hooks/useAccountData';
import { database, resultOf, accountError } from '../services/supabase';
import { PAGE_SIZE, addToList, loadSaved, removeSaved } from '../services/account';

/* ---------- lista geral: Jogos salvos ---------- */
function SavedList() {
    const { user } = useAuth();
    const [page, setPage] = useState(1);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState('');
    const load = useCallback(() => (user ? loadSaved(page) : Promise.resolve(null)), [page, user]);
    const { data, loading, error, reload } = useAccountData(`salvos:${user?.id}:${page}`, load);

    async function remove(gameId) {
        setBusy(true); setActionError('');
        try {
            await removeSaved(gameId, user.id);
            if (page > 1 && data.items.length === 1) setPage(page - 1); else reload();
        } catch (e) { setActionError(accountError(e)); } finally { setBusy(false); }
    }

    return (
        <AccountLayout title="Jogos salvos" requireLogin>
            <Link to="/listas?aba=minhas">Voltar às listas</Link>
            <ApiFeedback loading={loading} error={error} onRetry={reload} />
            {data && (
                <>
                    <p className="account-sub">Lista geral · Privada · {data.count} {data.count === 1 ? 'jogo' : 'jogos'}</p>
                    <p>Os jogos que você salvou com o marcador na página do jogo. Só você vê esta lista.</p>
                    {actionError && <p role="alert">{actionError}</p>}
                    {!data.items.length && (
                        <p>Você ainda não salvou nenhum jogo. <Link to="/explorar">Explore os jogos</Link> e use o marcador para salvar.</p>
                    )}
                    <div className="account-game-grid">
                        {data.items.map((game) => (
                            <GameTile key={game.id} game={game}>
                                <button className="api-button" disabled={busy} onClick={() => remove(game.id)}>Remover dos salvos</button>
                            </GameTile>
                        ))}
                    </div>
                    <Pagination page={page} count={data.count} onChange={setPage} />
                </>
            )}
        </AccountLayout>
    );
}

/* ---------- lista personalizada ---------- */
function ListEditor({ list, onSaved }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    async function submit(event) {
        event.preventDefault();
        setBusy(true); setError('');
        const form = new FormData(event.currentTarget);
        try {
            await resultOf(database().from('listas').update({
                nome: form.get('nome').trim(),
                descricao: form.get('descricao').trim() || null,
                publica: form.get('publica') === 'on',
            }).eq('id', list.id).eq('usuario_id', list.usuario_id).select('id').single());
            onSaved();
        } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
    }

    async function remove() {
        setBusy(true); setError('');
        try {
            await resultOf(database().from('listas').delete().eq('id', list.id).eq('usuario_id', list.usuario_id));
            navigate('/listas?aba=minhas', { replace: true });
        } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
    }

    return (
        <details className="account-panel">
            <summary>Editar lista</summary>
            <form className="account-form" onSubmit={submit}>
                <label>Nome da lista<input name="nome" defaultValue={list.nome} required maxLength={100} /></label>
                <label>Descrição<textarea name="descricao" defaultValue={list.descricao || ''} maxLength={2000} /></label>
                <label className="account-check"><input name="publica" type="checkbox" defaultChecked={list.publica} />Mostrar esta lista para todos</label>
                <p>Ao desmarcar, a lista e seus jogos ficam visíveis apenas para você.</p>
                {error && <p role="alert">{error}</p>}
                <div className="account-actions">
                    <button className="api-button" disabled={busy}>Salvar alterações</button>
                    <button type="button" className="api-button" disabled={busy} onClick={remove}>Excluir lista</button>
                </div>
            </form>
        </details>
    );
}

function CustomList({ id }) {
    const { user } = useAuth();
    const [page, setPage] = useState(1);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState('');

    const load = useCallback(async () => {
        const { data: list } = await resultOf(database().from('listas')
            .select('id,usuario_id,nome,descricao,publica,perfis(nome,username)').eq('id', id).maybeSingle());
        if (!list) throw new Error('Esta lista não existe ou é privada.');
        const { data: games, count } = await resultOf(database().from('lista_jogos')
            .select('jogo_id,jogos(id,rawg_id,nome,capa_url)', { count: 'exact' }).eq('lista_id', id)
            .order('posicao').order('adicionado_em').order('jogo_id')
            .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1));
        return { list, games: games.map((row) => row.jogos), count };
    }, [id, page]);
    const { data, loading, error, reload } = useAccountData(`lista:${id}:${user?.id}:${page}`, load);

    async function removeGame(gameId) {
        setBusy(true); setActionError('');
        try {
            await resultOf(database().from('lista_jogos').delete().eq('lista_id', id).eq('jogo_id', gameId));
            if (page > 1 && data.games.length === 1) setPage(page - 1); else reload();
        } catch (e) { setActionError(accountError(e)); } finally { setBusy(false); }
    }

    const owned = Boolean(data) && data.list.usuario_id === user?.id;
    const owner = data?.list.perfis?.username ? `@${data.list.perfis.username}` : data?.list.perfis?.nome || 'Jogador';

    return (
        <AccountLayout title={data?.list.nome || 'Lista de jogos'}>
            <Link to={owned ? '/listas?aba=minhas' : '/listas?aba=comunidade'}>Voltar às listas</Link>
            <ApiFeedback loading={loading} error={error} onRetry={reload} />
            {data && (
                <>
                    <p className="account-sub">
                        {data.list.publica ? 'Pública' : 'Privada'} · {data.count} {data.count === 1 ? 'jogo' : 'jogos'}
                        {!owned && ` · por ${owner}`}
                    </p>
                    {data.list.descricao && <p>{data.list.descricao}</p>}
                    {owned && <ListEditor key={`${id}:${data.list.publica}:${data.list.nome}`} list={data.list} onSaved={reload} />}
                    {owned && <details className="account-panel">
                        <summary>Adicionar jogo à lista</summary>
                        <GamePicker label="Buscar jogo para adicionar à lista" excludedIds={data.games.map(game => game.rawg_id)}
                            onSelect={async game => { await addToList(game.id, id); if (page !== 1) setPage(1); else reload(); }} />
                    </details>}
                    {actionError && <p role="alert">{actionError}</p>}
                    {!data.games.length && (
                        <p>Esta lista ainda não tem jogos. {owned && <Link to="/explorar">Escolha um jogo e use “Adicionar à lista”.</Link>}</p>
                    )}
                    <div className="account-game-grid">
                        {data.games.map((game) => (
                            <GameTile key={game.id} game={game}>
                                {owned && <button className="api-button" disabled={busy} onClick={() => removeGame(game.id)}>Remover da lista</button>}
                            </GameTile>
                        ))}
                    </div>
                    <Pagination page={page} count={data.count} onChange={setPage} />
                </>
            )}
        </AccountLayout>
    );
}

export default function ListaDetalhes() {
    const { id } = useParams();
    return id === 'salvos' ? <SavedList /> : <CustomList key={id} id={id} />;
}