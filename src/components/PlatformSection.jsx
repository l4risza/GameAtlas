import PlatformCard from './PlatformCard';

const PLATFORM_ITEMS = [
    { id: 'pc', label: 'PC', icon: 'bi-windows' },
    { id: 'playstation', label: 'PlayStation', icon: 'bi-playstation' },
    { id: 'xbox', label: 'Xbox', icon: 'bi-xbox' },
    { id: 'nintendo', label: 'Nintendo', icon: 'bi-nintendo-switch' },
    { id: 'mobile', label: 'Celular', icon: 'bi-phone' },
    { id: 'mac-linux', label: 'Mac e Linux', icon: 'bi-apple' },
    { id: 'web', label: 'Navegador', icon: 'bi-globe' },
    { id: 'sega', label: 'SEGA', icon: 'bi-joystick' },
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