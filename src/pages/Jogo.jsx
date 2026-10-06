import { Link, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ApiFeedback from '../components/ApiFeedback';
import { useGame } from '../hooks/useGame';
import '../styles/components.css';
import '../styles/api.css';

export default function Jogo() {
    const { id } = useParams();
    const { game, loading, error, reload } = useGame(id);
    return (
        <>
            <Navbar />
            <main className="api-game-page">
                <Link className="api-link" to="/explorar">← Explorar jogos</Link>
                <ApiFeedback loading={loading} error={error} onRetry={reload} />
                {game && <article>
                    <div className="api-game-header">
                        <img className="api-game-image" src={game.image || '/images/game-placeholder.svg'} alt={game.title}
                            onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/game-placeholder.svg'; }} />
                        <div>
                            <h1>{game.title}</h1>
                            <p>Nota RAWG: {game.rawg_rating ?? 'Não informada'}{game.rawg_rating !== null ? ' / 5' : ''}</p>
                            <p>Metacritic: {game.metacritic ?? 'Não informado'}</p>
                            <p>Plataformas: {game.platform}</p>
                            <p>Gêneros: {game.genre}</p>
                            <p>Lançamento: {game.released ? game.released.split('-').reverse().join('/') : 'Não informado'}</p>
                            {game.developers.length > 0 && <p>Desenvolvimento: {game.developers.join(', ')}</p>}
                            {game.website && <a className="api-link" href={game.website} target="_blank" rel="noreferrer">Site oficial</a>}
                        </div>
                    </div>
                    <h2>Sobre o jogo</h2>
                    {game.description_translation === 'unavailable' ? (
                        <div role="status">
                            <p>Descrição indisponível no momento.</p>
                            <button className="api-button" type="button" onClick={reload}>Carregar descrição novamente</button>
                        </div>
                    ) : (
                        <p className="api-description" lang="pt-BR">{game.description || 'Descrição não disponível na RAWG.'}</p>
                    )}
                </article>}
            </main>
            <Footer />
        </>
    );
}
