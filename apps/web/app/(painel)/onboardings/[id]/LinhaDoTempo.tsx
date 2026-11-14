'use client';

import { useState } from 'react';
import { formatarDataHora } from '../../clientes/formatar';
import estilos from './detalhe.module.css';
import {
  GRUPOS_AUDITORIA,
  detalheDoItem,
  mensagemDeErro,
  nomeDoAtor,
  rotuloAcaoAuditoria,
  type ItemAuditoria,
} from './tipos';

/** Linha do tempo do onboarding, vinda da auditoria (RN-65, RN-77), com filtro por grupo. */
export function LinhaDoTempo({
  onboardingId,
  inicial,
}: {
  onboardingId: string;
  inicial: ItemAuditoria[];
}) {
  const [grupo, setGrupo] = useState('');
  const [itens, setItens] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [anterior, setAnterior] = useState(inicial);

  // A página recarrega os dados depois de cada ação; sem filtro, mostra a lista nova.
  if (inicial !== anterior) {
    setAnterior(inicial);
    if (grupo === '') setItens(inicial);
  }

  async function filtrar(valor: string) {
    setGrupo(valor);
    setErro(null);
    const consulta = valor ? `?acao=${encodeURIComponent(valor)}` : '';
    const r = await fetch(`/api/onboardings/${onboardingId}/auditoria${consulta}`);
    if (!r.ok) {
      setErro(await mensagemDeErro(r));
      return;
    }
    setItens(((await r.json()) as { itens: ItemAuditoria[] }).itens);
  }

  return (
    <section className={estilos.secao} aria-labelledby="titulo-linha">
      <div className={estilos.cabecalhoSecao}>
        <h2 id="titulo-linha">Linha do tempo</h2>
        <label className={estilos.filtro}>
          Mostrar
          <select value={grupo} onChange={(e) => void filtrar(e.target.value)}>
            {GRUPOS_AUDITORIA.map((g) => (
              <option key={g.valor} value={g.valor}>
                {g.rotulo}
              </option>
            ))}
          </select>
        </label>
      </div>
      {erro && <p className={estilos.erro}>{erro}</p>}
      {itens.length === 0 ? (
        <p className={estilos.vazio}>Nada registrado.</p>
      ) : (
        <ol className={estilos.linhaDoTempo}>
          {itens.map((item) => {
            const complemento = detalheDoItem(item);
            return (
              <li key={item.id}>
                <time dateTime={item.em}>{formatarDataHora(item.em)}</time>
                <strong>{rotuloAcaoAuditoria(item.acao)}</strong>
                {complemento && <span>{complemento}</span>}
                <small>{nomeDoAtor(item.ator)}</small>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
