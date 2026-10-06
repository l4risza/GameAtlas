import { Link } from 'react-router-dom';
import '../styles/components.css';

export default function GameCard({ game, showMetadata = false }) {
    if (!game) return null;

    return (
        <Link to={`/jogo/${game.id}`} className="card">
            <div className="imgcard">
                <img src={game.image || '/images/game-placeholder.svg'} alt={game.title} loading="lazy"
                    onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/game-placeholder.svg'; }} />
            </div>
            <p className="gct" title={game.title}>{game.title}</p>
            {showMetadata && <p className="game-card-meta" title={game.platform}>
                {game.year || 'Ano não informado'} · {game.platforms?.slice(0, 2).join(' / ') || 'Plataforma não informada'}
                {game.platforms?.length > 2 && ` +${game.platforms.length - 2}`}
            </p>}
        </Link>
    );
}
