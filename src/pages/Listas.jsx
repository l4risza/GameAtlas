import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AccountLayout, { Pagination } from '../components/AccountLayout';
import { ListCard, ListTile } from '../components/ListCard';
import ApiFeedback from '../components/ApiFeedback';
import { useAuth } from '../context/auth-context';
import { useAccountData } from '../hooks/useAccountData';
import { loadListsWithCovers, loadSavedSummary } from '../services/account';
import { database, resultOf, accountError } from '../services/supabase';

function CreateList({ userId, onCreated }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    async function submit(event) {
        event.preventDefault();
        setBusy(true); setError('');
        const formElement = event.currentTarget;
        const form = new FormData(formElement);
        try {
            await resultOf(database().from('listas').insert({
                usuario_id: userId,
                nome: form.get('nome').trim(),
                descricao: form.get('descricao').trim() || null,
                publica: form.get('publica') === 'on',
            }));
            formElement.reset();
            onCreated();
        } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
    }

    return (
        <details className="account-panel">
            <summary>Criar nova lista</summary>
            <form className="account-form" onSubmit={submit}>
                <label>Nome da lista<input name="nome" maxLength={100} required /></label>
                <label>Descrição<textarea name="descricao" maxLength={2000} rows={3} /></label>
                <label className="account-check"><input name="publica" type="checkbox" />Mostrar esta lista para todos</label>
                <p>Deixe desmarcado para manter a lista privada.</p>
                {error && <p role="alert">{error}</p>}
                <button className="api-button" disabled={busy}>{busy ? 'Criando...' : 'Criar lista'}</button>
            </form>
        </details>
    );
}

export default function Listas() {
    const { user, loading: authLoading } = useAuth();
    const [params, setParams] = useSearchParams();
    const userId = user?.id;

    // "?minhas=1" continua funcionando para links antigos.
    const requested = params.get('aba') || (params.get('minhas') === '1' ? 'minhas' : null);
    const explicit = requested === 'minhas' || requested === 'comunidade';
    const waiting = authLoading && !explicit;                       // ainda não sabemos se há usuário logado
    const tab = explicit ? requested : (userId ? 'minhas' : 'comunidade');
    const mine = tab === 'minhas';

    const requestedPage = Number(params.get('page'));
    const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 10000 ? requestedPage : 1;

    const load = useCallback(async () => {
        if (waiting || (mine && !userId)) return null;
        const [lists, saved] = await Promise.all([
            loadListsWithCovers(page, mine ? userId : undefined),
            mine && page === 1 ? loadSavedSummary(userId) : Promise.resolve(null),
        ]);
        return { ...lists, saved };
    }, [page, mine, userId, waiting]);
    const { data, loading, error, reload } = useAccountData(`listas:${userId}:${tab}:${page}`, load);

    const changePage = (next) => setParams({ aba: tab, page: String(next) });

    return (
        <AccountLayout title="Listas" requireLogin={explicit && mine}>
            <nav className="account-tabs" aria-label="Tipos de lista">
                {userId
                    ? <Link to="/listas?aba=minhas" aria-current={mine ? 'page' : undefined}>Minhas listas</Link>
                    : <Link to="/login?voltar=%2Flistas%3Faba%3Dminhas">Minhas listas</Link>}
                <Link to="/listas?aba=comunidade" aria-current={!mine ? 'page' : undefined}>Listas da comunidade</Link>
            </nav>

            {mine && user && (
                <CreateList userId={user.id} onCreated={() => (page === 1 ? reload() : setParams({ aba: 'minhas' }))} />
            )}

            {waiting && <p role="status">Carregando...</p>}
            <ApiFeedback loading={loading && !waiting} error={error} onRetry={reload} />

            {data && (
                <>
                    <div className="list-grid">
                        {mine && data.saved && (
                            <ListTile
                                featured
                                to="/listas/salvos"
                                title="Jogos salvos"
                                description="Todos os jogos que você salvou com o marcador. Só você vê esta lista."
                                total={data.saved.total}
                                covers={data.saved.covers}
                                badge="Geral · Privada"
                            />
                        )}
                        {data.items.map((list) => <ListCard key={list.id} list={list} />)}
                    </div>

                    {!data.items.length && (
                        <p className="account-empty">
                            {mine
                                ? 'Você ainda não criou uma lista personalizada. Use “Criar nova lista” acima.'
                                : 'Ainda não há listas públicas.'}
                        </p>
                    )}
                    <Pagination page={page} count={data.count} onChange={changePage} />
                </>
            )}
        </AccountLayout>
    );
}