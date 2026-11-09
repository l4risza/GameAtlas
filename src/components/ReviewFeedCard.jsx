import { Link } from 'react-router-dom';
import { Stars } from './ReviewCard';
import ReviewLike from './ReviewLike';

export default function ReviewFeedCard({ review }) {
    return (
        <article className="feed-card">
            <div className="feed-card-head">
                <img className="feed-avatar" src={review.avatar || '/images/perfil.png'} alt="" loading="lazy" />
                <div className="feed-who">
                    <h3 className="feed-name">
                        <Link className="review-author-link" to={`/perfil/${review.userId}`}>
                        {review.authorName}
                        {review.username && <span className="feed-user">@{review.username}</span>}
                        </Link>
                    </h3>
                    <Stars rating={review.rating} />
                </div>
                <span className="feed-date">{review.date}</span>
            </div>

            {review.text && <p className="feed-text">{review.text}</p>}
            <ReviewLike key={`${review.id}:${review.liked}`} review={review} />

            <div className="feed-foot">
                <Link className="feed-game" to={`/jogo/${review.rawgId}`}>
                    {review.gameImage && <img src={review.gameImage} alt="" loading="lazy" />}
                    <span>{review.gameTitle}</span>
                </Link>
                {/* o ::after deste link cobre o card inteiro, então clicar em qualquer lugar abre a review */}
                <Link className="feed-more" to={`/reviews/${review.id}`}>
                    Ver avaliação <i className="bi bi-arrow-right" aria-hidden="true"></i>
                </Link>
            </div>
        </article>
    );
}