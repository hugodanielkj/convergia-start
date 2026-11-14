'use client';

import { useActionState } from 'react';
import { aceitarTermoAction } from './actions';
import type { EstadoAceite } from './aceitar-termo';
import estilos from './consentimento.module.css';

const INICIAL: EstadoAceite = { tipo: 'inicial' };

/** Tela de consentimento do primeiro acesso (RN-72): o cliente só segue depois de aceitar. */
export function Consentimento({
  token,
  empresa,
  termo,
}: {
  token: string;
  empresa: string;
  termo: { versao: string; texto: string };
}) {
  const [estado, acao, pendente] = useActionState(aceitarTermoAction, INICIAL);

  return (
    <main className={estilos.pagina}>
      <h1>Bem-vindo(a), {empresa}!</h1>
      <p className={estilos.subtitulo}>
        Antes de começar, precisamos do seu consentimento para cuidar dos seus dados.
      </p>
      <form action={acao} className={estilos.caixa}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="versao" value={termo.versao} />
        <p className={estilos.termo}>{termo.texto}</p>
        <label className={estilos.aceite}>
          <input type="checkbox" name="concordo" required />
          Li e concordo
        </label>
        {estado.tipo === 'termo_mudou' && (
          <p role="alert" className={estilos.erro}>
            O termo foi atualizado. Recarregue a página para ler a versão atual.
          </p>
        )}
        {estado.tipo === 'falha' && (
          <p role="alert" className={estilos.erro}>
            {estado.mensagem}
          </p>
        )}
        <button type="submit" className={estilos.botao} disabled={pendente}>
          {pendente ? 'Registrando…' : 'Aceitar e continuar'}
        </button>
      </form>
    </main>
  );
}
