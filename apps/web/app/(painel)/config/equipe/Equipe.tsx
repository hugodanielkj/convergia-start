'use client';

import { useRouter } from 'next/navigation';
import { useState, type SyntheticEvent } from 'react';
import estilos from './equipe.module.css';
import { mensagemDoErro, rotuloPapel, textoEmAndamento, type PessoaEquipe } from './mensagens';

type Papel = PessoaEquipe['papel'];
type Aberto = { id: string; modo: 'editar' | 'desativar' } | null;

async function chamar(url: string, metodo: string, corpo?: object): Promise<string | null> {
  const r = await fetch(url, {
    method: metodo,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(corpo ?? {}),
  });
  if (r.ok) return null;
  return mensagemDoErro(r.status, await r.json().catch(() => null));
}

/** Configurações › Equipe: cadastrar, editar, desativar e reativar (S8-1, RN-03). */
export function Equipe({ pessoas, euId }: { pessoas: PessoaEquipe[]; euId: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState<Aberto>(null);
  // `onde`: id da pessoa ou "novo"; o aviso aparece no cartão em que a ação aconteceu.
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string; onde: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const ativas = pessoas.filter((p) => p.ativo);

  async function executar(
    onde: string,
    acao: () => Promise<string | null>,
    sucesso: string,
  ): Promise<boolean> {
    setOcupado(true);
    setAviso(null);
    const erro = await acao();
    setOcupado(false);
    setAviso({ ok: !erro, texto: erro ?? sucesso, onde });
    if (erro) return false;
    setAberto(null);
    router.refresh();
    return true;
  }

  async function adicionar(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    const formulario = e.currentTarget;
    const dados = new FormData(formulario);
    const ok = await executar(
      'novo',
      () =>
        chamar('/api/equipe', 'POST', {
          nome: dados.get('nome'),
          email: dados.get('email'),
          papel: dados.get('papel'),
        }),
      'Pessoa cadastrada. Ela já pode entrar com o Google, usando este e-mail.',
    );
    if (ok) formulario.reset();
  }

  return (
    <div className={estilos.pagina}>
      <h1>Equipe</h1>
      <p className={estilos.dica}>
        Cada pessoa entra com “Entrar com Google”, usando o e-mail cadastrado aqui.
      </p>

      <ul className={estilos.lista} aria-label="Pessoas da equipe">
        {pessoas.map((p) => (
          <li key={p.id} className={estilos.cartao} data-ativo={p.ativo}>
            <div className={estilos.cabecalho}>
              <strong>
                {p.nome}
                {p.id === euId && ' (você)'}
              </strong>
              <span className={estilos.etiqueta}>{rotuloPapel(p.papel)}</span>
              {!p.ativo && <span className={estilos.etiqueta}>Inativo</span>}
            </div>
            <span className={estilos.email}>{p.email}</span>
            {p.ativo && p.emAndamento > 0 && (
              <span className={estilos.dica}>{textoEmAndamento(p.emAndamento)}</span>
            )}

            {aberto?.id === p.id && aberto.modo === 'editar' && (
              <FormEdicao
                pessoa={p}
                propria={p.id === euId}
                ocupado={ocupado}
                aoCancelar={() => {
                  setAberto(null);
                }}
                aoSalvar={(nome, papel) =>
                  void executar(
                    p.id,
                    () => chamar(`/api/equipe/${p.id}`, 'PATCH', { nome, papel }),
                    'Alterações salvas.',
                  )
                }
              />
            )}

            {aberto?.id === p.id && aberto.modo === 'desativar' && (
              <FormDesativar
                pessoa={p}
                opcoes={ativas.filter((a) => a.id !== p.id)}
                euId={euId}
                ocupado={ocupado}
                aoCancelar={() => {
                  setAberto(null);
                }}
                aoConfirmar={(novoResponsavelId) =>
                  void executar(
                    p.id,
                    () => chamar(`/api/equipe/${p.id}/desativar`, 'POST', { novoResponsavelId }),
                    `${p.nome} não entra mais no sistema.`,
                  )
                }
              />
            )}

            {aviso?.onde === p.id && <Aviso {...aviso} />}

            {aberto?.id !== p.id && (
              <div className={estilos.acoes}>
                <button
                  type="button"
                  className={estilos.secundario}
                  onClick={() => {
                    setAviso(null);
                    setAberto({ id: p.id, modo: 'editar' });
                  }}
                >
                  Editar
                </button>
                {p.ativo && p.id !== euId && (
                  <button
                    type="button"
                    className={estilos.secundario}
                    onClick={() => {
                      setAviso(null);
                      setAberto({ id: p.id, modo: 'desativar' });
                    }}
                  >
                    Desativar
                  </button>
                )}
                {!p.ativo && (
                  <button
                    type="button"
                    className={estilos.secundario}
                    disabled={ocupado}
                    onClick={() =>
                      void executar(
                        p.id,
                        () => chamar(`/api/equipe/${p.id}/reativar`, 'POST'),
                        `${p.nome} pode entrar de novo.`,
                      )
                    }
                  >
                    Reativar
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      <form className={estilos.cartao} onSubmit={(e) => void adicionar(e)}>
        <h2>Adicionar pessoa</h2>
        <label className={estilos.campo}>
          Nome
          <input name="nome" required maxLength={80} autoComplete="off" />
        </label>
        <label className={estilos.campo}>
          E-mail Google
          <input name="email" type="email" required autoComplete="off" inputMode="email" />
        </label>
        <EscolhaPapel nome="papel" inicial="membro" />
        {aviso?.onde === 'novo' && <Aviso {...aviso} />}
        <button type="submit" className={estilos.principal} disabled={ocupado}>
          {ocupado ? 'Salvando…' : 'Adicionar'}
        </button>
      </form>
    </div>
  );
}

function Aviso({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <p className={ok ? estilos.ok : estilos.erro} role="status">
      {texto}
    </p>
  );
}

function EscolhaPapel({
  nome,
  inicial,
  desativado,
  aoMudar,
}: {
  nome: string;
  inicial: Papel;
  desativado?: boolean;
  aoMudar?: (papel: Papel) => void;
}) {
  return (
    <fieldset className={estilos.papeis} disabled={desativado}>
      <legend>Papel</legend>
      {(['membro', 'admin'] as const).map((papel) => (
        <label key={papel} className={estilos.opcao}>
          <input
            type="radio"
            name={nome}
            value={papel}
            defaultChecked={papel === inicial}
            onChange={() => aoMudar?.(papel)}
          />
          {papel === 'admin' ? 'Administrador: configura tudo e vê todos' : 'Membro: vê só os seus'}
        </label>
      ))}
    </fieldset>
  );
}

function FormEdicao({
  pessoa,
  propria,
  ocupado,
  aoCancelar,
  aoSalvar,
}: {
  pessoa: PessoaEquipe;
  propria: boolean;
  ocupado: boolean;
  aoCancelar: () => void;
  aoSalvar: (nome: string, papel: Papel) => void;
}) {
  const [nome, setNome] = useState(pessoa.nome);
  const [papel, setPapel] = useState<Papel>(pessoa.papel);
  return (
    <form
      className={estilos.painel}
      onSubmit={(e) => {
        e.preventDefault();
        aoSalvar(nome, papel);
      }}
    >
      <label className={estilos.campo}>
        Nome
        <input
          value={nome}
          required
          maxLength={80}
          onChange={(e) => {
            setNome(e.target.value);
          }}
        />
      </label>
      <EscolhaPapel
        nome={`papel-${pessoa.id}`}
        inicial={pessoa.papel}
        desativado={propria}
        aoMudar={setPapel}
      />
      {propria && <p className={estilos.dica}>Você não pode mudar o seu próprio papel.</p>}
      <div className={estilos.acoes}>
        <button type="submit" className={estilos.principal} disabled={ocupado}>
          Salvar
        </button>
        <button type="button" className={estilos.secundario} onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FormDesativar({
  pessoa,
  opcoes,
  euId,
  ocupado,
  aoCancelar,
  aoConfirmar,
}: {
  pessoa: PessoaEquipe;
  opcoes: PessoaEquipe[];
  euId: string;
  ocupado: boolean;
  aoCancelar: () => void;
  aoConfirmar: (novoResponsavelId: string) => void;
}) {
  const [novo, setNovo] = useState(euId);
  return (
    <form
      className={estilos.painel}
      onSubmit={(e) => {
        e.preventDefault();
        aoConfirmar(novo);
      }}
    >
      <p>{pessoa.nome} perde o acesso na hora.</p>
      {pessoa.emAndamento > 0 && (
        <label className={estilos.campo}>
          Quem assume os {textoEmAndamento(pessoa.emAndamento)}?
          <select
            value={novo}
            onChange={(e) => {
              setNovo(e.target.value);
            }}
          >
            {opcoes.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nome}
                {o.id === euId ? ' (você)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className={estilos.acoes}>
        <button type="submit" className={estilos.perigo} disabled={ocupado}>
          Desativar
        </button>
        <button type="button" className={estilos.secundario} onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
