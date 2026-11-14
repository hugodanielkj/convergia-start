import type { ReactNode } from 'react';
import { BotaoVoltar } from '../../../_componentes/BotaoVoltar';

/** "Voltar" sempre para o detalhe do onboarding, na mesma posição em que o usuário estava. */
export default async function LayoutAcessos({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detalhe = `/onboardings/${encodeURIComponent(id)}`;
  return (
    <>
      <BotaoVoltar padrao={detalhe} para={detalhe} />
      {children}
    </>
  );
}
