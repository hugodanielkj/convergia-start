/** Endereço interno da API (servidor → servidor). O navegador usa /api, via rewrite. */
export const URL_API = process.env['API_URL'] ?? 'http://localhost:3333';
