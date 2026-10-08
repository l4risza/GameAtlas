import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import '../styles/components.css';

export default function Login() {
    const { loading, resolveCategory } = useGames();

    return (
        <>

            <Navbar />

            <main
                style={{ paddingTop: '70px' }}
                className="container-fluid px-3 px-lg-5"
            >

                <>
                   <h1>Login</h1>
                    
                
                </>
            </main>

            <Footer />

        </>
    );
} 