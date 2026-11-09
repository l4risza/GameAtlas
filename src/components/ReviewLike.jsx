import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/auth-context';
import { setReviewLike } from '../services/account';
import '../styles/review-like.css';

export default function ReviewLike({ review }) {
    const { user, loading } = useAuth();
    const location = useLocation();
    const [saved, setSaved] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const state = saved && saved.userId === user?.id ? saved : { curtida: review.liked, curtidas: review.likes || 0 };
    async function toggle() {
        setBusy(true); setError('');
        try { setSaved({ ...await setReviewLike(review.id, !state.curtida), userId: user.id }); }
        catch (error) { setError(error.message); } finally { setBusy(false); }
    }
    return <div className="review-like">
        {user || loading ? <button type="button" className="review-like__button" disabled={busy || loading} aria-pressed={Boolean(state.curtida)}
            onClick={toggle} aria-label={`${state.curtida ? 'Descurtir' : 'Curtir'} review de ${review.author}`}>
            <i className={`bi ${state.curtida ? 'bi-heart-fill' : 'bi-heart'}`} aria-hidden="true"></i>
            {state.curtida ? 'Curtido' : 'Curtir'} · {state.curtidas}
        </button> : <Link className="review-like__button" to={`/login?voltar=${encodeURIComponent(location.pathname + location.search)}`}>
            <i className="bi bi-heart" aria-hidden="true"></i> Curtir · {review.likes || 0}
        </Link>}
        {error && <p role="alert">{error}</p>}
    </div>;
}
