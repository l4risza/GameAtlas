import { Link } from 'react-router-dom';

export default function PlatformCard({ id, label, icon }) {
    return (
        <Link className="platform-card" to={`/explorar?${new URLSearchParams({ plataforma: id })}`}>
            <span className="platform-icon"><i className={`bi ${icon}`} aria-hidden="true"></i></span>
            <span className="platform-name">{label}</span>
        </Link>
    );
}