import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { useAccountData } from '../hooks/useAccountData';
import { loadReviews } from '../services/account';
import ReviewCard from './ReviewCard';
import ApiFeedback from './ApiFeedback';
import { Pagination } from './AccountLayout';

export default function GameReviews({ gameId }) {
    const { user } = useAuth();
    const [page, setPage] = useState(1);
    const [order, setOrder] = useState('recentes');
    const load = useCallback(() => loadReviews(page, undefined, gameId, order), [page, gameId, order]);
    const { data, loading, error, reload } = useAccountData(`reviews-jogo:${gameId}:${page}:${order}:${user?.id}`, load);
    return <section className="game-account game-reviews" aria-label="Reviews deste jogo">
        <h2>Reviews dos jogadores</h2>
        <Link to={`/reviews?jogo=${gameId}`}>Escrever ou editar minha avaliação</Link>
        <label className="game-reviews__toolbar">Ordenar por
            <select className="account-select" value={order} onChange={event => { setOrder(event.target.value); setPage(1); }}>
                <option value="recentes">Mais recentes</option>
                <option value="populares">Mais populares</option>
                <option value="antigas">Mais antigas</option>
            </select>
        </label>
        <ApiFeedback loading={loading} error={error} onRetry={reload} />
        {data && <>
            {!data.items.length && <p>Nenhum jogador avaliou este jogo ainda.</p>}
            {data.items.map(review => <ReviewCard key={review.id} review={review} />)}
            <Pagination page={page} count={data.count} onChange={setPage} />
        </>}
    </section>;
}
