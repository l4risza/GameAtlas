import '../styles/api.css';

export default function ApiFeedback({ loading, error, onRetry }) {
    if (loading) return <p className="api-feedback" role="status">Carregando jogos...</p>;
    if (!error) return null;
    return (
        <div className="api-feedback" role="alert">
            <p>{error}</p>
            <button className="api-button" type="button" onClick={onRetry}>Tentar novamente</button>
        </div>
    );
}
