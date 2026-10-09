import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ApiFeedback from '../components/ApiFeedback';
import GameAccount, { GameSaveButton } from '../components/GameAccount';
import { useGame } from '../hooks/useGame';
import { useGames } from '../hooks/useGames';
import { GENRES } from '../services/search-options';
import '../styles/components.css';
import '../styles/api.css';
import '../styles/Jogo.css'; // trecho "/*GAME*/" do css/style.css

/* ================================================================
   DETALHES EXTRAS (opcionais), indexados pelo slug da RAWG.
   Só os jogos listados aqui têm trailer, screenshots, sinopse etc.
   Os arquivos de mídia precisam estar em public/images e public/videos.
   ================================================================ */
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

/* ================================================================
   HELPERS
   ================================================================ */
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
const shorten = (text, max = 280) => (text.length > max ? `${text.slice(0, max).trimEnd()}…` : text);
const PLACEHOLDER = '/images/game-placeholder.svg';
const fallbackImg = (event) => { event.currentTarget.onerror = null; event.currentTarget.src = PLACEHOLDER; };

// tenta descobrir o slug do gênero (usado em /explorar) a partir do nome vindo da API
function genreSlug(name = '') {
    const n = name.trim().toLowerCase();
    return GENRES.find(([slug, label]) => label.toLowerCase() === n || slug === n.replace(/\s+/g, '-'))?.[0] || '';
}

/* ================================================================
   GRÁFICO DE NOTA (antes: drawChart no <canvas>)
   ================================================================ */
function ScoreChart({ score, color, label }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const ctx = canvasRef.current.getContext('2d');
        const r = 35, cx = 40, cy = 40;
        const angle = (score / 100) * 2 * Math.PI;

        ctx.clearRect(0, 0, 80, 80);

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.fillStyle = '#1a0f2e';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + angle);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(cx, cy, 22, 0, 2 * Math.PI);
        ctx.fillStyle = '#2a2230';
        ctx.fill();
    }, [score, color]);

    return (
        <div className="chart-item">
            <canvas ref={canvasRef} width="80" height="80" />
            <span className="chart-label">{label}<br /><strong>{score}</strong></span>
        </div>
    );
}

/* ================================================================
   CARROSSEL DE MÍDIA (trailer + screenshots)
   ================================================================ */
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

    // avanço automático só nas imagens (o vídeo avança quando termina)
    useEffect(() => {
        if (single || isVideo) return undefined;
        const timer = setTimeout(() => setCurrent((c) => (c + 1) % total), 6000);
        return () => clearTimeout(timer);
    }, [current, single, isVideo, total]);

    // toca o vídeo ao entrar nele e reinicia ao sair
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

    // centraliza a miniatura ativa sem rolar a página
    useEffect(() => {
        const wrapper = thumbsRef.current;
        const thumb = thumbRefs.current[current];
        if (!wrapper || !thumb) return;
        wrapper.scrollTo({
            left: thumb.offsetLeft - (wrapper.clientWidth - thumb.offsetWidth) / 2,
            behavior: 'smooth',
        });
    }, [current]);

    // o vídeo começa mudo (regra de autoplay); libera o som no 1º clique na página
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
                {items.map((item, index) => (item.type === 'video' ? (
                    <video
                        key={item.src}
                        ref={videoRef}
                        src={item.src}
                        poster={item.poster}
                        className={index === current ? 'active' : ''}
                        preload="metadata"
                        playsInline
                        muted
                        onTimeUpdate={(e) => setProgress({ time: e.currentTarget.currentTime, duration: e.currentTarget.duration || 0 })}
                        onEnded={() => goTo(current + 1)}
                    />
                ) : (
                    <img
                        key={item.src}
                        src={item.src}
                        alt={alt}
                        className={index === current ? 'active' : ''}
                        onError={fallbackImg}
                    />
                )))}

                {!single && (
                    <>
                        <button type="button" className="carousel-arrow left" aria-label="Anterior" onClick={() => goTo(current - 1)}>
                            <i className="bi bi-chevron-left"></i>
                        </button>
                        <button type="button" className="carousel-arrow right" aria-label="Próxima" onClick={() => goTo(current + 1)}>
                            <i className="bi bi-chevron-right"></i>
                        </button>
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
                            <img
                                key={item.src}
                                ref={(el) => { thumbRefs.current[index] = el; }}
                                src={item.type === 'video' ? (item.poster || PLACEHOLDER) : item.src}
                                alt=""
                                className={index === current ? 'active' : ''}
                                onClick={() => goTo(index)}
                                onError={fallbackImg}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ================================================================
   JOGOS SIMILARES (mesmo gênero, via API)
   ================================================================ */
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

/* ================================================================
   DETALHES DO JOGO
   ================================================================ */
function GameDetails({ game, reload }) {
    const extras = GAME_EXTRAS[game.slug] || {};
    const publicScore = extras.publicScore ?? (game.rawg_rating !== null ? Math.round(game.rawg_rating * 20) : null);
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

    const mediaItems = [];
    if (extras.trailer) mediaItems.push({ type: 'video', ...extras.trailer });
    (extras.screenshots || []).forEach((src) => mediaItems.push({ type: 'image', src }));
    if (!mediaItems.length) mediaItems.push({ type: 'image', src: game.banner || game.image || PLACEHOLDER });

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

                    {extras.synopsis && (
                        <div className="game-section"><h3>Sinopse</h3><p>{extras.synopsis}</p></div>
                    )}
                    {extras.gameplay && (
                        <div className="game-section">
                            <h3>Gameplay</h3>
                            <ul>{extras.gameplay.map((g) => <li key={g}>{g}</li>)}</ul>
                        </div>
                    )}
                    {extras.soundtrack && (
                        <div className="game-section"><h3>Trilha sonora</h3><p>{extras.soundtrack}</p></div>
                    )}

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
                        <GameSaveButton game={game} />
                    </div>

                    <p className="meta">
                        {game.developers.length > 0 && <><strong>Autor:</strong> {game.developers.join(', ')}<br /></>}
                        {game.publishers.length > 0 && <><strong>Publicadora:</strong> {game.publishers.join(', ')}<br /></>}
                        <strong>Ano:</strong> {game.year ?? 'Não informado'}
                    </p>

                    <p className="desc">{extras.longDescription || shorten(unavailable ? 'Descrição indisponível no momento.' : fullDescription)}</p>

                    <div className="tags">{tags.map((t) => <span key={t}>{t}</span>)}</div>

                    <div className="review-row">
                        {publicScore !== null && <ScoreChart score={publicScore} color="#B39EB5" label="Público" />}
                        {typeof criticScore === 'number' && <ScoreChart score={criticScore} color="#9333EA" label="Críticos" />}
                    </div>

                    <Link to={`/reviews?jogo=${encodeURIComponent(game.id)}`} className="btn-reviews">
                        Ir para as reviews
                    </Link>

                    {game.website && (
                        <p><a className="api-link" href={game.website} target="_blank" rel="noreferrer">Site oficial</a></p>
                    )}
                </div>

                <GameAccount game={game} />
                <div className="col-right-bottom">
                    <div className="box-right">
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

/* ================================================================
   PÁGINA — /jogo/:id
   ================================================================ */
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
                <button type="button" className="back-button" aria-label="Voltar" onClick={goBack}>
                    <i className="bi bi-chevron-left" aria-hidden="true"></i>
                </button>
                <ApiFeedback loading={loading} error={error} onRetry={reload} />
                {game && <GameDetails key={game.id} game={game} reload={reload} />}
            </main>
            <Footer />
        </>
    );
}
