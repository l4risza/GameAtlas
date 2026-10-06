import Navbar from '../components/Navbar';
import Carousel from '../components/Carousel';
import GameSection from '../components/GameSection';
import Footer from '../components/Footer';
import ApiFeedback from '../components/ApiFeedback';
import { useGames } from '../hooks/useGames';
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
                    <Carousel games={resolveCategory('emAlta').slice(0, 3)} />
                    <GameSection title="Em alta" games={resolveCategory('emAlta')} />
                    <GameSection title="Melhores avaliados no Metacritic" games={resolveCategory('melhoresAv')} />
                    <GameSection title="Lançamentos recentes" games={resolveCategory('lancamentos')} />
                </>}
            </main>
            <Footer />
        </>
    );
}
