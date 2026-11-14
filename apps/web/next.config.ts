import type { NextConfig } from 'next';
import { URL_API } from './app/_lib/url-api';

const config: NextConfig = {
  // Os testes de celular (e2e/) sobem uma segunda cópia do app em outra pasta, sem brigar com o
  // `next dev` do dia a dia, que trava a pasta .next/dev.
  distDir: process.env['NEXT_DIST_DIR'] ?? '.next',
  // O botão flutuante do Next cobre a tela nas fotos dos testes de celular.
  devIndicators: process.env['NEXT_DIST_DIR'] ? false : { position: 'bottom-left' },
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // O navegador só fala com a web; /api/* é repassado à API. Cookies ficam no mesmo domínio
  // e não há CORS. O Google devolve o login em /api/auth/google/callback.
  rewrites() {
    return Promise.resolve([{ source: '/api/:caminho*', destination: `${URL_API}/:caminho*` }]);
  },
};

export default config;
