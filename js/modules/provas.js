// modules/provas.js
// =============================================================================
// GESTÃO DE PROVAS (histórico de simulados e exames)
// =============================================================================

import {
  auth,
  obterProvas,
  salvarProva,
  excluirProvaPorId,
  atualizarProvaNoFirebase,
} from '../database.js';

import { formatarDataBR, escapeHtml, normalizarHashtags } from '../utils.js';
import { mostrarToast, confirmar } from '../components/toast.js';

export let todasAsProvas = [];

function getUid() {
  return auth?.currentUser?.uid || null;
}

// -----------------------------------------------------------------------------
// Carregamento
// -----------------------------------------------------------------------------

export async function carregarProvas() {
  const uid = getUid();
  if (!uid) {
    todasAsProvas.splice(0);
    return [];
  }

  const tbody = document.querySelector('#provas-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:1rem; font-style:italic; color:#836b51;">
          <div class="spinner"></div>
          <div>Carregando provas...</div>
        </td>
      </tr>
    `;
  }

  try {
    const data = await obterProvas(uid);
    todasAsProvas.splice(0, todasAsProvas.length, ...data);
    todasAsProvas.forEach(p => { p.aura = calcularAuraProva(p); });
    return data;
  } catch (err) {
    console.error('Erro ao carregar provas:', err);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Aura
// -----------------------------------------------------------------------------

function calcularPontosAuraProva(prova) {
  let pontos = 0;

  const pct = prova.porcentagem ?? 0;
  if (pct < 50) pontos += 3;
  else if (pct < 70) pontos += 2;
  else pontos += 1;

  const hoje = new Date();
  const realizada = new Date(prova.data);
  const diffDias = Math.floor((hoje - realizada) / (1000 * 60 * 60 * 24));
  if (diffDias >= 30) pontos += 3;
  else if (diffDias >= 14) pontos += 2;
  else pontos += 1;

  return pontos;
}

export function calcularAuraProva(prova) {
  const pontos = calcularPontosAuraProva(prova);
  if (pontos >= 6) return 'urgente';
  if (pontos >= 5) return 'instavel';
  if (pontos >= 3) return 'estavel';
  return 'consolidada';
}

const AURA_RGB_PROVA = {
  urgente:    '204,36,29',
  instavel:   '214,93,14',
  estavel:    '215,153,33',
  consolidada:'152,151,26',
};

function auraBackgroundProva(prova) {
  const pontos = calcularPontosAuraProva(prova);
  const nivel  = calcularAuraProva(prova);
  // Mapeia pontos (2–6) → opacidade (0.40–0.85)
  const op = Math.min(0.85, 0.40 + ((pontos - 2) / 4) * 0.45).toFixed(2);
  return `rgba(${AURA_RGB_PROVA[nivel]},${op})`;
}

function labelAura(aura) {
  const map = {
    urgente:    'Refazer logo',
    instavel:   'Atenção em breve',
    estavel:    'Revisar em breve',
    consolidada:'Bem consolidada',
  };
  return map[aura] || '—';
}

// -----------------------------------------------------------------------------
// Renderização
// -----------------------------------------------------------------------------

export function renderTabelaProvas(provas, tbody) {
  if (!tbody) return;

  if (!provas || provas.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:1rem; font-style:italic; color:#836b51;">
          Nenhuma prova registrada ainda.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';

  const ordenadas = [...provas].sort((a, b) => new Date(b.data) - new Date(a.data));

  ordenadas.forEach(prova => {
    const aura = calcularAuraProva(prova);
    const bg   = auraBackgroundProva(prova);
    const pct = prova.porcentagem ?? Math.round((prova.acertos / prova.total) * 100);
    const tr = document.createElement('tr');
    tr.dataset.status = aura;
    tr.dataset.id = prova.id;

    const hashtags = (prova.hashtags || [])
      .map(t => `<span>#${escapeHtml(t.replace(/^#+/, ''))}</span>`)
      .join(' ');

    tr.innerHTML = `
      <td class="acoes">
        <button class="botao-editar-fragmento" data-id="${escapeHtml(prova.id)}" title="Editar prova"></button>
        <button class="botao-refazer" data-id="${escapeHtml(prova.id)}" title="Registrar nova tentativa">↺</button>
      </td>
      <td class="aura aura-${aura}" style="background-color:${bg}">${escapeHtml(prova.nome)}</td>
      <td>${formatarDataBR(prova.data)}</td>
      <td>${prova.acertos} / ${prova.total}</td>
      <td><strong>${pct}%</strong></td>
      <td class="hashtags">
        <div class="hashtags-inner">
          <div class="hashtags-container">${hashtags}</div>
          <button class="botao-excluir" data-id="${escapeHtml(prova.id)}" title="Excluir prova">✕</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
    tbody.appendChild(renderLinhaHistoricoProva(prova));
  });
}

function renderLinhaHistoricoProva(prova) {
  const trH = document.createElement('tr');
  trH.classList.add('linha-historico');
  trH.style.display = 'none';

  const historico = prova.historico || [];

  if (!historico.length) {
    trH.innerHTML = `
      <td colspan="6" class="historico-container">
        <em>Nenhuma tentativa anterior registrada.</em>
      </td>`;
    return trH;
  }

  const linhas = historico.map((t, i) => {
    const pct = t.porcentagem ?? Math.round((t.acertos / t.total) * 100);
    let delta = '—';
    if (i > 0) {
      const prev = historico[i - 1];
      const pctPrev = prev.porcentagem ?? Math.round((prev.acertos / prev.total) * 100);
      const diff = pct - pctPrev;
      if (diff > 0)      delta = `<span class="delta-positivo">+${diff}% ↑</span>`;
      else if (diff < 0) delta = `<span class="delta-negativo">${diff}% ↓</span>`;
      else               delta = '<span>= 0%</span>';
    }
    return `
      <tr>
        <td>${i + 1}</td>
        <td>${t.data ? formatarDataBR(t.data) : '—'}</td>
        <td>${t.acertos} / ${t.total}</td>
        <td><strong>${pct}%</strong></td>
        <td>${delta}</td>
        <td>
          <button class="botao-apagar-ciclo" data-id="${escapeHtml(prova.id)}" data-tentativa="${i}" title="Excluir tentativa">🧹</button>
        </td>
      </tr>`;
  }).join('');

  trH.innerHTML = `
    <td colspan="6" class="historico-container">
      <table class="historico-provas-table">
        <thead>
          <tr><th>#</th><th>Data</th><th>Acertos / Total</th><th>%</th><th>Δ</th><th></th></tr>
        </thead>
        <tbody>${linhas}</tbody>
      </table>
    </td>`;
  return trH;
}

// -----------------------------------------------------------------------------
// Eventos da tabela de provas
// -----------------------------------------------------------------------------

export function configurarEventosProvas(tbody, todasAsProvas, onRenderizar) {
  if (!tbody || tbody.__provaBound) return;
  tbody.__provaBound = true;

  tbody.addEventListener('click', async (e) => {
    // Editar
    const btnEdit = e.target.closest('.botao-editar-fragmento');
    if (btnEdit && tbody.contains(btnEdit)) {
      const tr = btnEdit.closest('tr');
      if (!tr.classList.contains('modo-edicao')) entrarModoEdicaoProva(tr, todasAsProvas);
      return;
    }

    // Refazer (nova tentativa)
    const btnRefazer = e.target.closest('.botao-refazer');
    if (btnRefazer && tbody.contains(btnRefazer)) {
      const tr = btnRefazer.closest('tr');
      if (!tr.classList.contains('modo-edicao')) entrarModoRefazer(tr, todasAsProvas);
      return;
    }

    // Salvar edição / refazer
    const btnSalvar = e.target.closest('.btn-salvar-edicao');
    if (btnSalvar && tbody.contains(btnSalvar)) {
      await salvarEdicaoInlineProva(btnSalvar.closest('tr'), todasAsProvas, onRenderizar);
      return;
    }

    // Cancelar edição / refazer
    const btnCancel = e.target.closest('.btn-cancelar-edicao');
    if (btnCancel && tbody.contains(btnCancel)) {
      const tr = btnCancel.closest('tr');
      delete tr.dataset.mode;
      sairModoEdicaoProva(tr);
      return;
    }

    // Excluir tentativa anterior
    const btnTentativa = e.target.closest('.botao-apagar-ciclo[data-tentativa]');
    if (btnTentativa && tbody.contains(btnTentativa)) {
      e.stopPropagation();
      const id = btnTentativa.dataset.id;
      const idx = Number(btnTentativa.dataset.tentativa);
      if (Number.isNaN(idx)) return;
      const ok = await confirmar(`Excluir a tentativa ${idx + 1}? Esta ação não pode ser desfeita.`, 'Excluir');
      if (!ok) return;
      const uid = getUid();
      if (!uid) return;
      const prova = todasAsProvas.find(p => p.id === id);
      if (!prova || !Array.isArray(prova.historico)) return;
      const backup = [...prova.historico];
      prova.historico.splice(idx, 1);
      try {
        await atualizarProvaNoFirebase(id, { historico: [...prova.historico] }, uid);
        onRenderizar();
      } catch (err) {
        prova.historico = backup;
        console.error('Erro ao excluir tentativa:', err);
        mostrarToast('Não foi possível excluir a tentativa.', 'erro');
      }
      return;
    }

    // Excluir prova
    const btnDel = e.target.closest('.botao-excluir');
    if (btnDel && tbody.contains(btnDel)) {
      e.stopPropagation();
      const id = btnDel.dataset.id;
      const ok = await handleExcluirProva(id);
      if (ok) onRenderizar();
      return;
    }

    // Toggle historico (clique na linha)
    const tr = e.target.closest('tr:not(.linha-historico)');
    if (tr && tbody.contains(tr) && !tr.classList.contains('modo-edicao')
        && !e.target.closest('.botao-excluir')
        && !e.target.closest('.hashtags-container')
        && !e.target.closest('.botao-editar-fragmento')
        && !e.target.closest('.botao-refazer')) {
      const trH = tr.nextElementSibling;
      if (trH && trH.classList.contains('linha-historico')) {
        const visible = trH.style.display !== 'none';
        trH.style.display = visible ? 'none' : 'table-row';
        tr.classList.toggle('expandido', !visible);
      }
    }
  });
}

function entrarModoEdicaoProva(tr, dados) {
  const id = tr.dataset.id;
  const prova = dados.find(p => p.id === id);
  if (!prova) return;

  tr.classList.add('modo-edicao');

  const tdAcoes = tr.querySelector('td.acoes');
  tdAcoes.dataset.orig = tdAcoes.innerHTML;
  tdAcoes.innerHTML = `
    <button class="btn-salvar-edicao" title="Salvar">✓</button>
    <button class="btn-cancelar-edicao" title="Cancelar">✕</button>
  `;

  const tdNome = tr.querySelector('td.aura');
  tdNome.dataset.orig = tdNome.textContent;
  tdNome.innerHTML = `<input class="inline-input" type="text" name="nome" value="${escapeHtml(prova.nome)}">`;

  const tds = tr.querySelectorAll('td:not(.acoes):not(.aura):not(.hashtags)');

  const tdData = tds[0];
  tdData.dataset.orig = tdData.textContent;
  tdData.innerHTML = `<input class="inline-input" type="date" name="data">`;
  tdData.querySelector('input[name="data"]').value = prova.data || '';

  const tdAcertosTotal = tds[1];
  tdAcertosTotal.dataset.orig = tdAcertosTotal.textContent;
  tdAcertosTotal.innerHTML = `
    <input class="inline-input inline-input--num" type="number" name="acertos" value="${prova.acertos ?? ''}" min="0" style="width:42px">
    <span style="margin:0 2px">/</span>
    <input class="inline-input inline-input--num" type="number" name="total" value="${prova.total ?? ''}" min="1" style="width:42px">
  `;

  const tdPct = tds[2];
  tdPct.dataset.orig = tdPct.innerHTML;

  const tdHash = tr.querySelector('td.hashtags');
  tdHash.dataset.orig = tdHash.innerHTML;
  const hashText = (prova.hashtags || []).map(t => '#' + t.replace(/^#+/, '')).join(' ');
  tdHash.innerHTML = `<input class="inline-input" type="text" name="hashtag" value="${escapeHtml(hashText)}" placeholder="#tag1 #tag2">`;

  tr.querySelector('input[name="nome"]').focus();
}

function entrarModoRefazer(tr, dados) {
  tr.dataset.mode = 'refazer';
  entrarModoEdicaoProva(tr, dados);
  const today = new Date().toISOString().split('T')[0];
  const inputData = tr.querySelector('input[name="data"]');
  if (inputData) inputData.value = today;
  const inputAcertos = tr.querySelector('input[name="acertos"]');
  if (inputAcertos) { inputAcertos.value = ''; inputAcertos.focus(); }
}

function sairModoEdicaoProva(tr) {
  tr.classList.remove('modo-edicao');
  tr.querySelectorAll('[data-orig]').forEach(td => {
    td.innerHTML = td.dataset.orig;
    delete td.dataset.orig;
  });
}

async function salvarEdicaoInlineProva(tr, dados, onRenderizar) {
  const uid = getUid();
  if (!uid) return;
  const id = tr.dataset.id;
  const isRefazer = tr.dataset.mode === 'refazer';
  if (isRefazer) delete tr.dataset.mode;

  const nome = tr.querySelector('input[name="nome"]')?.value.trim();
  const data = tr.querySelector('input[name="data"]')?.value;
  const acertosVal = tr.querySelector('input[name="acertos"]')?.value;
  const totalVal = tr.querySelector('input[name="total"]')?.value;
  const hashtagsTexto = tr.querySelector('input[name="hashtag"]')?.value || '';

  if (!nome) { mostrarToast('O nome não pode ficar vazio.', 'aviso'); return; }
  if (isRefazer && (!acertosVal || !data)) {
    mostrarToast('Preencha a data e os acertos da nova tentativa.', 'aviso'); return;
  }

  const acertos = parseInt(acertosVal, 10);
  const total = parseInt(totalVal, 10);

  if (!isNaN(acertos) && !isNaN(total) && acertos > total) {
    mostrarToast('Acertos não pode ser maior que o total.', 'aviso');
    return;
  }

  const atualizados = { nome };
  if (data) atualizados.data = data;
  if (!isNaN(acertos)) atualizados.acertos = acertos;
  if (!isNaN(total) && total > 0) {
    atualizados.total = total;
    const ac = isNaN(acertos) ? (dados.find(p => p.id === id)?.acertos ?? 0) : acertos;
    atualizados.porcentagem = Math.round((ac / total) * 100);
  }
  atualizados.hashtags = normalizarHashtags(hashtagsTexto);

  if (isRefazer) {
    const provaAtual = dados.find(p => p.id === id);
    if (provaAtual) {
      const tentativa = {
        data: provaAtual.data,
        acertos: provaAtual.acertos,
        total: provaAtual.total,
        porcentagem: provaAtual.porcentagem,
      };
      atualizados.historico = [...(provaAtual.historico || []), tentativa];
    }
  }

  const btnSalvar = tr.querySelector('.btn-salvar-edicao');
  if (btnSalvar) btnSalvar.disabled = true;

  try {
    await atualizarProvaNoFirebase(id, atualizados, uid);
    const prova = dados.find(p => p.id === id);
    if (prova) Object.assign(prova, atualizados);
    onRenderizar();
    mostrarToast('Prova atualizada.', 'sucesso');
  } catch (err) {
    console.error('Erro ao editar prova:', err);
    mostrarToast('Não foi possível salvar. Tente novamente.', 'erro');
    if (btnSalvar) btnSalvar.disabled = false;
  }
}

// -----------------------------------------------------------------------------
// Criação de nova prova
// -----------------------------------------------------------------------------

export async function handleNovaProva({ nome, data, acertos, total, hashtags }) {
  const uid = getUid();
  if (!uid) { mostrarToast('Faça login para salvar provas.', 'erro'); return false; }
  if (!nome) { mostrarToast('Insira o nome da prova.', 'aviso'); return false; }
  if (!data) { mostrarToast('Insira a data de realização.', 'aviso'); return false; }

  const acertosNum = parseInt(acertos, 10);
  const totalNum = parseInt(total, 10);

  if (isNaN(acertosNum) || isNaN(totalNum) || totalNum <= 0) {
    mostrarToast('Acertos e total precisam ser números válidos (total > 0).', 'aviso');
    return false;
  }
  if (acertosNum > totalNum) {
    mostrarToast('Acertos não pode ser maior que o total de questões.', 'aviso');
    return false;
  }

  const porcentagem = Math.round((acertosNum / totalNum) * 100);
  const novaProva = {
    nome: nome.trim(),
    data,
    acertos: acertosNum,
    total: totalNum,
    porcentagem,
    hashtags: normalizarHashtags(hashtags || ''),
    historico: [],
    revisaoTimestamp: Date.now(),
  };
  novaProva.aura = calcularAuraProva(novaProva);

  await salvarProva(novaProva, uid);
  todasAsProvas.push(novaProva);

  return true;
}

// -----------------------------------------------------------------------------
// Exclusão
// -----------------------------------------------------------------------------

export async function handleExcluirProva(id) {
  const uid = getUid();
  if (!uid) return;
  const prova = todasAsProvas.find(p => p.id === id);
  if (!prova) return;
  const ok = await confirmar(`Excluir a prova "${escapeHtml(prova.nome)}"? Esta ação não pode ser desfeita.`, 'Excluir');
  if (!ok) return;
  await excluirProvaPorId(id, uid);
  const idx = todasAsProvas.findIndex(p => p.id === id);
  if (idx !== -1) todasAsProvas.splice(idx, 1);
  return true;
}

// -----------------------------------------------------------------------------
// Métricas de resumo
// -----------------------------------------------------------------------------

export function calcularMetricasProvas(provas) {
  if (!provas || provas.length === 0) {
    return { totalProvas: 0, mediaGeral: 0, melhor: null, pior: null };
  }

  const totalProvas = provas.length;
  const totalAcertos = provas.reduce((s, p) => s + p.acertos, 0);
  const totalQuestoes = provas.reduce((s, p) => s + p.total, 0);
  const mediaGeral = totalQuestoes > 0 ? Math.round((totalAcertos / totalQuestoes) * 100) : 0;

  const ordenadas = [...provas].sort((a, b) => b.porcentagem - a.porcentagem);
  const melhor = ordenadas[0];
  const pior = ordenadas[ordenadas.length - 1];

  return { totalProvas, mediaGeral, melhor, pior };
}
