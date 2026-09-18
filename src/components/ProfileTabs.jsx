import '../styles/components.css';

export default function ProfileTabs({ active, onChange }) {
    return (
        <div className="profile-tabs">
            <button
                type="button"
                className={`profile-tab${active === 'reviews' ? ' active' : ''}`}
                onClick={() => onChange('reviews')}
            >
                REVIEWS
            </button>
            <button
                type="button"
                className={`profile-tab${active === 'listas' ? ' active' : ''}`}
                onClick={() => onChange('listas')}
            >
                LISTAS
            </button>
        </div>
    );
}