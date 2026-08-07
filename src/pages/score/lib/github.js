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

// ─────────────────────────────────────────────────────────────────────────
// Versões "grandes" — usam a Git Data API (blobs + trees + commits) em vez
// da Contents API simples acima. A Contents API tem um limite de ~1MB por
// arquivo (tanto pra ler quanto pra escrever); a Git Data API não tem esse
// limite prático (suporta blobs de até 100MB). Usadas pelos CSVs que podem
// crescer bastante com o tempo (SLA bruto, CSAT, Abrangência) — os arquivos
// pequenos (metadados, histórico) continuam usando commitArquivo/lerArquivoGithub
// acima, sem necessidade de trocar.
//
// O preço de usar a Git Data API é mais chamadas por commit (5 requests em
// vez de 1-2), mas o resultado final é idêntico: um commit normal no
// repositório, que dispara o mesmo redeploy automático do Vercel.

function headersGithub(token) {
  return {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'score-parca-app',
    'Content-Type': 'application/json',
  };
}

async function jsonOuErro(resp, contexto) {
  if (!resp.ok) {
    const texto = await resp.text();
    throw new Error(`${contexto} (status ${resp.status}): ${texto}`);
  }
  return resp.json();
}

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Faz uma tentativa completa do fluxo de 6 passos da Git Data API. Separado
// de commitArquivoGrande() pra poder ser repetido em caso de conflito no
// passo 6 (ver comentário abaixo).
async function tentarCommitArquivoGrande({ base, headers, branch, caminho, conteudo }) {
  // 1. Ref do branch → sha do commit atual
  const refResp = await fetch(`${base}/git/ref/heads/${branch}`, { headers });
  const refData = await jsonOuErro(refResp, `Falha ao ler a ref de ${branch}`);
  const commitShaAtual = refData.object.sha;

  // 2. Commit atual → sha da tree base
  const commitResp = await fetch(`${base}/git/commits/${commitShaAtual}`, { headers });
  const commitData = await jsonOuErro(commitResp, 'Falha ao ler o commit atual');
  const treeShaBase = commitData.tree.sha;

  // 3. Cria o blob com o conteúdo novo
  const blobResp = await fetch(`${base}/git/blobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: Buffer.from(conteudo, 'utf8').toString('base64'), encoding: 'base64' }),
  });
  const blobData = await jsonOuErro(blobResp, `Falha ao criar o blob de ${caminho}`);

  // 4. Cria uma tree nova, baseada na atual, só trocando o arquivo em questão
  const treeResp = await fetch(`${base}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: treeShaBase,
      tree: [{ path: caminho, mode: '100644', type: 'blob', sha: blobData.sha }],
    }),
  });
  const treeData = await jsonOuErro(treeResp, `Falha ao criar a tree para ${caminho}`);

  // 5. Cria o commit apontando pra tree nova
  const novoCommitResp = await fetch(`${base}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: `Atualiza ${caminho} via dashboard`,
      tree: treeData.sha,
      parents: [commitShaAtual],
    }),
  });
  const novoCommitData = await jsonOuErro(novoCommitResp, `Falha ao criar o commit de ${caminho}`);

  // 6. Move o branch pra apontar pro commit novo. Se outra importação (ex.:
  // a semana seguinte, disparada antes desta terminar) mover o branch entre
  // os passos 1 e 6, o GitHub recusa este PATCH por não ser mais um
  // fast-forward válido — é o gatilho mais comum do "Erro ao salvar no
  // GitHub" quando duas importações se sobrepõem no tempo.
  const updateRefResp = await fetch(`${base}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ sha: novoCommitData.sha }),
  });
  if (!updateRefResp.ok) {
    const texto = await updateRefResp.text();
    const err = new Error(`Falha ao atualizar o branch ${branch} (status ${updateRefResp.status}): ${texto}`);
    err.conflitoDeRef = updateRefResp.status === 422 || updateRefResp.status === 409;
    throw err;
  }
}

export async function commitArquivoGrande({ owner, repo, branch, token, caminho, conteudo }) {
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = headersGithub(token);

  // Repete o fluxo inteiro (não só o passo 6) se o conflito for de ref, já
  // que a tree/commit foram construídos em cima de uma base que já não é
  // mais a ponta do branch — precisa reler tudo do zero pra tentar de novo.
  const MAX_TENTATIVAS = 3;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      await tentarCommitArquivoGrande({ base, headers, branch, caminho, conteudo });
      return;
    } catch (e) {
      const ultimaTentativa = tentativa === MAX_TENTATIVAS;
      if (!e.conflitoDeRef || ultimaTentativa) throw e;
      // Espera um pouco (com variação) antes de tentar de novo, pra dar
      // tempo da outra importação concorrente terminar.
      await esperar(400 * tentativa + Math.random() * 400);
    }
  }
}

export async function lerArquivoGithubGrande({ owner, repo, branch, token, caminho }) {
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const headers = headersGithub(token);

  // 1. Ref do branch → sha do commit atual
  const refResp = await fetch(`${base}/git/ref/heads/${branch}`, { headers });
  if (!refResp.ok) return null;
  const refData = await refResp.json();

  // 2. Commit atual → sha da tree raiz
  const commitResp = await fetch(`${base}/git/commits/${refData.object.sha}`, { headers });
  if (!commitResp.ok) return null;
  const commitData = await commitResp.json();

  // 3. Lista a tree inteira (recursiva) pra achar o sha do blob no caminho pedido
  const treeResp = await fetch(`${base}/git/trees/${commitData.tree.sha}?recursive=1`, { headers });
  if (!treeResp.ok) return null;
  const treeData = await treeResp.json();
  const entrada = (treeData.tree || []).find((e) => e.path === caminho);
  if (!entrada) return null; // arquivo ainda não existe

  // 4. Busca o conteúdo do blob direto (sem limite de ~1MB da Contents API)
  const blobResp = await fetch(`${base}/git/blobs/${entrada.sha}`, { headers });
  if (!blobResp.ok) return null;
  const blobData = await blobResp.json();
  return Buffer.from(blobData.content, 'base64').toString('utf8');
}
