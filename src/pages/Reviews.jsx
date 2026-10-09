import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AccountLayout, { Pagination } from '../components/AccountLayout';
import ReviewCard from '../components/ReviewCard';
import ApiFeedback from '../components/ApiFeedback';
import { useAccountData } from '../hooks/useAccountData';
import { loadReviews } from '../services/account';

export default function Reviews() {
    const [params, setParams] = useSearchParams();
    const requestedGame = Number(params.get('jogo'));
    const rawgId = Number.isSafeInteger(requestedGame) && requestedGame > 0 ? requestedGame : undefined;
    const requestedPage = Number(params.get('page'));
    const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 && requestedPage <= 10000 ? requestedPage : 1;
    const setPage = (next) => setParams({ ...(rawgId ? { jogo: String(rawgId) } : {}), page: String(next) });
    const load = useCallback(() => loadReviews(page, undefined, rawgId), [page, rawgId]);
    const { data, loading, error, reload } = useAccountData(`reviews:${rawgId}:${page}`, load);
    return <AccountLayout title={rawgId ? 'Avaliações deste jogo' : 'Avaliações da comunidade'}>
        {rawgId && <Link to="/reviews">Todas as avaliações</Link>}
        <ApiFeedback loading={loading} error={error} onRetry={reload} />
        {data && <>{!data.items.length && <p>Ainda não há avaliações. Você pode avaliar na página de cada jogo.</p>}
            {data.items.map((review) => <ReviewCard key={review.id} review={review} />)}
            <Pagination page={page} count={data.count} onChange={setPage} /></>}
    </AccountLayout>;
}
