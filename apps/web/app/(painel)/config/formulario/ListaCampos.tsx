'use client';

import estilos from './editor.module.css';
import { COM_OPCOES, ROTULO_TIPO, type Campo, type TipoCampo } from './tipos';

const TIPOS = Object.keys(ROTULO_TIPO) as TipoCampo[];

/**
 * Lista editável de perguntas, usada no modelo da agência (S2-2) e na personalização por cliente
 * (S6-2). `publicados`: chaves que não podem trocar de tipo nem sumir (só arquivar), RN-15.
 */
export function ListaCampos({
  campos,
  aoMudar,
  publicados = new Set<string>(),
}: {
  campos: readonly Campo[];
  aoMudar: (campos: Campo[]) => void;
  publicados?: ReadonlySet<string>;
}) {
  function alterar(indice: number, mudanca: Partial<Campo>) {
    aoMudar(campos.map((c, i) => (i === indice ? { ...c, ...mudanca } : c)));
  }

  function mover(indice: number, delta: number) {
    const destino = indice + delta;
    if (destino < 0 || destino >= campos.length) return;
    const copia = [...campos];
    const [item] = copia.splice(indice, 1);
    if (item) copia.splice(destino, 0, item);
    aoMudar(copia);
  }

  function remover(indice: number) {
    aoMudar(campos.filter((_, i) => i !== indice));
  }

  return (
    <ol className={estilos.lista}>
      {campos.map((campo, i) => {
        const travado = campo.chave !== undefined && publicados.has(campo.chave);
        const id = `campo-${String(i)}`;
        return (
          <li
            key={campo.chave ?? `novo-${String(i)}`}
            className={campo.arquivado ? estilos.arquivado : estilos.campo}
          >
            <div className={estilos.linha}>
              <label htmlFor={`${id}-rotulo`}>Pergunta</label>
              <input
                id={`${id}-rotulo`}
                value={campo.rotulo}
                maxLength={200}
                onChange={(e) => {
                  alterar(i, { rotulo: e.target.value });
                }}
              />
            </div>
            <div className={estilos.linha}>
              <label htmlFor={`${id}-tipo`}>Tipo</label>
              <select
                id={`${id}-tipo`}
                value={campo.tipo}
                disabled={travado}
                title={travado ? 'O tipo de um campo já publicado não muda.' : undefined}
                onChange={(e) => {
                  alterar(i, { tipo: e.target.value as TipoCampo });
                }}
              >
                {TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_TIPO[t]}
                  </option>
                ))}
              </select>
              <label className={estilos.marcar}>
                <input
                  type="checkbox"
                  checked={campo.obrigatorio}
                  onChange={(e) => {
                    alterar(i, { obrigatorio: e.target.checked });
                  }}
                />
                Obrigatório
              </label>
            </div>
            <div className={estilos.linha}>
              <label htmlFor={`${id}-ajuda`}>Dica</label>
              <input
                id={`${id}-ajuda`}
                value={campo.ajuda ?? ''}
                maxLength={500}
                placeholder="Texto de ajuda (opcional)"
                onChange={(e) => {
                  alterar(i, { ajuda: e.target.value });
                }}
              />
            </div>
            {COM_OPCOES.includes(campo.tipo) && (
              <div className={estilos.linha}>
                <label htmlFor={`${id}-opcoes`}>Opções</label>
                <textarea
                  id={`${id}-opcoes`}
                  rows={3}
                  placeholder="Uma opção por linha"
                  value={(campo.opcoes ?? []).join('\n')}
                  onChange={(e) => {
                    alterar(i, { opcoes: e.target.value.split('\n') });
                  }}
                />
              </div>
            )}
            <div className={estilos.acoes}>
              <button
                type="button"
                onClick={() => {
                  mover(i, -1);
                }}
                disabled={i === 0}
                aria-label="Subir"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => {
                  mover(i, 1);
                }}
                disabled={i === campos.length - 1}
                aria-label="Descer"
              >
                ↓
              </button>
              {travado ? (
                <button
                  type="button"
                  onClick={() => {
                    alterar(i, { arquivado: !campo.arquivado });
                  }}
                >
                  {campo.arquivado ? 'Restaurar' : 'Arquivar'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    remover(i);
                  }}
                >
                  Remover
                </button>
              )}
              {campo.arquivado && (
                <span className={estilos.etiqueta}>Arquivado: não aparece para novos clientes</span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export const campoNovo = (): Campo => ({
  rotulo: '',
  tipo: 'texto_curto',
  obrigatorio: false,
  arquivado: false,
});
