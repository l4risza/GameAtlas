export function normalizeSearchText(value) {
    return String(value || '').normalize('NFD').replace(/\p{M}/gu, '')
        .toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim();
}

export function isDemoOrAddition(game) {
    const name = normalizeSearchText(game.name);
    return game.is_demo === true || Number(game.parents_count || 0) > 0 ||
        /\b(?:demo|playtest)\b|\bprologue\b(?=\s*[)\]]?\s*$)/u.test(name) ||
        (game.tags || []).some((tag) => ['demo', 'demos', 'playtest'].includes(tag.slug));
}

export function compareGames(left, right, { term, sort = 'relevance', ordering = '-added' }) {
    if (sort === 'relevance') {
        const exact = (game) => normalizeSearchText(game.name) === term ? 0 : 1;
        const exactDifference = exact(left) - exact(right);
        if (exactDifference) return exactDifference;
        const score = (game) => Math.log10(1 + Math.max(0, Number(game.added) || 0)) +
            .2 * Math.log10(1 + Math.max(0, Number(game.ratings_count) || 0)) +
            (normalizeSearchText(game.name).startsWith(term) ? .75 : 0);
        const relevance = score(right) - score(left);
        if (relevance) return relevance;
    }
    const fields = sort === 'name' ? 'name' : sort === 'rating' ? '-rating,-ratings_count,-added'
        : sort === 'ordering' ? ordering : '-added,-ratings_count';
    for (const sortField of fields.split(',')) {
        const descending = sortField.startsWith('-');
        const field = descending ? sortField.slice(1) : sortField;
        const a = left[field];
        const b = right[field];
        const difference = typeof a === 'string' || typeof b === 'string'
            ? String(a || '').localeCompare(String(b || ''), 'pt-BR')
            : Number(a || 0) - Number(b || 0);
        if (difference) return descending ? -difference : difference;
    }
    return left.id - right.id;
}
