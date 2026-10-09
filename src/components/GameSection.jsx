import { Link } from 'react-router-dom'; // NOVO
import GameCard from './GameCard';
import '../styles/components.css';

export default function GameSection({ title, games = [], showMetadata = false, seeMoreTo }) { // NOVO: seeMoreTo
    if (!games.length) return null;

    return (
        <section>
            <h4 className="section-title">{title}</h4>
            <hr />
            <div className="cards">
                {games.map((game) => (
                    <GameCard key={game.id} game={game} showMetadata={showMetadata} />
                ))}
            </div>
            {seeMoreTo && (
                <div className="section-ver-mais">
                    <Link className="api-button" to={seeMoreTo}>Ver mais</Link>
                </div>
            )}
        </section>
    );
}