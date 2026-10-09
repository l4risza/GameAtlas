import { useCallback, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AccountLayout, { Pagination } from '../components/AccountLayout';
import { ListCard } from '../components/ListCard';
import ApiFeedback from '../components/ApiFeedback';
import { useAuth } from '../context/auth-context';
import { useAccountData } from '../hooks/useAccountData';
import { loadLists } from '../services/account';
import { database, resultOf, accountError } from '../services/supabase';

function CreateList({ userId, onCreated }) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    async function submit(event) {
        event.preventDefault(); setBusy(true); setError('');
        const formElement = event.currentTarget;
        const form = new FormData(formElement);
        try {
            await resultOf(database().from('listas').insert({ usuario_id: userId, nome: form.get('nome').trim(),
                descricao: form.get('descricao').trim() || null, publica: form.get('publica') === 'on' }));
            formElement.reset(); onCreated();
        } catch (e) { setError(accountError(e)); } finally { setBusy(false); }
    }
    return <details className="account-panel"><summary>Criar lista</summary><form className="account-form" onSubmit={submit}>
        <label>Nome da lista<input name="nome" maxLength={100} required /></label>
        <label>Descrição<textarea name="descricao" maxLength={2000} rows={3} /></label>
        <label className="account-check"><input name="publica" type="checkbox" />Mostrar esta lista para todos</label>
        <p>Deixe desmarcado para manter a lista privada.</p>
        {error && <p role="alert">{error}</p>}
        <button className="api-button" disabled={busy}>{busy ? 'Criando...' : 'Criar lista'}</button>
    </form></details>;
}

export default function Listas() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const mine = params.get('minhas') === '1';
    const requestedPage = Number(params.get('page'));
    const page = Number.isSafeInteger(requestedPage) && requestedPage >= 1 && requestedPage <= 10000 ? requestedPage : 1;
    const userId = user?.id;
    const load = useCallback(() => mine && !userId ? Promise.resolve(null) : loadLists(page, mine ? userId : undefined), [page, mine, userId]);
    const { data, loading, error, reload } = useAccountData('listas:' + userId + ':' + mine + ':' + page, load);
    const changePage = (next) => setParams({ ...(mine ? { minhas: '1' } : {}), page: String(next) });
    return <AccountLayout title="Listas de jogos" requireLogin={mine}>
        <nav className="account-tabs" aria-label="Tipos de lista">
            <Link to="/listas" aria-current={!mine ? 'page' : undefined}>Listas públicas</Link>
            <Link to="/listas?minhas=1" aria-current={mine ? 'page' : undefined}>Minhas listas</Link>
        </nav>
        {user ? <CreateList userId={user.id} onCreated={() => { if (mine && page === 1) reload(); else setParams({ minhas: '1' }); }} />
            : <p><Link to="/login?voltar=%2Flistas%3Fminhas%3D1">Entre</Link> para criar suas listas.</p>}
        <ApiFeedback loading={loading} error={error} onRetry={reload} />
        {data && <>{!data.items.length && <p>{mine ? 'Você ainda não criou uma lista.' : 'Ainda não há listas públicas.'}</p>}
            {data.items.map((list) => <ListCard key={list.id} list={list} />)}
            <Pagination page={page} count={data.count} onChange={changePage} /></>}
    </AccountLayout>;
}
