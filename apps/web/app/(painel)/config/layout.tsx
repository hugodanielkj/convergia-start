import type { ReactNode } from 'react';
import { BotaoVoltar } from '../_componentes/BotaoVoltar';

/** Toda tela dentro de /config ganha "Voltar"; o índice /config é uma aba do menu e não precisa. */
export default function LayoutConfig({ children }: { children: ReactNode }) {
  return (
    <>
      <BotaoVoltar padrao="/config" ocultarEm="/config" />
      {children}
    </>
  );
}
