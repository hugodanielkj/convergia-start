'use client';

import { useActionState } from 'react';
import { gerarNovoLinkAction } from './actions';
import { LinkParaCopiar } from './LinkParaCopiar';
import type { EstadoLink } from './processar';
import estilos from './clientes.module.css';

const INICIAL: EstadoLink = { tipo: 'inicial' };

/** Gera um link novo para o onboarding (RN-12). O link anterior deixa de valer na hora. */
export function BotaoNovoLink({ onboardingId }: { readonly onboardingId: string }) {
  const [estado, gerar, pendente] = useActionState(gerarNovoLinkAction, INICIAL);

  return (
    <div className={estilos.novoLink}>
      <form action={gerar}>
        <input type="hidden" name="onboardingId" value={onboardingId} />
        <button type="submit" disabled={pendente} className={estilos.botaoSecundario}>
          {pendente ? 'Gerando…' : 'Gerar novo link'}
        </button>
      </form>
      <div aria-live="polite">
        {estado.tipo === 'falha' && (
          <p role="alert" className={estilos.erroCampo}>
            {estado.mensagem}
          </p>
        )}
        {estado.tipo === 'gerado' && (
          <>
            <LinkParaCopiar caminho={estado.link.caminho} expiraEm={estado.link.expiraEm} />
            <p className={estilos.aviso}>O link anterior deixou de funcionar.</p>
          </>
        )}
      </div>
    </div>
  );
}
