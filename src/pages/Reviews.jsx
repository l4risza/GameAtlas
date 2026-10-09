import { useCallback, useState } from 'react';
import AccountLayout, { Pagination } from '../components/AccountLayout';
import ReviewCard from '../components/ReviewCard';
import ApiFeedback from '../components/ApiFeedback';
import { useAccountData } from '../hooks/useAccountData';
import { loadReviews } from '../services/account';

export default function Reviews() {
    const [page, setPage] = useState(1);
    const load = useCallback(() => loadReviews(page), [page]);
    const { data, loading, error, reload } = useAccountData('reviews:' + page, load);
    return <AccountLayout title="Avaliações da comunidade">
        <ApiFeedback loading={loading} error={error} onRetry={reload} />
        {data && <>{!data.items.length && <p>Ainda não há avaliações. Você pode avaliar na página de cada jogo.</p>}
            {data.items.map((review) => <ReviewCard key={review.id} review={review} />)}
            <Pagination page={page} count={data.count} onChange={setPage} /></>}
    </AccountLayout>;
}
