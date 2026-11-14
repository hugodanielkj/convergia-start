import type { NextConfig } from 'next';
import { URL_API } from './app/_lib/url-api';

const config: NextConfig = {
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
