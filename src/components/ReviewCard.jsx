import '../styles/components.css';

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
                    <h3 className="review-card-title">{review.gameTitle}</h3>
                    <button className="review-card-like" type="button" aria-label="Curtir review">
                        <i className="bi bi-heart"></i>
                        <span>{review.date}</span>
                    </button>
                </div>
                <Stars rating={review.rating} />
                <p className="review-card-text">{review.text}</p>
            </div>
        </article>
    );
}