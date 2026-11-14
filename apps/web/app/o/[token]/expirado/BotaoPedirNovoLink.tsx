'use client';

import { useActionState } from 'react';
import { pedirNovoLinkAction } from './actions';
import type { EstadoPedido } from './pedir-novo-link';
import estilos from './expirado.module.css';

const INICIAL: EstadoPedido = { tipo: 'inicial' };

export function BotaoPedirNovoLink({ token }: { readonly token: string }) {
  const [estado, pedir, pendente] = useActionState(pedirNovoLinkAction, INICIAL);

  if (estado.tipo === 'registrado') {
    return (
      <p role="status" className={estilos.sucesso}>
        Pedido enviado! A agência vai gerar um novo link e entrar em contato com você.
      </p>
    );
  }

  return (
    <form action={pedir} className={estilos.form}>
      <input type="hidden" name="token" value={token} />
      <button type="submit" disabled={pendente} className={estilos.botao}>
        {pendente ? 'Enviando…' : 'Solicitar novo link'}
      </button>
      <div aria-live="polite">
        {estado.tipo === 'falha' && (
          <p role="alert" className={estilos.erro}>
            {estado.mensagem}
          </p>
        )}
        {estado.tipo === 'link_valido' && (
          <p role="status">
            Seu link ainda está válido.{' '}
            <a href={`/o/${encodeURIComponent(token)}`}>Voltar ao onboarding</a>.
          </p>
        )}
        {estado.tipo === 'invalido' && (
          <p role="alert" className={estilos.erro}>
            Este link não é mais válido. Peça um novo diretamente à agência.
          </p>
        )}
      </div>
    </form>
  );
}
