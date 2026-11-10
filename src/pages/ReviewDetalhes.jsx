import { useCallback, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AccountLayout from '../components/AccountLayout';
import ApiFeedback from '../components/ApiFeedback';
import { Stars } from '../components/ReviewCard';
import ReviewLike from '../components/ReviewLike';
import { useAuth } from '../context/auth-context';
import { useAccountData } from '../hooks/useAccountData';
import { deleteReview, loadReview } from '../services/account';
import { accountError } from '../services/supabase';

export default function ReviewDetalhes() {
    const { id } = useParams();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [confirming, setConfirming] = useState(false);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState('');
    const load = useCallback(() => loadReview(id), [id]);
    const { data: review, loading, error, reload } = useAccountData(`review:${id}`, load);
    const own = Boolean(review) && review.userId === user?.id;

    async function remove() {
        setBusy(true); setActionError('');
        try {
            await deleteReview(review.id, user.id);
            navigate('/reviews?aba=minhas', { replace: true });
        } catch (e) { setActionError(accountError(e)); setBusy(false); }
    }

    return (
        <AccountLayout title="Avaliação">
            <Link to={review ? `/reviews?jogo=${review.rawgId}` : '/reviews'}>Voltar às avaliações</Link>
            <ApiFeedback loading={loading} error={error} onRetry={reload} />

            {review && (
                <article className="review-detail">
                    <Link to={`/jogo/${review.rawgId}`} className="review-detail-cover">
                        <img src={review.gameImage || '/images/game-placeholder.svg'} alt={review.gameTitle} />
                    </Link>

                    <div className="review-detail-body">
                        <h2><Link to={`/jogo/${review.rawgId}`}>{review.gameTitle}</Link></h2>
                        <Stars rating={review.rating} />
                        <p className="account-sub"><Link className="review-author-link" to={`/perfil/${review.userId}`}>{review.author}</Link> · {review.date}</p>
                        <ReviewLike key={`${review.id}:${review.liked}`} review={review} />
                        {review.text
                            ? <p className="review-detail-text">{review.text}</p>
                            : <p className="account-sub">Esta avaliação não tem comentário.</p>}

                        <div className="account-actions">
                            <Link className="api-button" to={`/jogo/${review.rawgId}`}>Ver o jogo</Link>
                            <Link className="api-button" to={`/reviews?jogo=${review.rawgId}`}>Todas as avaliações do jogo</Link>
                            {own && <Link className="api-button" to={`/jogo/${review.rawgId}`}>Editar na página do jogo</Link>}
                            {own && !confirming && (
                                <button type="button" className="api-button" onClick={() => setConfirming(true)}>Excluir avaliação</button>
                            )}
                            {own && confirming && (
                                <>
                                    <button type="button" className="api-button" disabled={busy} onClick={remove}>Confirmar exclusão</button>
                                    <button type="button" className="api-button" disabled={busy} onClick={() => setConfirming(false)}>Cancelar</button>
                                </>
                            )}
                        </div>
                        {actionError && <p role="alert">{actionError}</p>}
                    </div>
                </article>
            )}
        </AccountLayout>
    );
}