import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AccountLayout, { Pagination } from '../components/AccountLayout';
import ReviewFeedCard from '../components/ReviewFeedCard';
import ApiFeedback from '../components/ApiFeedback';
import { useAuth } from '../context/auth-context';
import { useAccountData } from '../hooks/useAccountData';
import { findGame, loadReviews } from '../services/account';
import '../styles/reviews.css';

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

    return (
        <AccountLayout title="" requireLogin={mine}>
            <div className="reviews-band" aria-hidden="true"></div>

            <div className="reviews-wrap">
                <nav className="reviews-tabs" aria-label="Seções de reviews">
                    {rawgId ? (
                        <>
                            <Link to={`/jogo/${rawgId}`}>Visão Geral</Link>
                            <Link to={href({ aba: '' })} className="active" aria-current="page">Reviews</Link>
                        </>
                    ) : (
                        <>
                            <Link to={href({ aba: '' })} className={!mine ? 'active' : undefined}
                                aria-current={!mine ? 'page' : undefined}>Comunidade</Link>
                            {user
                                ? <Link to={href({ aba: 'minhas' })} className={mine ? 'active' : undefined}
                                    aria-current={mine ? 'page' : undefined}>Minhas reviews</Link>
                                : <Link to="/login?voltar=%2Freviews%3Faba%3Dminhas">Minhas reviews</Link>}
                        </>
                    )}
                </nav>

                <section className="reviews-panel">
                    <h1 className="reviews-title">{mine ? 'Minhas reviews' : 'Reviews'}</h1>
                    {rawgId && <p className="reviews-sub">{data?.game?.nome || 'Este jogo'}</p>}
                    <hr />

                    <div className="reviews-toolbar">
                        <span>{rawgId && <Link to="/reviews">Ver todas as reviews</Link>}</span>
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
                                    {mine ? 'Você ainda não avaliou nenhum jogo. Abra um jogo e deixe sua nota.' : 'Ainda não há reviews.'}
                                </p>
                            )}
                            <div className="feed-list">
                                {data.items.map((review) => <ReviewFeedCard key={review.id} review={review} />)}
                            </div>
                            <Pagination page={page} count={data.count} onChange={(next) => setParams(query({ page: String(next) }))} />
                        </>
                    )}
                </section>
            </div>
        </AccountLayout>
    );
}