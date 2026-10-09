import PlatformCard from './PlatformCard';

const PLATFORM_ITEMS = [
    { id: '1', label: 'PC', icon: 'bi-windows' },
    { id: '2', label: 'PlayStation', icon: 'bi-playstation' },
    { id: '3', label: 'Xbox', icon: 'bi-xbox' },
    { id: '7', label: 'Nintendo', icon: 'bi-nintendo-switch' },
    { id: '4,8', label: 'Celular', icon: 'bi-phone' },
    { id: '5,6', label: 'Mac e Linux', icon: 'bi-apple' },
    { id: '14', label: 'Navegador', icon: 'bi-globe' },
    { id: '11', label: 'SEGA', icon: 'bi-joystick' }
];

export default function PlatformSection({ title = 'Plataformas' }) {
    return (
        <section>
            <h4 className="section-title">{title}</h4>
            <hr />
            <div className="platforms">
                {PLATFORM_ITEMS.map((item) => <PlatformCard key={item.id} {...item} />)}
            </div>
        </section>
    );
}