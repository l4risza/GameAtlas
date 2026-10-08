import Navbar from "../components/Navbar";
import GameSection from '../components/GameSection';
import { useGames } from '../hooks/useGames';
import '../styles/components.css';
import Footer from "../components/Footer";

export default function Reviews() {
    const { loading, resolveCategory } = useGames();

    return (
        <>

            <Navbar />

            <main
                style={{ paddingTop: '70px' }}
                className="container-fluid px-3 px-lg-5"
            >

                <>
                   <h1>Reviews</h1>
                    
                
                </>
            </main>

            <Footer />

        </>
    );
} 