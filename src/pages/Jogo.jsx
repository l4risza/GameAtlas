import { useParams } from 'react-router-dom';
import { useGames } from '../hooks/useGames';

export default function GameDetail() {
    const { id } = useParams();
    const { games, loading } = useGames();
    const game = games[id];

    if (loading) {
        return <p className="carousel-loading">Carregando...</p>;
    }

    if (!game) {
        return <p className="carousel-loading">Jogo não encontrado.</p>;
    }

    return (
        <div className="container" style={{ paddingTop: '110px' }}>
            <img src={game.image} alt={game.title} style={{ maxWidth: '300px', borderRadius: '12px' }} />
            <h1>{game.title}</h1>
            <p>{game.description}</p>
            <p>Nota: {game.rating}</p>
            <p>Plataforma: {game.platform}</p>
            <p>Gênero: {game.genre}</p>
            <p>Ano: {game.year}</p>
        </div>
    );
}
