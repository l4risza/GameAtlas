import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/components.css';

export default function Carousel({ games = [] }) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);
    const current = index % Math.max(games.length, 1);

    useEffect(() => {
        if (paused || games.length <= 1) return;
        const timer = setInterval(() => setIndex((value) => (value + 1) % games.length), 5000);
        return () => clearInterval(timer);
    }, [paused, games.length]);

    if (!games.length) return null;
    return (
        <div className="container">
            <div className="carousel-custom" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
                onFocus={() => setPaused(true)} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
                <div className="carousel-track" style={{ transform: `translateX(-${current * 100}%)` }}>
                    {games.map((game, position) => (
                        <div className="carousel-slide" key={game.id} aria-hidden={position !== current}>
                            <Link to={`/jogo/${game.id}`} className="carousel-link" tabIndex={position === current ? 0 : -1}>
                                <div className="imgcarousel">
                                    <img src={game.banner || '/images/game-placeholder.svg'} alt={game.title}
                                        onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/images/game-placeholder.svg'; }} />
                                </div>
                                <div className="carousel-caption api-carousel-caption">
                                    <h1>{game.title}</h1>
                                    <p>{game.genre}</p>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>
                <button className="carousel-control-prev" type="button" aria-label="Anterior"
                    onClick={() => setIndex((current + games.length - 1) % games.length)}><i className="bi bi-chevron-left" aria-hidden="true" /></button>
                <button className="carousel-control-next" type="button" aria-label="Próximo"
                    onClick={() => setIndex((current + 1) % games.length)}><i className="bi bi-chevron-right" aria-hidden="true" /></button>
                <div className="carousel-indicators-custom">
                    {games.map((game, position) => (
                        <button key={game.id} type="button" className={position === current ? 'active' : ''}
                            aria-label={`Destaque ${position + 1}`} aria-current={position === current ? 'true' : undefined}
                            onClick={() => setIndex(position)} />
                    ))}
                </div>
            </div>
        </div>
    );
}
