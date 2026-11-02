import '../styles/components.css';
import { Link } from 'react-router-dom';

export function Stars({ rating, max = 5 }) {
    return (
        <div className="review-stars" aria-label={`Nota ${rating} de ${max}`}>
            {Array.from({ length: max }, (_, i) => (
                <i key={i} className={`bi ${i < rating ? 'bi-star-fill' : 'bi-star'}`}></i>
            ))}
        </div>
    );
}

export default function ReviewCard({ review, showAuthor = true }) {
    return (
        <article className="review-card">
            <Link className="review-card-thumb" to={`/jogo/${review.rawgId}`} aria-label={`Abrir ${review.gameTitle}`}>
                {review.gameImage && <img src={review.gameImage} alt="" />}
            </Link>

            <div className="review-card-body">
                <div className="review-card-head">
                    <h3 className="review-card-title"><Link to={`/reviews/${review.id}`}>{review.gameTitle}</Link></h3>
                    <span>{review.date}</span>
                </div>
                <Stars rating={review.rating} />
                {showAuthor && <p>{review.author}</p>}
                {review.text && <p className="review-card-text">{review.text}</p>}
                <Link className="review-card-more" to={`/reviews/${review.id}`}>Ver avaliação</Link>
            </div>
        </article>
    );
}