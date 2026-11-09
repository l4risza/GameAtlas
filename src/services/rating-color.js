// Escala contínua: 0 = vermelho; nota máxima = amarelo.
export function ratingColor(value, max = 5) {
    const fraction = Number.isFinite(value) && max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
    return `hsl(${Math.round(fraction * 50)} 100% 55%)`;
}
