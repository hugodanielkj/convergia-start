import type { Metadata } from 'next';
import estilos from './entrar.module.css';

export const metadata: Metadata = { title: 'Entrar · Convergia Start' };

// Mensagens propositalmente genéricas: não revelam se um e-mail existe no sistema.
const MENSAGENS: Record<string, string> = {
  'nao-autorizado':
    'Esta conta Google não tem acesso ao painel. Confira se entrou com o e-mail cadastrado.',
  falha: 'Não foi possível concluir o login. Tente novamente.',
  indisponivel: 'O login com Google ainda não está configurado neste ambiente.',
};

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;
  const mensagem = erro ? (MENSAGENS[erro] ?? MENSAGENS['falha']) : undefined;

  return (
    <main className={estilos.pagina}>
      <h1>Convergia Start</h1>
      <p className={estilos.subtitulo}>Painel de onboarding da agência</p>
      {mensagem && (
        <p role="alert" className={estilos.erro}>
          {mensagem}
        </p>
      )}
      {/* Link comum (não <Link>): a navegação sai do app para o Google. */}
      <a href="/api/auth/google" className={estilos.botao}>
        Entrar com Google
      </a>
    </main>
  );
}
