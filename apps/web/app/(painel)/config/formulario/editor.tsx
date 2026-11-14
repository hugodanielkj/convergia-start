'use client';

import { useState } from 'react';
import estilos from './editor.module.css';
import { campoNovo, ListaCampos } from './ListaCampos';
import { MENSAGEM_ERRO, type Campo, type ErroModelo, type EstadoModelo } from './tipos';

type Aviso = { tom: 'ok' | 'erro'; texto: string } | null;

export function textoDosErros(erros: ErroModelo[], campos: Campo[]): string {
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

  const publicados = new Set(
    estado.versaoPublicada.campos.flatMap((c) => (c.chave ? [c.chave] : [])),
  );
  const pendente = sujo || estado.temAlteracoes;

  function adicionar() {
    setCampos((atuais) => [...atuais, campoNovo()]);
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

      <ListaCampos
        campos={campos}
        publicados={publicados}
        aoMudar={(novos) => {
          setCampos(novos);
          setSujo(true);
        }}
      />

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
