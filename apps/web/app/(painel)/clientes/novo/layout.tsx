import type { ReactNode } from 'react';
import { BotaoVoltar } from '../../_componentes/BotaoVoltar';

/** "Voltar" para a tela anterior (ou para a lista de clientes, se a página foi aberta direto). */
export default function LayoutNovoCliente({ children }: { children: ReactNode }) {
  return (
    <>
      <BotaoVoltar padrao="/clientes" />
      {children}
    </>
  );
}
