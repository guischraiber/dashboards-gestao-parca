// Helper compartilhado: salva um arquivo no repositório do GitHub via API,
// usado tanto pela importação de dados quanto pelo salvamento de configuração.
// Como o Vercel está conectado a esse repositório, cada commit dispara um
// redeploy automático.

export async function commitArquivo({ owner, repo, branch, token, caminho, conteudo }) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${caminho}`;

  // Precisa do sha atual do arquivo pra "atualizar" (senão o GitHub recusa)
  let sha;
  const getResp = await fetch(`${apiUrl}?ref=${branch}`, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'score-parca-app' },
  });
  if (getResp.ok) {
    const data = await getResp.json();
    sha = data.sha;
  }

  const body = {
    message: `Atualiza ${caminho} via dashboard`,
    content: Buffer.from(conteudo, 'utf8').toString('base64'),
    branch,
  };
  if (sha) body.sha = sha;

  const putResp = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'score-parca-app',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!putResp.ok) {
    const texto = await putResp.text();
    throw new Error(`Falha ao salvar ${caminho} no GitHub (status ${putResp.status}): ${texto}`);
  }
}

export async function lerArquivoGithub({ owner, repo, branch, token, caminho }) {
  const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${caminho}`;
  const resp = await fetch(`${apiUrl}?ref=${branch}`, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'score-parca-app' },
  });
  if (!resp.ok) return null; // arquivo ainda não existe
  const data = await resp.json();
  return Buffer.from(data.content, 'base64').toString('utf8');
}

export function credenciaisGithub() {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || 'main';
  return { token, owner, repo, branch };
}
