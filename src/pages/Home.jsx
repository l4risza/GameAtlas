import Navbar from '../components/Navbar';
import Carousel from '../components/Carousel';
import GameSection from '../components/GameSection';
import PlatformSection from '../components/PlatformSection';
import Footer from '../components/Footer';
import ApiFeedback from '../components/ApiFeedback';
import { useGames } from '../hooks/useGames';
import { categoryExploreLink } from '../services/search-options';
import '../styles/components.css';
import '../styles/api.css';

export default function Home() {
    const { loading, error, reload, resolveCategory } = useGames({ categories: 'emAlta,melhoresAv,lancamentos' });
    return (
        <>
            <Navbar />
            <main className="container-fluid px-3 px-lg-5 api-page">
                <ApiFeedback loading={loading} error={error} onRetry={reload} />
                {!loading && !error && <>
                    <Carousel games={resolveCategory('emAlta').slice(0, 5)} />
                    <GameSection title="Em alta" games={resolveCategory('emAlta')} seeMoreTo={categoryExploreLink('emAlta')} />
                    <p className="rawg-credit">Dados e imagens de jogos fornecidos pela <a href="https://www.igdb.com" target="_blank" rel="noreferrer">IGDB</a>.</p>
                    <GameSection title="Lançamentos recentes" games={resolveCategory('lancamentos')} seeMoreTo={categoryExploreLink('lancamentos')} />
                    <PlatformSection title="Plataformas" />
                </>}
            </main>
            <Footer />
        </>
    );
}