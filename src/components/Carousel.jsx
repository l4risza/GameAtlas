import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/components.css';

// TODO: trocar por uma chamada real à API/banco quando estiver pronta, ex:
// async function fetchJogosDestaque() {
//     const res = await fetch('/api/jogos-destaque');
//     if (!res.ok) throw new Error('Falha ao buscar destaques');
//     return res.json();
// }
async function fetchJogosDestaque() {
    // dados de exemplo — mesma "forma" (shape) que a API deve devolver
    return [
        {
            id: 1,
            banner: '/images/game1-banner.jpg',
            title: 'Jogo Um',
            description: 'Uma breve descrição do jogo em destaque.',
        },
        {
            id: 2,
            banner: '/images/game2-banner.jpg',
            title: 'Jogo Dois',
            description: 'Outra descrição chamativa sobre o jogo.',
        },
        {
            id: 3,
            banner: '/images/game3-banner.jpg',
            title: 'Jogo Três',
            description: 'Mais um destaque pra chamar atenção.',
        },
    ];
}

const AUTOPLAY_MS = 5000;

export default function Carousel() {
    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);

    // busca os jogos em destaque (troque fetchJogosDestaque por uma chamada real futuramente)
    useEffect(() => {
        let active = true;

        fetchJogosDestaque()
            .then((data) => {
                if (active) setGames(data);
            })
            .catch((err) => {
                console.error('Erro ao buscar jogos em destaque:', err);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    const goTo = useCallback(
        (newIndex) => {
            setIndex((current) => {
                const total = games.length;
                if (!total) return current;
                return (newIndex + total) % total;
            });
        },
        [games.length]
    );

    const next = useCallback(() => goTo(index + 1), [goTo, index]);
    const prev = useCallback(() => goTo(index - 1), [goTo, index]);

    // autoplay — pausa quando o mouse está em cima
    useEffect(() => {
        if (paused || games.length <= 1) return;

        const timer = setInterval(() => {
            setIndex((current) => (current + 1) % games.length);
        }, AUTOPLAY_MS);

        return () => clearInterval(timer);
    }, [paused, games.length]);

    if (loading) {
        return (
            <div className="container">
                <p className="carousel-loading">Carregando destaques...</p>
            </div>
        );
    }

    if (!games.length) return null;

    return (
        <div className="container">
            <div
                className="carousel-custom"
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
            >
                <div
                    className="carousel-track"
                    style={{ transform: `translateX(-${index * 100}%)` }}
                >
                    {games.map((game) => (
                        <div className="carousel-slide" key={game.id}>
                            <Link to={`/jogo/${game.id}`} className="carousel-link">
                                <div className="imgcarousel">
                                    <img src={game.banner} className="d-block w-100" alt={game.title} />
                                </div>
                                <div className="container">
                                    <div className="carousel-caption text-start">
                                        <h1>{game.title}</h1>
                                        <p className="opacity-75">{game.description}</p>
                                    </div>
                                </div>
                            </Link>
                        </div>
                    ))}
                </div>

                <button className="carousel-control-prev" type="button" onClick={prev} aria-label="Anterior">
                    <span className="carousel-control-prev-icon" aria-hidden="true"></span>
                    <span className="visually-hidden">Anterior</span>
                </button>
                <button className="carousel-control-next" type="button" onClick={next} aria-label="Próximo">
                    <span className="carousel-control-next-icon" aria-hidden="true"></span>
                    <span className="visually-hidden">Próximo</span>
                </button>

                <div className="carousel-indicators-custom">
                    {games.map((game, i) => (
                        <button
                            key={game.id}
                            type="button"
                            className={i === index ? 'active' : ''}
                            aria-current={i === index ? 'true' : undefined}
                            aria-label={`Slide ${i + 1}`}
                            onClick={() => goTo(i)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
