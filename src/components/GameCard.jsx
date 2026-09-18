import { Link } from 'react-router-dom';
import '../styles/components.css';

export default function GameCard({ game }) {
    if (!game) return null;

    return (
        <Link to={`/jogo/${game.id}`} className="card">
            <div className="imgcard">
                <img src={game.image} alt={game.title} />
            </div>
            <p className="gct">{game.title}</p>
        </Link>
    );
}
