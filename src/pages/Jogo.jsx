import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ApiFeedback from '../components/ApiFeedback';
import { useGame } from '../hooks/useGame';
import { useGames } from '../hooks/useGames';
import { GENRES } from '../services/search-options';
import '../styles/components.css';
import '../styles/api.css';
import '../styles/jogo.css';

/* Extras opcionais por slug. Sobrescrevem a mídia da RAWG (arquivos em public/). */
const GAME_EXTRAS = {
    deltarune: {
        longDescription:
            'Mergulhe na história paralela de UNDERTALE! Lute ou poupe seus adversários em batalhas repletas de ação ' +
            'enquanto explora um mundo misterioso ao lado de um elenco cativante de personagens novos e conhecidos.',
        tags: ['RPG', 'Indie', 'História', 'Pixel Art'],
        publicScore: 90,
        criticScore: 86,
        trailer: { src: '/videos/deltarunetrailer.mp4', poster: '/images/deltarune-trailer.jpg' },
        screenshots: Array.from({ length: 10 }, (_, i) => `/images/deltarune-screenshot${i + 1}.jpg`),
        about:
            'Deltarune é um RPG criado por Toby Fox, o mesmo desenvolvedor de Undertale. O jogo apresenta uma nova ' +
            'história em um universo paralelo, com personagens inéditos e versões alternativas de rostos conhecidos.',
        synopsis:
            'Você controla Kris, um humano que, junto com Susie e Ralsei, embarca em uma jornada através do Dark World. ' +
            'O jogo mistura humor, mistério e escolhas que influenciam diretamente o rumo da narrativa.',
        gameplay: [
            'Sistema de combate por turnos com elementos bullet hell',
            'Possibilidade de lutar ou poupar inimigos',
            'Habilidades únicas para cada personagem',
        ],
        soundtrack:
            'A trilha sonora é composta pelo próprio Toby Fox, com músicas marcantes que reforçam a emoção e a identidade do jogo.',
    },
};

/* ---------------- helpers ---------------- */
const PLATFORM_ICONS = [
    [/playstation/i, 'bi-playstation'],
    [/xbox/i, 'bi-xbox'],
    [/nintendo|switch/i, 'bi-nintendo-switch'],
    [/\bpc\b|windows/i, 'bi-windows'],
    [/ios|android|mobile/i, 'bi-phone'],
    [/linux|mac/i, 'bi-pc-display'],
];
const platformIcon = (name) => PLATFORM_ICONS.find(([re]) => re.test(name))?.[1] || 'bi-controller';

const SAVED_KEY = 'gameatlas:jogos-salvos';
const readSaved = () => {
    try { return JSON.parse(localStorage.getItem(SAVED_KEY)) || []; } catch { return []; }
};

const formatDate = (date) => (date ? date.split('-').reverse().join('/') : 'Não informado');
const shorten = (text, max = 260) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);
const PLACEHOLDER = '/images/game-placeholder.svg';
const fallbackImg = (event) => { event.currentTarget.onerror = null; event.currentTarget.src = PLACEHOLDER; };
const MAX_DOTS = 12;

function genreSlug(name = '') {
    const n = name.trim().toLowerCase();
    return GENRES.find(([slug, label]) => label.toLowerCase() === n || slug === n.replace(/\s+/g, '-'))?.[0] || '';
}

/* ---------------- avaliação em estrelas (estilo Google Play) ---------------- */
const formatStars = (value) => value.toFixed(1).replace('.', ',');

function Stars({ value }) {
    const clamped = Math.max(0, Math.min(5, value));
    return (
        <span className="stars" role="img" aria-label={`${formatStars(clamped)} de 5 estrelas`}>
            <span className="stars-base" aria-hidden="true">★★★★★</span>
            <span className="stars-fill" aria-hidden="true" style={{ width: `${(clamped / 5) * 100}%` }}>★★★★★</span>
        </span>
    );
}

function RatingSummary({ publicStars, criticScore, ratings, count }) {
    const hasPublic = typeof publicStars === 'number' && publicStars > 0;
    const hasCritic = typeof criticScore === 'number';
    if (!hasPublic && !hasCritic) return null;

    return (
        <div className="rating">
            {hasPublic && (
                <div className="rating-main">
                    <div className="rating-score">
                        <strong>{formatStars(publicStars)}</strong>
                        <Stars value={publicStars} />
                        <span className="rating-count">
                            {count ? `${count.toLocaleString('pt-BR')} avaliações` : 'Avaliação do público'}
                        </span>
                    </div>

                    {ratings?.length > 0 && (
                        <div className="rating-bars" aria-hidden="true">
                            {[5, 4, 3, 2, 1].map((star) => {
                                const percent = ratings.find((item) => item.id === star)?.percent ?? 0;
                                return (
                                    <div key={star} className="rating-bar">
                                        <span>{star}</span>
                                        <div className="rating-track"><div style={{ width: `${percent}%` }} /></div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {hasCritic && (
                <div className="rating-critics">
                    <span>Críticos</span>
                    <Stars value={criticScore / 20} />
                    <strong>{criticScore}</strong><small>/100</small>
                </div>
            )}
        </div>
    );
}

/* ---------------- carrossel: vídeo primeiro + screenshots ---------------- */
function MediaCarousel({ items, alt }) {
    const [current, setCurrent] = useState(0);
    const [hover, setHover] = useState(false);
    const [paused, setPaused] = useState(false);
    const [volume, setVolume] = useState(1);
    const [progress, setProgress] = useState({ time: 0, duration: 0 });
    const videoRef = useRef(null);
    const thumbsRef = useRef(null);
    const thumbRefs = useRef([]);

    const total = items.length;
    const single = total === 1;
    const isVideo = items[current].type === 'video';
    const goTo = (index) => setCurrent((index + total) % total);

    // só monta a imagem atual e as vizinhas (evita baixar 40 imagens de uma vez)
    const isNear = (index) => {
        const distance = Math.abs(index - current);
        return Math.min(distance, total - distance) <= 1;
    };

    useEffect(() => {
        if (single || isVideo) return undefined;
        const timer = setTimeout(() => setCurrent((c) => (c + 1) % total), 6000);
        return () => clearTimeout(timer);
    }, [current, single, isVideo, total]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        if (isVideo) {
            video.play().then(() => setPaused(false)).catch(() => setPaused(true));
        } else {
            video.pause();
            video.currentTime = 0;
        }
    }, [isVideo]);

    useEffect(() => {
        const wrapper = thumbsRef.current;
        const thumb = thumbRefs.current[current];
        if (!wrapper || !thumb) return;
        wrapper.scrollTo({
            left: thumb.offsetLeft - (wrapper.clientWidth - thumb.offsetWidth) / 2,
            behavior: 'smooth',
        });
    }, [current]);

    // o vídeo começa mudo (regra de autoplay); libera o som no 1º clique
    useEffect(() => {
        const unmute = (event) => {
            if (event.target.closest('.video-controls') || !videoRef.current) return;
            videoRef.current.muted = false;
            setVolume(videoRef.current.volume);
            document.removeEventListener('click', unmute);
        };
        document.addEventListener('click', unmute);
        return () => document.removeEventListener('click', unmute);
    }, []);

    const togglePlay = () => {
        const video = videoRef.current;
        if (video.paused) { video.play(); setPaused(false); } else { video.pause(); setPaused(true); }
    };

    const volumeIcon = volume === 0 ? 'bi-volume-mute-fill' : volume < 0.5 ? 'bi-volume-down-fill' : 'bi-volume-up-fill';

    return (
        <div className="media">
            <div
                className="carouselgame"
                onMouseEnter={() => setHover(true)}
                onMouseLeave={() => setHover(false)}
            >
                {items.map((item, index) => {
                    if (item.type === 'video') {
                        return (
                            <video
                                key={item.src}
                                ref={videoRef}
                                src={item.src}
                                poster={item.poster || undefined}
                                className={index === current ? 'active' : ''}
                                preload="metadata"
                                playsInline
                                muted
                                onTimeUpdate={(e) => setProgress({ time: e.currentTarget.currentTime, duration: e.currentTarget.duration || 0 })}
                                onEnded={() => goTo(current + 1)}
                            />
                        );
                    }
                    if (!isNear(index)) return null;
                    return (
                        <img
                            key={item.src}
                            src={item.src}
                            alt={index === current ? alt : ''}
                            className={index === current ? 'active' : ''}
                            onError={fallbackImg}
                        />
                    );
                })}

                {!single && (
                    <>
                        <button type="button" className="carousel-arrow left" aria-label="Anterior" onClick={() => goTo(current - 1)}>
                            <i className="bi bi-chevron-left"></i>
                        </button>
                        <button type="button" className="carousel-arrow right" aria-label="Próxima" onClick={() => goTo(current + 1)}>
                            <i className="bi bi-chevron-right"></i>
                        </button>

                        <div className={`carousel-dots${isVideo ? ' above-controls' : ''}`}>
                            {total <= MAX_DOTS ? items.map((item, index) => (
                                <button
                                    key={item.src}
                                    type="button"
                                    className={index === current ? 'active' : ''}
                                    aria-label={`Ir para a mídia ${index + 1}`}
                                    onClick={() => goTo(index)}
                                />
                            )) : <span className="carousel-counter">{current + 1} / {total}</span>}
                        </div>
                    </>
                )}

                <div
                    className="video-controls"
                    style={{
                        display: isVideo ? '' : 'none',
                        opacity: hover ? 1 : 0,
                        pointerEvents: hover ? 'all' : 'none',
                    }}
                >
                    <button type="button" onClick={togglePlay} aria-label={paused ? 'Reproduzir' : 'Pausar'}>
                        <i className={`bi ${paused ? 'bi-play-fill' : 'bi-pause-fill'}`}></i>
                    </button>
                    <input
                        type="range"
                        id="videoProgress"
                        min="0"
                        step="0.1"
                        max={progress.duration || 0}
                        value={progress.time}
                        onChange={(e) => { videoRef.current.currentTime = Number(e.target.value); }}
                    />
                    <div className="volume-wrap">
                        <i className={`bi ${volumeIcon}`}></i>
                        <input
                            type="range"
                            id="videoVolume"
                            min="0"
                            max="1"
                            step="0.05"
                            value={volume}
                            onChange={(e) => {
                                const value = Number(e.target.value);
                                videoRef.current.volume = value;
                                setVolume(value);
                            }}
                        />
                    </div>
                </div>
            </div>

            {!single && (
                <div className="thumbnails-wrapper" ref={thumbsRef} style={{ position: 'relative' }}>
                    <div className="thumbnails">
                        {items.map((item, index) => (
                            <div
                                key={item.src}
                                ref={(el) => { thumbRefs.current[index] = el; }}
                                className={`thumb${index === current ? ' active' : ''}${item.type === 'video' ? ' is-video' : ''}`}
                                onClick={() => goTo(index)}
                            >
                                <img
                                    src={item.type === 'video' ? (item.poster || PLACEHOLDER) : item.src}
                                    alt=""
                                    loading="lazy"
                                    onError={fallbackImg}
                                />
                                {item.type === 'video' && <i className="bi bi-play-circle-fill"></i>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ---------------- jogos similares ---------------- */
function SimilarGames({ gameId, genre }) {
    const { results } = useGames({ genre });
    const similar = results.filter((g) => g.id !== gameId).slice(0, 4);
    if (!similar.length) return null;

    return (
        <div className="box-similar">
            <h2>Jogos similares</h2>
            <div className="similar-list">
                {similar.map((s) => (
                    <Link key={s.id} className="similar-item" to={`/jogo/${s.id}`}>
                        <img src={s.image || PLACEHOLDER} alt="" onError={fallbackImg} />
                        <span>{s.title}</span>
                    </Link>
                ))}
            </div>
        </div>
    );
}

/* ---------------- conteúdo da página ---------------- */
function GameDetails({ game, reload }) {
    const extras = GAME_EXTRAS[game.slug] || {};
    const id = String(game.id);
    const [saved, setSaved] = useState(() => readSaved().includes(id));

    const toggleSave = () => {
        const list = readSaved();
        const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
        try { localStorage.setItem(SAVED_KEY, JSON.stringify(next)); } catch { /* sem localStorage */ }
        setSaved(next.includes(id));
    };

    const publicStars = extras.publicScore !== undefined ? extras.publicScore / 20 : game.rawg_rating;
    const criticScore = extras.criticScore ?? game.metacritic;
    const tags = extras.tags || [...(game.genres || []), game.multiplayer && 'Multiplayer'].filter(Boolean);
    const unavailable = game.description_translation === 'unavailable';
    const fullDescription = game.description || 'Descrição não disponível na RAWG.';

    const infoList = [
        ['Gênero', game.genre],
        ['Modo', game.multiplayer ? 'Multiplayer' : 'Single-player'],
        ['Lançamento', formatDate(game.released)],
        game.playtime ? ['Tempo médio de jogo', `${game.playtime} horas`] : null,
    ].filter(Boolean);

    // vídeo (se existir) sempre primeiro, depois todas as screenshots
    const mediaItems = useMemo(() => {
        const cover = game.banner || game.image;
        const trailer = extras.trailer || game.trailer;
        const shots = extras.screenshots?.length ? extras.screenshots : (game.screenshots || []);
        const items = [];

        if (trailer?.src) items.push({ type: 'video', src: trailer.src, poster: trailer.poster || cover });
        [...new Set(shots)].forEach((src) => items.push({ type: 'image', src }));
        if (!items.some((item) => item.type === 'image')) items.push({ type: 'image', src: cover || PLACEHOLDER });
        return items;
    }, [extras, game.trailer, game.screenshots, game.banner, game.image]);

    const slug = genreSlug(game.genres?.[0]);

    return (
        <div className="top-container">

            {/* COLUNA ESQUERDA */}
            <div className="col-left">
                <MediaCarousel items={mediaItems} alt={game.title} />

                <div className="box-left">
                    <h2>Sobre o jogo</h2>
                    {unavailable ? (
                        <div role="status">
                            <p>Descrição indisponível no momento.</p>
                            <button className="api-button" type="button" onClick={reload}>Carregar descrição novamente</button>
                        </div>
                    ) : (
                        <p className="api-description" lang="pt-BR">{extras.about || fullDescription}</p>
                    )}

                    {extras.synopsis && <div className="game-section"><h3>Sinopse</h3><p>{extras.synopsis}</p></div>}
                    {extras.gameplay && (
                        <div className="game-section">
                            <h3>Gameplay</h3>
                            <ul>{extras.gameplay.map((g) => <li key={g}>{g}</li>)}</ul>
                        </div>
                    )}
                    {extras.soundtrack && <div className="game-section"><h3>Trilha sonora</h3><p>{extras.soundtrack}</p></div>}

                    <div className="game-section">
                        <h3>Informações</h3>
                        <ul className="info-list">
                            {infoList.map(([label, value]) => (
                                <li key={label}><strong>{label}:</strong> {value}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            {/* COLUNA DIREITA */}
            <div className="col-right">

                <div className="info">
                    <div className="info-header">
                        <h1>{game.title}</h1>
                        <button
                            type="button"
                            className={`btn-save${saved ? ' saved' : ''}`}
                            title={saved ? 'Remover dos salvos' : 'Salvar jogo'}
                            aria-pressed={saved}
                            onClick={toggleSave}
                        >
                            <i className={`bi ${saved ? 'bi-bookmark-fill' : 'bi-bookmark'}`}></i>
                        </button>
                    </div>

                    <p className="meta">
                        {game.developers.length > 0 && <><strong>Autor:</strong> {game.developers.join(', ')}<br /></>}
                        {game.publishers.length > 0 && <><strong>Publicadora:</strong> {game.publishers.join(', ')}<br /></>}
                        <strong>Ano:</strong> {game.year ?? 'Não informado'}
                    </p>

                    <p className="desc">
                        {extras.longDescription || shorten(unavailable ? 'Descrição indisponível no momento.' : fullDescription)}
                    </p>

                    <div className="tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>

                    <RatingSummary
                        publicStars={publicStars}
                        criticScore={criticScore}
                        ratings={game.ratings}
                        count={game.ratings_count}
                    />

                    {game.website && (
                        <a className="site-link" href={game.website} target="_blank" rel="noreferrer">
                            <i className="bi bi-box-arrow-up-right"></i> Site oficial
                        </a>
                    )}
                </div>

                <div className="col-right-bottom">
                    <div className="game-platforms">
                        <h2>Plataformas</h2>
                        <div className="platforms">
                            {(game.platforms?.length ? game.platforms : [game.platform]).map((p) => (
                                <span key={p}><i className={`bi ${platformIcon(p)}`}></i> {p}</span>
                            ))}
                        </div>
                    </div>

                    {slug && <SimilarGames gameId={game.id} genre={slug} />}
                </div>
            </div>
        </div>
    );
}

/* ---------------- página /jogo/:id ---------------- */
export default function Jogo() {
    const { id } = useParams();
    const { game, loading, error, reload } = useGame(id);
    const navigate = useNavigate();
    const location = useLocation();
    const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/explorar'));

    useEffect(() => {
        document.title = game ? `${game.title} • GameAtlas` : 'GameAtlas';
    }, [game]);

    return (
        <>
            <Navbar />
            <main className="page-container">
                <nav className="game-tabs" aria-label="Seções do jogo">
                    <button type="button" className="back-button" aria-label="Voltar" onClick={goBack}>
                        <i className="bi bi-chevron-left" aria-hidden="true"></i>
                    </button>
                    <Link to={`/jogo/${encodeURIComponent(id)}`} className="active" aria-current="page">Visão Geral</Link>
                    <Link to={`/reviews?jogo=${encodeURIComponent(id)}`}>Reviews</Link>
                </nav>

                <ApiFeedback loading={loading} error={error} onRetry={reload} />
                {game && <GameDetails key={game.id} game={game} reload={reload} />}
            </main>
            <Footer />
        </>
    );
}