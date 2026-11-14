import type { Metadata, Viewport } from 'next';
import { Fraunces } from 'next/font/google';
import type { ReactNode } from 'react';
import './globals.css';

// Fraunces nos títulos (D: visual Convergia). O next/font baixa o arquivo no build e serve pelo
// próprio app: o navegador do cliente não fala com o Google (LGPD).
const fraunces = Fraunces({
  subsets: ['latin'],
  weight: ['500'],
  display: 'swap',
  variable: '--fonte-titulo',
});

export const metadata: Metadata = {
  title: 'Convergia Start',
  description: 'Onboarding de clientes da agência',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // A página ocupa a tela toda no iPhone; as cascas recuam com env(safe-area-inset-*).
  viewportFit: 'cover',
  themeColor: '#f8ebdd',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={fraunces.variable}>
      <body>{children}</body>
    </html>
  );
}
