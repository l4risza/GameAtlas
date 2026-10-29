import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ProfileTabs from '../components/ProfileTabs';
import ReviewCard from '../components/ReviewCard';
import ApiFeedback from '../components/ApiFeedback';
import { useAuth } from '../context/auth-context';
import { useProfile } from '../hooks/useProfile';
import { accountError } from '../services/supabase';
import { loadLists, loadReviews } from '../services/account';
import { SOCIAL_NETWORKS } from '../services/settings-validation';
import '../styles/components.css';
import '../styles/perfil.css';

const EMPTY_MESSAGE = { reviews: 'Você ainda não avaliou nenhum jogo.', listas: 'Você ainda não criou uma lista.' };

export function ProfileItems({ tab, items }) {
    if (tab === 'reviews') return items.map((review) => <ReviewCard key={review.id} review={review} showAuthor={false} />);
    return items.map((list) => (
        <article className="review-card review-card--list" key={list.id}>
            <div className="review-card-body">
                <div className="review-card-head">
                    <h3 className="review-card-title"><Link to={`/listas/${list.id}`}>{list.nome}</Link></h3>
                    <span>{list.publica ? 'Pública' : 'Privada'}</span>
                </div>
                {list.descricao && <p className="review-card-text">{list.descricao}</p>}
            </div>
        </article>
    ));
}

// Conteúdo da aba (reviews ou listas). "VER MAIS" carrega a próxima página e acrescenta ao que já está na tela.
function ProfileContent({ userId, tab, order }) {
    const [state, setState] = useState({ items: [], count: 0, page: 0, loading: true, error: '' });
    const [attempt, setAttempt] = useState(0);
    const fetchPage = useCallback((page) => (tab === 'reviews'
        ? loadReviews(page, userId, undefined, order)
        : loadLists(page, userId, order)), [tab, userId, order]);

    useEffect(() => {
        let active = true;
        fetchPage(1)
            .then((data) => { if (active) setState({ items: data.items, count: data.count, page: 1, loading: false, error: '' }); })
            .catch((error) => { if (active) setState((current) => ({ ...current, loading: false, error: accountError(error) })); });
        return () => { active = false; };
    }, [fetchPage, attempt]);

    async function loadMore() {
        setState((current) => ({ ...current, loading: true, error: '' }));
        try {
            const data = await fetchPage(state.page + 1);
            setState((current) => ({ items: [...current.items, ...data.items], count: data.count, page: current.page + 1, loading: false, error: '' }));
        } catch (error) {
            setState((current) => ({ ...current, loading: false, error: accountError(error) }));
        }
    }
    function retry() {
        if (state.page > 0) { loadMore(); return; }
        setState((current) => ({ ...current, loading: true, error: '' }));
        setAttempt((value) => value + 1);
    }

    const { items, count, loading, error } = state;
    return (
        <section className="profile-content">
            {loading && items.length === 0 && <p className="carousel-loading" role="status">Carregando...</p>}
            <ApiFeedback loading={false} error={error} onRetry={retry} />
            {!loading && !error && items.length === 0 && <p className="carousel-loading">{EMPTY_MESSAGE[tab]}</p>}

            <ProfileItems tab={tab} items={items} />

            {items.length < count && !error && (
                <button type="button" className="profile-ver-mais" disabled={loading} onClick={loadMore}>
                    {loading ? 'CARREGANDO...' : 'VER MAIS'}
                </button>
            )}
        </section>
    );
}

// Parte visual do perfil (o desenho original). Recebe o perfil já carregado do banco.
export function ProfileView({ profile, tab, onTabChange }) {
    // Abas escolhidas em Configurações > "Mostrar no perfil".
    const visibleTabs = [['reviews', profile.mostrar_reviews], ['listas', profile.mostrar_listas]]
        .filter(([, shown]) => shown).map(([key]) => key);
    const activeTab = visibleTabs.includes(tab) ? tab : visibleTabs[0];
    const order = activeTab === 'listas' ? profile.ordem_listas : profile.ordem_reviews;

    return (
        <>
            <section className="profile-card">
                <div className="profile-top">
                    <div className="profile-photo-box">
                        <img src={profile.avatar_url || '/images/perfil.png'} alt="Foto de perfil" className="profile-photo" />
                    </div>

                    <div className="profile-info">
                        <h2>{profile.nome}</h2>
                        {profile.username && <p>@{profile.username}</p>}
                    </div>

                    <div className="profile-socials">
                        {profile.redes_sociais.map((item) => {
                            const info = SOCIAL_NETWORKS[item.rede];
                            if (!/^https:\/\//i.test(item.url)) return null;
                            return (
                                <a key={item.rede} href={item.url} target="_blank" rel="noopener noreferrer"
                                    className="btn-rede" aria-label={info?.label ?? item.rede} title={info?.label ?? item.rede}>
                                    <i className={`bi ${info?.icon ?? 'bi-link-45deg'}`}></i>
                                </a>
                            );
                        })}
                        <Link to="/configuracoes" className="btn-rede profile-edit">
                            <i className="bi bi-pencil-square" aria-hidden="true"></i> Editar perfil
                        </Link>
                    </div>
                </div>

                <section className="info-card">
                    <h3 className="profile-section-title">
                        <i className="bi bi-person-fill"></i> Sobre Mim
                    </h3>
                    <hr />
                    {profile.jogos_favoritos.length > 0 && (
                        <div className="jogos-fav">
                            {profile.jogos_favoritos.map((game) => (
                                <span className="tag-jogo-fav" key={game}>
                                    {game}
                                </span>
                            ))}
                        </div>
                    )}
                    {profile.bio ? (
                        <p className="profile-texto">{profile.bio}</p>
                    ) : (
                        <p className="profile-texto profile-texto--empty">
                            Ainda não há nada por aqui. <Link to="/configuracoes">Edite seu perfil</Link> para contar um pouco sobre você.
                        </p>
                    )}
                </section>
            </section>

            {activeTab ? (
                <>
                    <ProfileTabs active={activeTab} onChange={onTabChange} tabs={visibleTabs} />
                    <ProfileContent key={`${activeTab}:${order}`} userId={profile.id} tab={activeTab} order={order} />
                </>
            ) : (
                <p className="carousel-loading">
                    Você ocultou reviews e listas do seu perfil. <Link to="/configuracoes">Mudar em Configurações</Link>
                </p>
            )}
        </>
    );
}

export default function Perfil() {
    const { user, loading: authLoading, configured, error: authError } = useAuth();
    const location = useLocation();
    const { profile, loading, error, reload } = useProfile();
    const [tab, setTab] = useState('reviews');

    if (configured && !authLoading && !user) {
        return <Navigate to={`/login?voltar=${encodeURIComponent(location.pathname + location.search)}`} replace />;
    }

    return (
        <>
            <Navbar />

            <main className="profile-page">
                {!configured ? (
                    <p role="alert">{authError || 'A conexão com o banco ainda não está configurada.'}</p>
                ) : (authLoading || loading) && !profile ? (
                    <p className="carousel-loading" role="status">Carregando perfil...</p>
                ) : (
                    <ApiFeedback loading={false} error={error} onRetry={reload} />
                )}

                {profile && <ProfileView profile={profile} tab={tab} onTabChange={setTab} />}
            </main>

            <Footer />
        </>
    );
}
