import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AccountLayout, { Pagination } from '../components/AccountLayout';
import ReviewCard from '../components/ReviewCard';
import ApiFeedback from '../components/ApiFeedback';
import { useAuth } from '../context/auth-context';
import { useAccountData } from '../hooks/useAccountData';
import { findGame, loadReviews } from '../services/account';

const positiveInt = (value, max = Infinity) => {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 && number <= max ? number : undefined;
};

export default function Reviews() {
    const { user } = useAuth();
    const [params, setParams] = useSearchParams();
    const userId = user?.id;
    const rawgId = positiveInt(params.get('jogo'));
    const page = positiveInt(params.get('page'), 10000) ?? 1;
    const order = params.get('ordem') === 'antigas' ? 'antigas' : 'recentes';
    const mine = params.get('aba') === 'minhas';

    // Monta a URL mantendo o filtro de jogo; mudar aba/ordem volta para a página 1.
    const query = (changes = {}) => {
        const next = {
            ...(rawgId ? { jogo: String(rawgId) } : {}),
            ...(mine ? { aba: 'minhas' } : {}),
            ...(order === 'antigas' ? { ordem: 'antigas' } : {}),
            ...changes,
        };
        return Object.fromEntries(Object.entries(next).filter(([, value]) => value));
    };
    const href = (changes) => `/reviews?${new URLSearchParams(query(changes))}`;

    const load = useCallback(async () => {
        if (mine && !userId) return null;
        const [reviews, game] = await Promise.all([
            loadReviews(page, mine ? userId : undefined, rawgId, order),
            rawgId ? findGame(rawgId).catch(() => null) : Promise.resolve(null),
        ]);
        return { ...reviews, game };
    }, [page, mine, userId, rawgId, order]);
    const { data, loading, error, reload } = useAccountData(`reviews:${userId}:${mine}:${rawgId}:${order}:${page}`, load);

    const title = rawgId
        ? (data?.game ? `Avaliações de ${data.game.nome}` : 'Avaliações deste jogo')
        : mine ? 'Minhas avaliações' : 'Avaliações da comunidade';

    return (
        <AccountLayout title={title} requireLogin={mine}>
            <nav className="account-tabs" aria-label="Tipo de avaliação">
                <Link to={href({ aba: '' })} aria-current={!mine ? 'page' : undefined}>Comunidade</Link>
                {user
                    ? <Link to={href({ aba: 'minhas' })} aria-current={mine ? 'page' : undefined}>Minhas avaliações</Link>
                    : <Link to="/login?voltar=%2Freviews%3Faba%3Dminhas">Minhas avaliações</Link>}
            </nav>

            <div className="list-toolbar">
                <span>
                    {rawgId && <><Link to={`/jogo/${rawgId}`}>Ver o jogo</Link> · <Link to="/reviews">Todas as avaliações</Link></>}
                </span>
                <label className="account-order">Ordenar por
                    <select className="account-select" value={order}
                        onChange={(event) => setParams(query({ ordem: event.target.value === 'antigas' ? 'antigas' : '' }))}>
                        <option value="recentes">Mais recentes</option>
                        <option value="antigas">Mais antigas</option>
                    </select>
                </label>
            </div>

            <ApiFeedback loading={loading} error={error} onRetry={reload} />
            {data && (
                <>
                    {!data.items.length && (
                        <p className="account-empty">
                            {mine ? 'Você ainda não avaliou nenhum jogo. Abra um jogo e deixe sua nota.' : 'Ainda não há avaliações.'}
                        </p>
                    )}
                    {data.items.map((review) => <ReviewCard key={review.id} review={review} showAuthor={!mine} />)}
                    <Pagination page={page} count={data.count} onChange={(next) => setParams(query({ page: String(next) }))} />
                </>
            )}
        </AccountLayout>
    );
}