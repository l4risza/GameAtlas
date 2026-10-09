import '../styles/components.css';
import { Link } from 'react-router-dom';

function Stars({ rating, max = 5 }) {
    return (
        <div className="review-stars" aria-label={`Nota ${rating} de ${max}`}>
            {Array.from({ length: max }, (_, i) => (
                <i key={i} className={`bi ${i < rating ? 'bi-star-fill' : 'bi-star'}`}></i>
            ))}
        </div>
    );
}

export default function ReviewCard({ review }) {
    return (
        <article className="review-card">
            <div className="review-card-thumb">
                {review.gameImage && <img src={review.gameImage} alt={review.gameTitle} />}
            </div>

            <div className="review-card-body">
                <div className="review-card-head">
                    <h3 className="review-card-title"><Link to={`/jogo/${review.rawgId}`}>{review.gameTitle}</Link></h3>
                    <span>{review.date}</span>
                </div>
                <Stars rating={review.rating} />
                <p>{review.author}</p>
                {review.text && <p className="review-card-text">{review.text}</p>}
            </div>
        </article>
    );
}
