import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AccountLayout, { GameTile, Pagination } from '../components/AccountLayout';
import ApiFeedback from '../components/ApiFeedback';
import { useAuth } from '../context/auth-context';
import { useAccountData } from '../hooks/useAccountData';
import { database, resultOf, accountError } from '../services/supabase';
import { PAGE_SIZE } from '../services/account';

function ListEditor({ list, onSaved }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    async function submit(event) {
        event.preventDefault(); setBusy(true); setError('');
        const form = new FormData(event.currentTarget);
        try {
            await resultOf(database().from('listas').update({ nome: form.get('nome').trim(),
                descricao: form.get('descricao').trim() || null, publica: form.get('publica') === 'on' })
                .eq('id', list.id).eq('usuario_id', list.usuario_id).select('id').single());
            onSaved();
        } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
    }
    async function remove() {
        setBusy(true); setError('');
        try {
            await resultOf(database().from('listas').delete().eq('id', list.id).eq('usuario_id', list.usuario_id));
            navigate('/listas?minhas=1', { replace: true });
        } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
    }
    return <details className="account-panel"><summary>Editar lista</summary><form className="account-form" onSubmit={submit}>
        <label>Nome da lista<input name="nome" defaultValue={list.nome} required maxLength={100} /></label>
        <label>Descrição<textarea name="descricao" defaultValue={list.descricao || ''} maxLength={2000} /></label>
        <label className="account-check"><input name="publica" type="checkbox" defaultChecked={list.publica} />Mostrar esta lista para todos</label>
        <p>Ao desmarcar, a lista e seus jogos ficam visíveis apenas para você.</p>
        {error && <p role="alert">{error}</p>}
        <div className="account-actions"><button className="api-button" disabled={busy}>Salvar alterações</button>
            <button type="button" className="api-button" disabled={busy} onClick={remove}>Excluir lista</button></div>
    </form></details>;
}

export default function ListaDetalhes() {
    const { id } = useParams();
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
    const owned = data?.list.usuario_id === user?.id;
    return <AccountLayout title={data?.list.nome || 'Lista de jogos'}>
        <Link to="/listas">Voltar às listas</Link><ApiFeedback loading={loading} error={error} onRetry={reload} />
        {data && <><p>{data.list.publica ? 'Pública' : 'Privada'} · {data.count} jogos</p>
            {data.list.descricao && <p>{data.list.descricao}</p>}
            {owned && <ListEditor key={`${id}:${data.list.publica}:${data.list.nome}`} list={data.list} onSaved={reload} />}
            {actionError && <p role="alert">{actionError}</p>}
            {!data.games.length && <p>Esta lista ainda não tem jogos. {owned && <Link to="/explorar">Escolha um jogo e use “Adicionar à lista”.</Link>}</p>}
            <div className="account-game-grid">{data.games.map((game) => <GameTile key={game.id} game={game}>
                {owned && <button className="api-button" disabled={busy} onClick={() => removeGame(game.id)}>Remover da lista</button>}
            </GameTile>)}</div><Pagination page={page} count={data.count} onChange={setPage} /></>}
    </AccountLayout>;
}
