import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import '../styles/components.css';

export default function Cadastro() {
    const { loading, resolveCategory } = useGames();

    return (
        <>

            <Navbar />

            <main
                style={{ paddingTop: '70px' }}
                className="container-fluid px-3 px-lg-5"
            >

                <>
                   <h1>Cadastro</h1>
                    
                
                </>
            </main>

            <Footer />

        </>
    );
} 