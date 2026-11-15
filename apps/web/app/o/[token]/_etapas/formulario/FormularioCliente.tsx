'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import estilos from './formulario.module.css';
import { mensagensPorCampo } from './mensagens';
import type { Campo, ErroResposta, EstadoFormulario, Respostas, ValorResposta } from './tipos';
import { useAvancoEtapa } from '../../_componentes/avanco';

const ESPERA_AUTOSAVE_MS = 1000;

type Aviso = { tom: 'ok' | 'erro'; texto: string } | null;

export function FormularioCliente({
  token,
  inicial,
}: {
  token: string;
  inicial: EstadoFormulario;
}) {
  const base = `/api/publico/onboardings/${encodeURIComponent(token)}`;
  const [respostas, setRespostas] = useState<Respostas>(inicial.respostas);
  const [situacao, setSituacao] = useState(inicial.situacao);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<Aviso>(null);
  const [salvando, setSalvando] = useState(false);
  const router = useRouter();
  const { avancar } = useAvancoEtapa();
  const sujo = useRef(false);
  const editavel = inicial.editavel && situacao !== 'fechado';

  // Rascunho automático (RN-18): salva pouco depois da última digitação.
  useEffect(() => {
    if (!sujo.current || situacao !== 'rascunho') return;
    const espera = setTimeout(() => {
      void (async () => {
        const r = await fetch(`${base}/formulario/rascunho`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ respostas }),
        });
        sujo.current = false;
        setAviso(
          r.ok
            ? { tom: 'ok', texto: 'Rascunho salvo automaticamente.' }
            : { tom: 'erro', texto: 'Não foi possível salvar o rascunho agora.' },
        );
      })();
    }, ESPERA_AUTOSAVE_MS);
    return () => {
      clearTimeout(espera);
    };
  }, [respostas, situacao, base]);

  function alterar(chave: string, valor: ValorResposta) {
    sujo.current = true;
    setRespostas((atuais) => ({ ...atuais, [chave]: valor }));
    setAviso(null);
  }

  async function enviar() {
    setSalvando(true);
    setAviso(null);
    const r = await fetch(`${base}/formulario/enviar`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ respostas }),
    });
    setSalvando(false);
    if (r.ok) {
      sujo.current = false;
      setErros({});
      const primeiroEnvio = situacao === 'rascunho';
      setSituacao('enviado');
      // RN-79: no primeiro envio o cliente segue para Acessos; editando depois, só atualiza.
      if (primeiroEnvio) avancar();
      else router.refresh(); // atualiza o selo da etapa e a barra de progresso
      setAviso({ tom: 'ok', texto: 'Respostas enviadas. Você pode editar até a nossa reunião.' });
      return;
    }
    const corpo = (await r.json().catch(() => ({}))) as { erros?: ErroResposta[]; erro?: string };
    if (corpo.erros) {
      setErros(mensagensPorCampo(corpo.erros));
      setAviso({ tom: 'erro', texto: 'Confira os campos destacados.' });
    } else if (corpo.erro === 'FORMULARIO_FECHADO' || corpo.erro === 'REUNIAO_REALIZADA') {
      setSituacao('fechado');
    } else {
      setAviso({ tom: 'erro', texto: 'Não foi possível enviar agora. Tente de novo.' });
    }
  }

  return (
    <form
      className={estilos.form}
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      {inicial.campos.map((campo) => (
        <Pergunta key={campo.chave} campo={campo} erro={erros[campo.chave]}>
          <Entrada
            campo={campo}
            valor={respostas[campo.chave]}
            desabilitado={!editavel}
            aoAlterar={(v) => {
              alterar(campo.chave, v);
            }}
          />
        </Pergunta>
      ))}

      {aviso && (
        <p role={aviso.tom === 'erro' ? 'alert' : 'status'} className={estilos[aviso.tom]}>
          {aviso.texto}
        </p>
      )}
      {!editavel ? (
        <p className={estilos.ok}>
          As respostas foram fechadas pela agência e não podem mais ser editadas.
        </p>
      ) : (
        <button type="submit" className={estilos.botao} disabled={salvando}>
          {salvando
            ? 'Enviando…'
            : situacao === 'enviado'
              ? 'Salvar alterações'
              : 'Enviar respostas'}
        </button>
      )}
    </form>
  );
}

function Pergunta({
  campo,
  erro,
  children,
}: {
  campo: Campo;
  erro?: string | undefined;
  children: ReactNode;
}) {
  return (
    <div className={estilos.pergunta}>
      <label htmlFor={`c-${campo.chave}`} className={estilos.rotulo}>
        {campo.rotulo}
        {campo.obrigatorio && <span aria-label="obrigatório"> *</span>}
      </label>
      {campo.ajuda && <p className={estilos.ajuda}>{campo.ajuda}</p>}
      {children}
      {erro && (
        <p role="alert" className={estilos.erro}>
          {erro}
        </p>
      )}
    </div>
  );
}

function Entrada({
  campo,
  valor,
  desabilitado,
  aoAlterar,
}: {
  campo: Campo;
  valor: ValorResposta | undefined;
  desabilitado: boolean;
  aoAlterar: (valor: ValorResposta) => void;
}) {
  const id = `c-${campo.chave}`;
  const texto = typeof valor === 'string' || typeof valor === 'number' ? String(valor) : '';

  switch (campo.tipo) {
    case 'texto_longo':
      return (
        <textarea
          id={id}
          rows={4}
          value={texto}
          disabled={desabilitado}
          onChange={(e) => {
            aoAlterar(e.target.value);
          }}
        />
      );
    case 'numero':
      return (
        <input
          id={id}
          type="number"
          value={texto}
          disabled={desabilitado}
          onChange={(e) => {
            aoAlterar(e.target.value === '' ? '' : Number(e.target.value));
          }}
        />
      );
    case 'data':
      return (
        <input
          id={id}
          type="date"
          value={texto}
          disabled={desabilitado}
          onChange={(e) => {
            aoAlterar(e.target.value);
          }}
        />
      );
    case 'url':
      return (
        <input
          id={id}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={texto}
          disabled={desabilitado}
          onChange={(e) => {
            aoAlterar(e.target.value);
          }}
        />
      );
    case 'selecao_unica':
      return (
        <select
          id={id}
          value={texto}
          disabled={desabilitado}
          onChange={(e) => {
            aoAlterar(e.target.value);
          }}
        >
          <option value="">Selecione…</option>
          {campo.opcoes?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    case 'multipla_escolha': {
      const marcadas = Array.isArray(valor) ? valor : [];
      return (
        <div id={id} className={estilos.opcoes}>
          {campo.opcoes?.map((o) => (
            <label key={o} className={estilos.marcar}>
              <input
                type="checkbox"
                checked={marcadas.includes(o)}
                disabled={desabilitado}
                onChange={(e) => {
                  aoAlterar(e.target.checked ? [...marcadas, o] : marcadas.filter((m) => m !== o));
                }}
              />
              {o}
            </label>
          ))}
        </div>
      );
    }
    case 'texto_curto':
      return (
        <input
          id={id}
          type="text"
          value={texto}
          disabled={desabilitado}
          onChange={(e) => {
            aoAlterar(e.target.value);
          }}
        />
      );
  }
}
