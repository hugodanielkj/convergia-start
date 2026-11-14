'use client';

import { useState } from 'react';
import estilos from './templates.module.css';
import { ROTULO_TEMPLATE, mensagemDoErro, type TipoTemplate } from './mensagens';

export interface Template {
  tipo: TipoTemplate;
  texto: string;
  padrao: string;
  personalizado: boolean;
}

interface ErroApi {
  codigo: string;
  detalhe?: string;
}

function Editor({ inicial }: { inicial: Template }) {
  const [texto, setTexto] = useState(inicial.texto);
  const [salvo, setSalvo] = useState(inicial);
  const [previa, setPrevia] = useState<string | null>(null);
  const [erros, setErros] = useState<ErroApi[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const rotulo = ROTULO_TEMPLATE[inicial.tipo];

  async function chamar(metodo: string, caminho: string, corpo?: object) {
    setOcupado(true);
    setAviso(null);
    const r = await fetch(`/api/templates/${inicial.tipo}${caminho}`, {
      method: metodo,
      // Sem corpo, a API recusa o cabeçalho de JSON (o DELETE de restaurar não leva corpo).
      ...(corpo
        ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }
        : {}),
    });
    setOcupado(false);
    return r;
  }

  async function salvar() {
    const r = await chamar('PUT', '', { texto });
    if (r.status === 422) {
      setErros(((await r.json()) as { erros: ErroApi[] }).erros);
      return;
    }
    if (!r.ok) {
      setAviso('Não foi possível salvar.');
      return;
    }
    setErros([]);
    setSalvo({ ...salvo, texto, personalizado: texto !== inicial.padrao });
    setAviso('Salvo. As próximas mensagens já usam este texto.');
  }

  async function restaurar() {
    const r = await chamar('DELETE', '');
    if (!r.ok) {
      setAviso('Não foi possível restaurar.');
      return;
    }
    setTexto(inicial.padrao);
    setSalvo({ ...salvo, texto: inicial.padrao, personalizado: false });
    setErros([]);
    setPrevia(null);
    setAviso('Texto padrão restaurado.');
  }

  async function visualizar() {
    const r = await chamar('POST', '/previa', { texto });
    if (!r.ok) return;
    const corpo = (await r.json()) as { previa: string; erros: ErroApi[] };
    setPrevia(corpo.previa);
    setErros(corpo.erros);
  }

  return (
    <section className={estilos.cartao}>
      <h2>{rotulo.titulo}</h2>
      <p className={estilos.dica}>
        {rotulo.quando} {salvo.personalizado ? 'Texto personalizado.' : 'Texto padrão.'}
      </p>
      <textarea
        aria-label={rotulo.titulo}
        value={texto}
        maxLength={1600}
        rows={7}
        onChange={(e) => {
          setTexto(e.target.value);
          setAviso(null);
        }}
      />
      {erros.length > 0 && (
        <ul className={estilos.erros}>
          {erros.map((e) => (
            <li key={`${e.codigo}${e.detalhe ?? ''}`}>{mensagemDoErro(e)}</li>
          ))}
        </ul>
      )}
      <div className={estilos.botoes}>
        <button type="button" disabled={ocupado} onClick={() => void salvar()}>
          Salvar
        </button>
        <button
          type="button"
          className={estilos.secundario}
          disabled={ocupado}
          onClick={() => void visualizar()}
        >
          Pré-visualizar
        </button>
        <button
          type="button"
          className={estilos.secundario}
          disabled={ocupado || !salvo.personalizado}
          onClick={() => void restaurar()}
        >
          Restaurar padrão
        </button>
      </div>
      {aviso && <p className={estilos.ok}>{aviso}</p>}
      {previa !== null && <pre className={estilos.previa}>{previa}</pre>}
    </section>
  );
}

export function EditorTemplates({
  inicial,
  variaveis,
}: {
  inicial: Template[];
  variaveis: string[];
}) {
  return (
    <div className={estilos.pagina}>
      <h1>Mensagens</h1>
      <p>Edite os textos enviados ao cliente. Nunca peça senha: o cliente usa o link do sistema.</p>
      <p className={estilos.dica}>Variáveis: {variaveis.map((v) => `{{${v}}}`).join(' ')}</p>
      {inicial.map((t) => (
        <Editor key={t.tipo} inicial={t} />
      ))}
    </div>
  );
}
