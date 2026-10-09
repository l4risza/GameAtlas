import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import AccountLayout, { GameTile, Pagination } from '../components/AccountLayout';
import ApiFeedback from '../components/ApiFeedback';
import { useAuth } from '../context/auth-context';
import { useAccountData } from '../hooks/useAccountData';
import { loadSaved, removeSaved } from '../services/account';
import { accountError } from '../services/supabase';

export default function JogosSalvos() {
    const { user } = useAuth();
    const [page, setPage] = useState(1);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState('');
    const load = useCallback(() => user ? loadSaved(page) : Promise.resolve(null), [page, user]);
    const { data, loading, error, reload } = useAccountData(`salvos:${user?.id}:${page}`, load);
    async function remove(gameId) {
        setBusy(true); setActionError('');
        try {
            await removeSaved(gameId, user.id);
            if (page > 1 && data.items.length === 1) setPage(page - 1); else reload();
        } catch (e) { setActionError(accountError(e)); } finally { setBusy(false); }
    }
    return <AccountLayout title="Jogos Salvos" requireLogin>
        <p>Os jogos que você escolheu salvar. Só você pode ver esta página.</p>
        <ApiFeedback loading={loading} error={error} onRetry={reload} />
        {actionError && <p role="alert">{actionError}</p>}
        {data && <>{!data.items.length && <p>Você ainda não salvou nenhum jogo. <Link to="/explorar">Explore os jogos</Link> e salve os que quiser.</p>}
            <div className="account-game-grid">{data.items.map((game) => <GameTile key={game.id} game={game}>
                <button className="api-button" disabled={busy} onClick={() => remove(game.id)}>Remover de Jogos Salvos</button>
            </GameTile>)}</div><Pagination page={page} count={data.count} onChange={setPage} /></>}
    </AccountLayout>;
}
