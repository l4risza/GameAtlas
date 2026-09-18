import { useState } from 'react';
import Navbar from '../components/Navbar';
import ProfileTabs from '../components/ProfileTabs';
import ReviewCard from '../components/ReviewCard';
import { useProfile } from '../hooks/useProfile';
import '../styles/components.css';

const PAGE_SIZE = 3;

export default function Profile() {
    const { profile, loading } = useProfile();
    const [tab, setTab] = useState('reviews');
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    const handleTabChange = (newTab) => {
        setTab(newTab);
        setVisibleCount(PAGE_SIZE);
    };

    if (loading || !profile) {
        return (
            <>
                <Navbar />
                <p className="carousel-loading" style={{ paddingTop: '110px' }}>
                    Carregando perfil...
                </p>
            </>
        );
    }

    const items = tab === 'reviews' ? profile.reviews : profile.lists;
    const visibleItems = items.slice(0, visibleCount);
    const hasMore = visibleCount < items.length;

    return (
        <>
            <Navbar />

            <main className="profile-page">
                <section className="profile-card">
                    <div className="profile-top">
                        <div className="profile-photo-box">
                            <img src={profile.avatar} alt="Foto de perfil" className="profile-photo" />
                        </div>

                        <div className="profile-info">
                            <h2>{profile.displayName}</h2>
                            <p>@{profile.username}</p>
                        </div>

                        <div className="profile-socials">
                            {profile.socials.linkedin && (
                                <a href={profile.socials.linkedin} target="_blank" rel="noreferrer" className="btn-rede">
                                    <i className="bi bi-linkedin"></i>
                                </a>
                            )}
                            {profile.socials.github && (
                                <a href={profile.socials.github} target="_blank" rel="noreferrer" className="btn-rede">
                                    <i className="bi bi-github"></i>
                                </a>
                            )}
                            {profile.socials.instagram && (
                                <a href={profile.socials.instagram} target="_blank" rel="noreferrer" className="btn-rede">
                                    <i className="bi bi-instagram"></i>
                                </a>
                            )}
                        </div>
                    </div>

                    <section className="info-card">
                        <h3 className="profile-section-title">
                            <i className="bi bi-person-fill"></i> Sobre Mim
                        </h3>
                        <hr />
                        <div className="jogos-fav">
                            {profile.favoriteGames.map((game) => (
                                <span className="tag-jogo-fav" key={game}>
                                    {game}
                                </span>
                            ))}
                        </div>
                        <p className="profile-texto">{profile.bio}</p>
                    </section>
                </section>

                <ProfileTabs active={tab} onChange={handleTabChange} />

                <section className="profile-content">
                    {visibleItems.length === 0 && (
                        <p className="carousel-loading">
                            {tab === 'reviews' ? 'Nenhuma review ainda.' : 'Nenhuma lista criada ainda.'}
                        </p>
                    )}

                    {tab === 'reviews' &&
                        visibleItems.map((review) => <ReviewCard key={review.id} review={review} />)}

                    {tab === 'listas' &&
                        visibleItems.map((list) => (
                            <article className="review-card" key={list.id}>
                                <div className="review-card-body">
                                    <h3 className="review-card-title">{list.name}</h3>
                                    <p className="review-card-text">{list.gameCount} jogos</p>
                                </div>
                            </article>
                        ))}

                    {hasMore && (
                        <button
                            type="button"
                            className="profile-ver-mais"
                            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
                        >
                            VER MAIS
                        </button>
                    )}
                </section>
            </main>

            <footer className="footer text-center py-4 mt-5">
                <p className="m-0">
                    <small>© {new Date().getFullYear()} GameAtlas. Todos os direitos reservados.</small>
                </p>
            </footer>
        </>
    );
}

{/*
import Navbar from "../components/Navbar";
import GameSection from '../components/GameSection';
import { useGames } from '../hooks/useGames';
import '../styles/perfil.css';

export default function Perfil() {
    const { loading, resolveCategory } = useGames();

    return (
        <>

            <Navbar />

            <main
                style={{ paddingTop: '70px' }}
                className="container-fluid px-3 px-lg-5"
            >

                <>
                   <h1>Perfil</h1>
                    
                
                </>
            </main>

            <footer className="footer text-center py-4 mt-5">
                <p className="m-0">
                    © {new Date().getFullYear()} GameAtlas. Todos os direitos reservados.
                </p>
            </footer>

        </>
    );
} */}