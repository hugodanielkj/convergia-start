'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LinkParaCopiar } from '../../clientes/LinkParaCopiar';
import estilos from './detalhe.module.css';
import {
  ACOES_STATUS,
  mensagemDeErro,
  textoDoReenvio,
  type AcaoStatus,
  type Detalhe,
} from './tipos';

type Painel =
  | { tipo: 'status'; acao: AcaoStatus }
  | { tipo: 'reabrir' }
  | { tipo: 'fechar' }
  | { tipo: 'regenerar' }
  | { tipo: 'reenviar'; oque: 'convite' | 'lembrete' }
  | { tipo: 'excluir' };

interface Pedido {
  readonly url: string;
  readonly corpo: object;
  readonly depois?: (resposta: Response) => Promise<void>;
}

/** Ações rápidas do detalhe (RN-65). Cada uma abre uma confirmação antes de agir. */
export function AcoesRapidas({ detalhe }: { detalhe: Detalhe }) {
  const router = useRouter();
  const [painel, setPainel] = useState<Painel | null>(null);
  const [motivo, setMotivo] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novoLink, setNovoLink] = useState<{ caminho: string; expiraEm: string } | null>(null);
  const [enviado, setEnviado] = useState<string | null>(null);
  const { acoes, id, cliente } = detalhe;

  // "Copiar link" monta o link vigente a partir do token cifrado (2026-11-15-b-link-cifrado).
  async function mostrarLink() {
    setErro(null);
    const r = await fetch(`/api/onboardings/${id}/link`, { cache: 'no-store' });
    if (!r.ok) {
      setErro(await mensagemDeErro(r));
      return;
    }
    const { link } = (await r.json()) as { link: { caminho: string; expiraEm: string } | null };
    if (link) setNovoLink(link);
    else setErro('Este link não pode ser recuperado. Use “Regenerar link” para criar um novo.');
  }

  function abrir(p: Painel) {
    setEnviado(null);
    setPainel(p);
    setMotivo('');
    setConfirmacao('');
    setErro(null);
  }

  async function enviar({ url, corpo, depois }: Pedido) {
    setOcupado(true);
    setErro(null);
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    });
    setOcupado(false);
    if (!r.ok) {
      setErro(await mensagemDeErro(r));
      return;
    }
    setPainel(null);
    if (depois) await depois(r);
    else router.refresh();
  }

  function pedidoDoPainel(p: Painel): Pedido {
    const base = `/api/onboardings/${id}`;
    switch (p.tipo) {
      case 'status':
        return { url: `${base}/acoes/${p.acao}`, corpo: { motivo } };
      case 'reabrir':
        return { url: `${base}/etapas/formulario/reabrir`, corpo: { motivo } };
      case 'fechar':
        return { url: `${base}/formulario/fechar`, corpo: {} };
      case 'regenerar':
        return {
          url: `${base}/link/regenerar`,
          corpo: {},
          depois: async (r) => {
            const { link } = (await r.json()) as { link: { caminho: string; expiraEm: string } };
            setNovoLink(link);
            router.refresh();
          },
        };
      case 'reenviar':
        return {
          url: `${base}/${p.oque}/reenviar`,
          corpo: {},
          depois: async (r) => {
            const { enviaEm } = (await r.json()) as { enviaEm: string };
            setEnviado(textoDoReenvio(p.oque, enviaEm, new Date()));
            router.refresh();
          },
        };
      case 'excluir':
        return {
          url: `/api/clientes/${cliente.id}/exclusao`,
          corpo: { confirmacao },
          depois: () => {
            router.push('/onboardings');
            return Promise.resolve();
          },
        };
    }
  }

  const textoDoPainel = (p: Painel): { titulo: string; aviso?: string; perigo: boolean } => {
    switch (p.tipo) {
      case 'status': {
        const a = ACOES_STATUS[p.acao];
        return { titulo: a.rotulo, perigo: a.perigo, ...(a.aviso ? { aviso: a.aviso } : {}) };
      }
      case 'reabrir':
        return {
          titulo: 'Reabrir formulário',
          aviso: 'As respostas voltam a rascunho e o cliente pode editar e reenviar.',
          perigo: false,
        };
      case 'fechar':
        return {
          titulo: 'Fechar formulário',
          aviso: 'O cliente não poderá mais editar as respostas.',
          perigo: false,
        };
      case 'regenerar':
        return {
          titulo: 'Regenerar link',
          aviso: 'O link atual para de funcionar na hora.',
          perigo: false,
        };
      case 'reenviar':
        return p.oque === 'convite'
          ? {
              titulo: 'Reenviar convite',
              aviso: 'O cliente recebe de novo o convite com o link atual.',
              perigo: false,
            }
          : {
              titulo: 'Reenviar lembrete',
              aviso:
                'O cliente recebe um lembrete com o que falta. Não conta nos lembretes automáticos.',
              perigo: false,
            };
      case 'excluir':
        return {
          titulo: 'Excluir dados do cliente',
          aviso: `Apaga de vez o cadastro, as respostas e os agendamentos. Não dá para desfazer. Digite "${cliente.nomeEmpresa}" para confirmar.`,
          perigo: true,
        };
    }
  };

  const pedeMotivo =
    painel !== null &&
    (painel.tipo === 'reabrir' ||
      (painel.tipo === 'status' && ACOES_STATUS[painel.acao].pedeMotivo));
  const texto = painel ? textoDoPainel(painel) : null;
  const podeConfirmar =
    !ocupado &&
    (!pedeMotivo || motivo.trim() !== '') &&
    (painel?.tipo !== 'excluir' || confirmacao.trim() !== '');

  return (
    <section className={estilos.secao} aria-labelledby="titulo-acoes">
      <h2 id="titulo-acoes">Ações rápidas</h2>
      <div className={estilos.botoes}>
        {acoes.status.map((acao) => (
          <button
            key={acao}
            type="button"
            className={ACOES_STATUS[acao].perigo ? estilos.perigo : undefined}
            onClick={() => {
              abrir({ tipo: 'status', acao });
            }}
          >
            {ACOES_STATUS[acao].rotulo}
          </button>
        ))}
        {acoes.reabrirFormulario && (
          <button
            type="button"
            onClick={() => {
              abrir({ tipo: 'reabrir' });
            }}
          >
            Reabrir formulário
          </button>
        )}
        {acoes.fecharFormulario && (
          <button
            type="button"
            onClick={() => {
              abrir({ tipo: 'fechar' });
            }}
          >
            Fechar formulário
          </button>
        )}
        {acoes.regenerarLink && (
          <button type="button" onClick={() => void mostrarLink()}>
            Copiar link
          </button>
        )}
        {acoes.regenerarLink && (
          <button
            type="button"
            onClick={() => {
              abrir({ tipo: 'regenerar' });
            }}
          >
            Regenerar link
          </button>
        )}
        {acoes.exportar && (
          <a className={estilos.botaoLink} href={`/api/clientes/${cliente.id}/exportacao`} download>
            Exportar dados (LGPD)
          </a>
        )}
        {acoes.excluir && (
          <button
            type="button"
            className={estilos.perigo}
            onClick={() => {
              abrir({ tipo: 'excluir' });
            }}
          >
            Excluir dados (LGPD)
          </button>
        )}
        {acoes.regenerarLink && (
          <button
            type="button"
            onClick={() => {
              abrir({ tipo: 'reenviar', oque: 'convite' });
            }}
          >
            Reenviar convite
          </button>
        )}
        {acoes.regenerarLink && (
          <button
            type="button"
            onClick={() => {
              abrir({ tipo: 'reenviar', oque: 'lembrete' });
            }}
          >
            Reenviar lembrete
          </button>
        )}
      </div>
      <p className={estilos.dica}>O prazo se ajusta na seção “Prazo de liberação”.</p>
      {enviado && (
        <p className={estilos.ok} role="status">
          {enviado}
        </p>
      )}

      {painel && texto && (
        <form
          className={estilos.confirmacao}
          data-perigo={texto.perigo || undefined}
          onSubmit={(e) => {
            e.preventDefault();
            void enviar(pedidoDoPainel(painel));
          }}
        >
          <strong>{texto.titulo}</strong>
          {texto.aviso && <p>{texto.aviso}</p>}
          {pedeMotivo && (
            <label>
              Motivo
              <textarea
                value={motivo}
                maxLength={500}
                required
                onChange={(e) => {
                  setMotivo(e.target.value);
                }}
              />
            </label>
          )}
          {painel.tipo === 'excluir' && (
            <label>
              Nome da empresa
              <input
                value={confirmacao}
                autoComplete="off"
                onChange={(e) => {
                  setConfirmacao(e.target.value);
                }}
              />
            </label>
          )}
          {erro && <p className={estilos.erro}>{erro}</p>}
          <div className={estilos.botoes}>
            <button
              type="submit"
              className={texto.perigo ? estilos.perigo : undefined}
              disabled={!podeConfirmar}
            >
              {ocupado ? 'Enviando…' : 'Confirmar'}
            </button>
            <button
              type="button"
              className={estilos.secundario}
              onClick={() => {
                setPainel(null);
              }}
            >
              Voltar
            </button>
          </div>
        </form>
      )}
      {!painel && erro && <p className={estilos.erro}>{erro}</p>}
      {novoLink && <LinkParaCopiar caminho={novoLink.caminho} expiraEm={novoLink.expiraEm} />}
    </section>
  );
}
