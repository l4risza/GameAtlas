import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ApiFeedback from '../components/ApiFeedback';
import GameAccount, { GameSaveButton } from '../components/GameAccount';
import { useGame } from '../hooks/useGame';
import { useGames } from '../hooks/useGames';
import '../styles/components.css';
import '../styles/api.css';
import '../styles/Jogo.css';

/* Extras opcionais por slug. Sobrescrevem a mídia da IGDB (arquivos em public/). */
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
// Referência estável para jogos sem extras (evita recriar o useMemo a cada render).
const NO_EXTRAS = {};

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

const formatDate = (date) => (date ? date.split('-').reverse().join('/') : 'Não informado');
const shorten = (text, max = 260) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);
const PLACEHOLDER = '/images/game-placeholder.svg';
const fallbackImg = (event) => { event.currentTarget.onerror = null; event.currentTarget.src = PLACEHOLDER; };
const MAX_DOTS = 12;

const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${minutes}:${rest}`;
};

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

/* ---------------- carrossel: trailer primeiro + screenshots ---------------- */
function MediaCarousel({ items, alt, onVideoError }) {
    const [current, setCurrent] = useState(0);
    const [hover, setHover] = useState(false);
    const [paused, setPaused] = useState(true);
    const [muted, setMuted] = useState(true);
    const [volume, setVolume] = useState(1);
    const [time, setTime] = useState({ now: 0, total: 0 });
    const [fullscreen, setFullscreen] = useState(false);
    const boxRef = useRef(null);
    const videoRef = useRef(null);
    const thumbsRef = useRef(null);
    const thumbRefs = useRef([]);

    const total = items.length;
    const single = total === 1;
    const isVideo = items[current].type === 'video';
    const isYoutube = items[current].type === 'youtube';
    const showControls = isVideo && (hover || paused);
    const percent = time.total ? (time.now / time.total) * 100 : 0;
    const goTo = (index) => setCurrent((index + total) % total);

    // só monta a imagem atual e as vizinhas (evita baixar dezenas de imagens de uma vez)
    const isNear = (index) => {
        const distance = Math.abs(index - current);
        return Math.min(distance, total - distance) <= 1;
    };

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;
        if (video.paused) video.play().catch(() => { });
        else video.pause();
    };

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;
        video.muted = !video.muted;
        if (!video.muted && video.volume === 0) video.volume = 0.5;
    };

    const changeVolume = (value) => {
        const video = videoRef.current;
        if (!video) return;
        video.volume = value;
        video.muted = value === 0;
    };

    const seek = (value) => {
        if (videoRef.current) videoRef.current.currentTime = value;
    };

    const toggleFullscreen = () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else boxRef.current?.requestFullscreen?.();
    };

    const onKeyDown = (event) => {
        if (['INPUT', 'BUTTON'].includes(event.target.tagName)) return;
        if (event.key === 'ArrowLeft') { event.preventDefault(); goTo(current - 1); }
        else if (event.key === 'ArrowRight') { event.preventDefault(); goTo(current + 1); }
        else if ((event.key === ' ' || event.key === 'k') && isVideo) { event.preventDefault(); togglePlay(); }
        else if (event.key === 'm' && isVideo) toggleMute();
        else if (event.key === 'f') toggleFullscreen();
    };

    // imagens avançam sozinhas; o trailer avança quando termina
    useEffect(() => {
        if (single || isVideo || isYoutube) return undefined;
        const timer = setTimeout(() => setCurrent((c) => (c + 1) % total), 6000);
        return () => clearTimeout(timer);
    }, [current, single, isVideo, isYoutube, total]);


    // toca o trailer ao entrar nele e reinicia ao sair
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;
        if (isVideo) {
            video.play().catch(() => { });
        } else {
            video.pause();
            video.currentTime = 0;
        }
    }, [isVideo])

    // mantém a miniatura ativa centralizada sem rolar a página
    useEffect(() => {
        const wrapper = thumbsRef.current;
        const thumb = thumbRefs.current[current];
        if (!wrapper || !thumb) return;
        wrapper.scrollTo({
            left: thumb.offsetLeft - (wrapper.clientWidth - thumb.offsetWidth) / 2,
            behavior: 'smooth',
        });
    }, [current]);

    useEffect(() => {
        const onChange = () => setFullscreen(document.fullscreenElement === boxRef.current);
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const volumeIcon = muted || volume === 0
        ? 'bi-volume-mute-fill'
        : volume < 0.5 ? 'bi-volume-down-fill' : 'bi-volume-up-fill';

    return (
        <div className="media">
            <div
                ref={boxRef}
                className="carouselgame"
                tabIndex={0}
                role="region"
                aria-label="Trailer e screenshots do jogo"
                onKeyDown={onKeyDown}
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
                                onClick={togglePlay}
                                onPlay={(e) => setPaused(e.currentTarget.paused)}
                                onPause={(e) => setPaused(e.currentTarget.paused)}
                                onVolumeChange={(e) => { setMuted(e.currentTarget.muted); setVolume(e.currentTarget.volume); }}
                                onLoadedMetadata={(e) => setTime({ now: e.currentTarget.currentTime, total: e.currentTarget.duration || 0 })}
                                onTimeUpdate={(e) => setTime({ now: e.currentTarget.currentTime, total: e.currentTarget.duration || 0 })}
                                onEnded={() => goTo(current + 1)}
                                onError={onVideoError}
                            />
                        );
                    }
                    if (item.type === 'youtube') {
                        if (index !== current) return null;
                        return (
                            <iframe
                                key={item.src}
                                src={item.src}
                                title="Trailer do jogo"
                                className="active"
                                allow="encrypted-media; picture-in-picture; fullscreen"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allowFullScreen
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

                {isVideo && paused && (
                    <button type="button" className="big-play" aria-label="Reproduzir trailer" onClick={togglePlay}>
                        <i className="bi bi-play-fill"></i>
                    </button>
                )}

                {!single && (
                    <>
                        <button type="button" className="carousel-arrow left" aria-label="Anterior" onClick={() => goTo(current - 1)}>
                            <i className="bi bi-chevron-left"></i>
                        </button>
                        <button type="button" className="carousel-arrow right" aria-label="Próxima" onClick={() => goTo(current + 1)}>
                            <i className="bi bi-chevron-right"></i>
                        </button>

                        <div className={`carousel-dots${isVideo || isYoutube ? ' above-controls' : ''}`}>
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

                {isVideo && (
                    <div className={`video-controls${showControls ? ' visible' : ''}`}>
                        <button type="button" onClick={togglePlay} aria-label={paused ? 'Reproduzir' : 'Pausar'}>
                            <i className={`bi ${paused ? 'bi-play-fill' : 'bi-pause-fill'}`}></i>
                        </button>

                        <span className="vc-time">{formatTime(time.now)} / {formatTime(time.total)}</span>

                        <input
                            type="range"
                            className="vc-range vc-progress"
                            aria-label="Progresso do vídeo"
                            min="0"
                            step="0.1"
                            max={time.total || 0}
                            value={time.now}
                            style={{ '--fill': `${percent}%` }}
                            onChange={(e) => seek(Number(e.target.value))}
                        />

                        <div className="volume-wrap">
                            <button type="button" onClick={toggleMute} aria-label={muted ? 'Ativar som' : 'Silenciar'}>
                                <i className={`bi ${volumeIcon}`}></i>
                            </button>
                            <input
                                type="range"
                                className="vc-range vc-volume"
                                aria-label="Volume"
                                min="0"
                                max="1"
                                step="0.05"
                                value={muted ? 0 : volume}
                                style={{ '--fill': `${(muted ? 0 : volume) * 100}%` }}
                                onChange={(e) => changeVolume(Number(e.target.value))}
                            />
                        </div>

                        <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? 'Sair da tela cheia' : 'Tela cheia'}>
                            <i className={`bi ${fullscreen ? 'bi-fullscreen-exit' : 'bi-fullscreen'}`}></i>
                        </button>
                    </div>
                )}
            </div>

            {!single && (
                <div className="thumbnails-wrapper" ref={thumbsRef} style={{ position: 'relative' }}>
                    <div className="thumbnails">
                        {items.map((item, index) => (
                            <div
                                key={item.src}
                                ref={(el) => { thumbRefs.current[index] = el; }}
                                className={`thumb${index === current ? ' active' : ''}${item.type !== 'image' ? ' is-video' : ''}`}
                                onClick={() => goTo(index)}
                            >
                                <img
                                    src={item.type !== 'image' ? (item.poster || PLACEHOLDER) : item.src}
                                    alt=""
                                    loading="lazy"
                                    onError={fallbackImg}
                                />
                                {item.type !== 'image' && <i className="bi bi-play-circle-fill"></i>}
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
    const extras = GAME_EXTRAS[game.slug] || NO_EXTRAS;
    const [videoFailed, setVideoFailed] = useState(false);

    const publicStars = extras.publicScore !== undefined ? extras.publicScore / 20 : game.public_stars;
    const criticScore = extras.criticScore ?? game.critic_score;
    const tags = extras.tags || [...(game.genres || []), game.multiplayer && 'Multiplayer'].filter(Boolean);
    const unavailable = game.description_translation === 'unavailable';
    const fullDescription = game.description || 'Descrição não disponível.';

    const infoList = [
        ['Gênero', game.genre],
        ['Modo', game.multiplayer ? 'Multiplayer' : 'Single-player'],
        ['Lançamento', formatDate(game.released)],
        game.playtime ? ['Tempo médio de jogo', `${game.playtime} horas`] : null,
    ].filter(Boolean);

    // trailer (se existir e carregar) sempre primeiro, depois todas as screenshots
    const mediaItems = useMemo(() => {
        const cover = game.banner || game.image;
        const trailer = extras.trailer || game.trailer;
        const shots = extras.screenshots?.length ? extras.screenshots : (game.screenshots || []);
        const items = [];

        if (trailer?.src && !videoFailed) items.push({ type: 'video', src: trailer.src, poster: trailer.poster || cover });

        if (trailer?.youtubeId) {
            items.push({
                type: 'youtube',
                src: `https://www.youtube-nocookie.com/embed/${trailer.youtubeId}`,
                poster: `https://img.youtube.com/vi/${trailer.youtubeId}/hqdefault.jpg`,
            });
        }

        [...new Set(shots)].forEach((src) => items.push({ type: 'image', src }));
        if (!items.some((item) => item.type === 'image')) items.push({ type: 'image', src: cover || PLACEHOLDER });
        return items;
    }, [extras, game.trailer, game.screenshots, game.banner, game.image, videoFailed]);

    const slug = game.genre_slugs?.[0];

    return (
        <div className="top-container">

            {/* COLUNA ESQUERDA */}
            <div className="col-left">
                <MediaCarousel
                    key={mediaItems.length}
                    items={mediaItems}
                    alt={game.title}
                    onVideoError={() => setVideoFailed(true)}
                />

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

                {/* avaliar o jogo e adicionar às listas (conta do usuário) */}
                <GameAccount game={game} />
            </div>

            {/* COLUNA DIREITA */}
            <div className="col-right">

                <div className="info">
                    <div className="info-header">
                        <h1>{game.title}</h1>
                        <GameSaveButton game={game} />
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
                    <div className="box-right">
                        <h2>Plataformas</h2>
                        <div className="game-platforms">
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
            <div className="game-page">
                <div className="game-hero-band" aria-hidden="true"></div>

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
            </div>
            <Footer />
        </>
    );
}