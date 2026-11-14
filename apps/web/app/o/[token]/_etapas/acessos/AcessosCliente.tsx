'use client';

import { useState } from 'react';
import estilos from './acessos.module.css';
import type { AcessoVisao, EstadoAcessos } from './tipos';

const ROTULO_STATUS: Record<AcessoVisao['status'], string> = {
  pendente: 'Pendente',
  concedido: 'Acesso confirmado',
  invalido: 'Precisa de ajuste',
};

function rotulo(a: AcessoVisao): string {
  return a.status === 'pendente' && a.informado
    ? 'Aguardando confirmação da agência'
    : ROTULO_STATUS[a.status];
}

export function AcessosCliente({ token, inicial }: { token: string; inicial: EstadoAcessos }) {
  const [estado, setEstado] = useState(inicial);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function informar(plataforma: string) {
    setOcupado(plataforma);
    setErro(null);
    const r = await fetch(
      `/api/publico/onboardings/${encodeURIComponent(token)}/acessos/${plataforma}/informar`,
      { method: 'POST' },
    );
    setOcupado(null);
    if (!r.ok) {
      setErro('Não foi possível registrar agora. Tente novamente.');
      return;
    }
    setEstado((await r.json()) as EstadoAcessos);
  }

  return (
    <div className={estilos.lista}>
      <p>
        Você não precisa compartilhar nenhuma senha. Basta adicionar a agência como parceira em cada
        rede, seguindo o passo a passo. <strong>Nunca envie senhas por mensagem.</strong>
      </p>
      {estado.plataformas.map((a) => (
        <details key={a.plataforma} className={estilos.item} open={a.status !== 'concedido'}>
          <summary className={estilos.resumo}>
            <span className={estilos.nome}>
              {a.nome} {a.obrigatoria ? '' : <small>(opcional)</small>}
            </span>
            <span className={estilos.selo} data-status={a.status}>
              {rotulo(a)}
            </span>
          </summary>
          {a.status === 'invalido' && a.motivo ? (
            <p className={estilos.alerta}>A agência não conseguiu confirmar: {a.motivo}</p>
          ) : null}
          {a.status !== 'concedido' ? (
            <>
              <ol className={estilos.passos}>
                {a.passos.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
              {a.identificador ? (
                <p className={estilos.identificador}>
                  Adicione: <code>{a.identificador}</code>
                </p>
              ) : null}
              <button
                type="button"
                className={estilos.botao}
                disabled={ocupado === a.plataforma || (a.informado && a.status === 'pendente')}
                onClick={() => void informar(a.plataforma)}
              >
                {a.informado && a.status === 'pendente'
                  ? 'Aviso enviado'
                  : 'Já adicionei a agência'}
              </button>
            </>
          ) : null}
        </details>
      ))}
      {erro ? <p className={estilos.erro}>{erro}</p> : null}
    </div>
  );
}
