'use client';

import { useState } from 'react';
import estilos from './editor.module.css';
import {
  COM_OPCOES,
  MENSAGEM_ERRO,
  ROTULO_TIPO,
  type Campo,
  type ErroModelo,
  type EstadoModelo,
  type TipoCampo,
} from './tipos';

const TIPOS = Object.keys(ROTULO_TIPO) as TipoCampo[];

type Aviso = { tom: 'ok' | 'erro'; texto: string } | null;

function textoDosErros(erros: ErroModelo[], campos: Campo[]): string {
  return erros
    .map((e) => {
      const nome = campos.find((c) => c.chave === e.chave)?.rotulo ?? e.chave;
      const msg = MENSAGEM_ERRO[e.codigo] ?? e.codigo;
      return nome ? `"${nome}": ${msg}` : msg;
    })
    .join(' ');
}

export function EditorFormulario({ inicial }: { inicial: EstadoModelo }) {
  const [estado, setEstado] = useState(inicial);
  const [campos, setCampos] = useState<Campo[]>(inicial.rascunho);
  const [sujo, setSujo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<Aviso>(null);

  const publicados = new Set(estado.versaoPublicada.campos.map((c) => c.chave));
  const pendente = sujo || estado.temAlteracoes;

  function alterar(indice: number, mudanca: Partial<Campo>) {
    setCampos((atuais) => atuais.map((c, i) => (i === indice ? { ...c, ...mudanca } : c)));
    setSujo(true);
  }

  function mover(indice: number, delta: number) {
    setCampos((atuais) => {
      const destino = indice + delta;
      if (destino < 0 || destino >= atuais.length) return atuais;
      const copia = [...atuais];
      const [item] = copia.splice(indice, 1);
      if (item) copia.splice(destino, 0, item);
      return copia;
    });
    setSujo(true);
  }

  function adicionar() {
    setCampos((atuais) => [
      ...atuais,
      { rotulo: '', tipo: 'texto_curto', obrigatorio: false, arquivado: false },
    ]);
    setSujo(true);
  }

  function remover(indice: number) {
    setCampos((atuais) => atuais.filter((_, i) => i !== indice));
    setSujo(true);
  }

  async function recarregar(): Promise<EstadoModelo | null> {
    const resposta = await fetch('/api/formulario/modelo', { cache: 'no-store' });
    if (!resposta.ok) return null;
    const novo = (await resposta.json()) as EstadoModelo;
    setEstado(novo);
    setCampos(novo.rascunho);
    setSujo(false);
    return novo;
  }

  async function salvar(): Promise<boolean> {
    const resposta = await fetch('/api/formulario/modelo/rascunho', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ campos }),
    });
    if (resposta.ok) return true;
    const corpo = (await resposta.json().catch(() => ({}))) as { erros?: ErroModelo[] };
    setAviso({
      tom: 'erro',
      texto: corpo.erros
        ? textoDosErros(corpo.erros, campos)
        : 'Não foi possível salvar. Tente de novo.',
    });
    return false;
  }

  async function aoSalvar() {
    setOcupado(true);
    setAviso(null);
    if (await salvar()) {
      await recarregar();
      setAviso({ tom: 'ok', texto: 'Rascunho salvo. O cliente ainda vê a versão publicada.' });
    }
    setOcupado(false);
  }

  async function aoPublicar() {
    setOcupado(true);
    setAviso(null);
    if (await salvar()) {
      const resposta = await fetch('/api/formulario/modelo/publicar', { method: 'POST' });
      const corpo = (await resposta.json().catch(() => ({}))) as {
        numero?: number;
        erro?: string;
        erros?: ErroModelo[];
      };
      if (resposta.ok) {
        await recarregar();
        setAviso({ tom: 'ok', texto: `Versão ${String(corpo.numero)} publicada.` });
      } else if (corpo.erro === 'SEM_ALTERACOES') {
        setAviso({ tom: 'erro', texto: 'Não há alterações para publicar.' });
      } else {
        setAviso({
          tom: 'erro',
          texto: corpo.erros ? textoDosErros(corpo.erros, campos) : 'Não foi possível publicar.',
        });
      }
    }
    setOcupado(false);
  }

  return (
    <>
      <h1>Modelo do formulário</h1>
      <p className={estilos.resumo}>
        Versão publicada: <strong>{estado.versaoPublicada.numero}</strong>
        {pendente ? ' · há alterações ainda não publicadas' : ' · sem alterações pendentes'}.
        Clientes que já responderam continuam ligados à versão em que responderam.
      </p>

      {aviso && (
        <p role={aviso.tom === 'erro' ? 'alert' : 'status'} className={estilos[aviso.tom]}>
          {aviso.texto}
        </p>
      )}

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
                  <span className={estilos.etiqueta}>
                    Arquivado: não aparece para novos clientes
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <div className={estilos.rodape}>
        <button type="button" onClick={adicionar} disabled={ocupado}>
          + Adicionar campo
        </button>
        <button type="button" onClick={() => void aoSalvar()} disabled={ocupado || !pendente}>
          Salvar rascunho
        </button>
        <button
          type="button"
          className={estilos.primario}
          onClick={() => void aoPublicar()}
          disabled={ocupado || !pendente}
        >
          Publicar versão {estado.versaoPublicada.numero + 1}
        </button>
      </div>
    </>
  );
}
