// modules/fragmentos.js
/**
 * =============================================================================
 * GESTÃO DE FRAGMENTOS (escopo por usuário)
 * =============================================================================
 * Responsável por:
 * - Carregar fragmentos do Firestore
 * - Calcular aura (status de urgência)
 * - Renderizar tabela principal
 * - Manipular criação de novos fragmentos
 * - Configurar eventos de exclusão e histórico
 * =============================================================================
 */

import {
  auth,
  obterFragmentos,
  salvarFragmentoNoFirestore,
  excluirFragmentoPorId,
  excluirRevisaoDoCiclo,
  atualizarFragmentoNoFirebase
} from '../database.js';

import {
  exibirValorOuTraco,
  converterParaPorcentagem,
  pctNumber,
  normalizarHashtags,
  formatarDataRaw,
  formatarDataBR,
  escapeHtml
} from '../utils.js';
import { mostrarToast, confirmar } from '../components/toast.js';

import { atualizarTudo } from '../main.js';

// Arrays globais (espelham os fragmentos do usuário)
export let todosOsFragmentos = [];   // cópia "bruta" de todos
export let fragmentosData = [];      // cópia usada na UI (pode ser filtrada)

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
function getUid() {
  return auth?.currentUser?.uid || null;
}

// -----------------------------------------------------------------------------
// Carregamento
// -----------------------------------------------------------------------------

/**
 * Carrega fragmentos do usuário logado.
 * - Se não houver login → zera arrays
 * - Se houver → busca no Firestore, atualiza arrays e recalcula auras
 * @returns {Promise<Array>} Array de fragmentos
 */
export async function carregarFragmentos() {
  try {
    const uid = getUid();
    if (!uid) {
      todosOsFragmentos.splice(0);
      fragmentosData.splice(0);
      atualizarContadorFragmentosTotal();
      return [];
    }

    // Mensagem temporária de carregamento
    const tbody = document.querySelector("tbody");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding:1rem; font-style:italic; color:#666;">
            <div class="spinner"></div>
            <div>⏳ Carregando fragmentos...</div>
          </td>
        </tr>
      `;
    }

    // Busca no Firestore com timeout
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout ao carregar fragmentos')), 10000)
    );

    let data;
    try {
      data = await Promise.race([obterFragmentos(uid), timeoutPromise]);
    } catch (err) {
      console.error('Erro ao buscar fragmentos:', err);
      if (tbody) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align:center; padding:1rem; color:#c00;">
              Erro ao carregar fragmentos: ${err.message}
            </td>
          </tr>
        `;
      }
      throw err;
    }

    // Atualiza arrays globais (mantendo referências)
    todosOsFragmentos.splice(0, todosOsFragmentos.length, ...data);
    fragmentosData.splice(0, fragmentosData.length, ...data);

    // Recalcula aura de cada fragmento
    todosOsFragmentos.forEach(f => f.aura = calcularAura(f));
    fragmentosData.forEach(f => f.aura = calcularAura(f));

    atualizarContadorFragmentosTotal();
    return data;
  } catch (err) {
    console.error('Erro ao carregar fragmentos:', err);
    throw err;
  }
}

// -----------------------------------------------------------------------------
// Aura
// -----------------------------------------------------------------------------

/**
 * Calcula a aura (status de urgência) do fragmento.
 * - Considera desempenho (ecoInicial vs ecoFinal)
 * - Tempo desde última revisão
 * - Nível de confiança
 * @param {Object} item - Fragmento
 * @returns {string} "urgente" | "instavel" | "consolidada"
 */
export function calcularPontosAura(item) {
  let pontos = 0;

  const ecoInicial = pctNumber(item.ecoInicial);
  const ecoFinal = pctNumber(item.ecoFinal);
  const desempenho = (ecoInicial * 0.7) + (ecoFinal * 0.3);
  if (desempenho < 50) pontos += 3;
  else if (desempenho < 80) pontos += 2;
  else pontos += 1;
  const temHistorico = (item.historico?.length > 0) || (item.ciclos > 0);
  if (temHistorico) {
    const faixaInicial = ecoInicial < 50 ? 0 : ecoInicial < 80 ? 1 : 2;
    const faixaFinal   = ecoFinal   < 50 ? 0 : ecoFinal   < 80 ? 1 : 2;
    if (faixaFinal < faixaInicial) pontos += 1;
  }

  const hoje = new Date();
  const ultima = new Date(item.ultimaRevisao);
  const diffDias = Math.floor((hoje - ultima) / (1000 * 60 * 60 * 24));
  if (diffDias >= 14) pontos += 3;
  else if (diffDias >= 7) pontos += 2;
  else pontos += 1;

  const confianca = (item.confianca || '').toLowerCase();
  if (confianca === 'baixa') pontos += 2;
  else if (confianca === 'média') pontos += 1;

  return pontos;
}

export function calcularAura(item) {
  const pontos = calcularPontosAura(item);
  if (pontos >= 7) return 'urgente';
  if (pontos >= 5) return 'instavel';
  if (pontos >= 3) return 'estavel';
  return 'consolidada';
}

// RGB base de cada nível para interpolação de opacidade
const AURA_RGB = {
  urgente:    '204,36,29',
  instavel:   '214,93,14',
  estavel:    '215,153,33',
  consolidada:'152,151,26',
};

export function auraBackground(item) {
  const pontos = calcularPontosAura(item);
  const nivel  = calcularAura(item);
  // Mapeia pontos (2–9) → opacidade (0.40–0.85)
  const op = Math.min(0.85, 0.40 + ((pontos - 2) / 7) * 0.45).toFixed(2);
  return `rgba(${AURA_RGB[nivel]},${op})`;
}

// -----------------------------------------------------------------------------
// Renderização da tabela
// -----------------------------------------------------------------------------

/**
 * Renderiza tabela principal dos fragmentos.
 * Inclui linhas extras ocultas para histórico de revisões.
 */
export function renderTabela(fragmentos, tbody) {
  if (!tbody) return;

  if (!fragmentos || fragmentos.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding:1rem; font-style:italic; color:#666;">
          Nenhum fragmento encontrado.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';

  fragmentos.forEach(item => {
    const aura = calcularAura(item);
    const bg   = auraBackground(item);

    // Linha principal
    const tr = document.createElement('tr');
    tr.dataset.status = aura;
    tr.dataset.id = item.id;

    const temEcoInicial = item.ecoInicial != null && item.ecoInicial !== '';
    const temEcoFinal = item.ecoFinal != null && item.ecoFinal !== '';

    const qtdCiclos = (item.historico && item.historico.length)
      ? item.historico.length
      : (item.ciclos || 0);

    // Tooltips poéticas para confiança
    const tooltips = {
      "Baixa": "Confiança Baixa ✦ A memória é bruma, quase esquecida.",
      "Média": "Confiança Média ✦ A chama oscila, mas ainda ilumina.",
      "Alta": "Confiança Alta ✦ O saber ecoa firme, como pedra eterna."
    };
    const conf = (item.confianca || '').trim();
    const confClass = conf.toLowerCase();
    const tooltip = tooltips[conf] || "Confiança indefinida ✦ Ecos incertos...";

    tr.innerHTML = `
      <td class="acoes">
        <button class="botao-editar-fragmento" data-id="${escapeHtml(item.id)}" title="Editar fragmento"></button>
      </td>
      <td class="aura aura-${aura}" style="background-color:${bg}">${escapeHtml(item.tema)}</td>
      <td>${item.ultimaRevisao ? formatarDataBR(item.ultimaRevisao) : '—'}</td>
      <td>${exibirValorOuTraco(item.ecoInicial)}${temEcoInicial ? ' %' : ''}</td>
      <td>${exibirValorOuTraco(item.ecoFinal)}${temEcoFinal ? ' %' : ''}</td>
      <td>
        <span class="indicador indicador-${confClass}" data-tooltip="${escapeHtml(tooltip)}"></span>
        <span class="conf-label">${escapeHtml(conf)}</span>
      </td>
      <td>${qtdCiclos}</td>
      <td class="hashtags">
        <div class="hashtags-inner">
          <div class="hashtags-container">
            ${(item.hashtags || []).map(tag => { const t = tag.replace(/^#+/, ''); return `<span class="hashtag-clicavel" data-tag="${escapeHtml(t)}">#${escapeHtml(t)}</span>`; }).join(' ')}
          </div>
          <button class="botao-excluir" title="Excluir fragmento" data-id="${escapeHtml(item.id)}">✕</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    // Linha extra de histórico (colapsada por padrão)
    const trHistorico = document.createElement('tr');
    trHistorico.classList.add('linha-historico');
    trHistorico.style.display = 'none';

    if (item.historico && item.historico.length) {
      trHistorico.innerHTML = `
        <td colspan="8" class="historico-container">
          <ul class="lista-historico">
            ${item.historico.map((rev, i) => `
              <li>
                <div class="dados-ciclo">
                  <strong>Ciclo ${i + 1} :</strong>
                  <span class="tag-info">📅 Data: ${rev.data ? formatarDataBR(rev.data) : '—'}</span>
                  <span class="tag-info">🧠 Eco Inicial: ${exibirValorOuTraco(rev.ecoInicial)}${rev.ecoInicial != null ? ' %' : ''}</span>
                  <span class="tag-info">🧠 Eco Final: ${exibirValorOuTraco(pctNumber(rev.ecoFinal))}${rev.ecoFinal != null ? ' %' : ''}</span>
                  <span class="tag-info">✨ Confiança: ${escapeHtml(rev.confianca || '—')}</span>
                  <button class="botao-apagar-ciclo" data-id="${escapeHtml(item.id)}" data-ciclo="${i}" title="Excluir este ciclo">🧹</button>
                </div>
              </li>
            `).join('')}
          </ul>
        </td>
      `;
    } else {
      trHistorico.innerHTML = `
        <td colspan="8" class="historico-container">
          <em>Nenhum histórico anterior registrado.</em>
        </td>
      `;
    }
    tbody.appendChild(trHistorico);
  });

  atualizarContadorFragmentosTotal();
}

// -----------------------------------------------------------------------------
// Utilitários
// -----------------------------------------------------------------------------

/** Atualiza contador de fragmentos no header. */
export function atualizarContadorFragmentosTotal() {
  const el = document.getElementById('contador-fragmentos');
  if (el) el.textContent = todosOsFragmentos.length;
}

// -----------------------------------------------------------------------------
// Criação de novo fragmento
// -----------------------------------------------------------------------------

/**
 * Manipula criação de novo fragmento.
 * - Valida campos
 * - Converte ecoInicial/ecoFinal em porcentagem
 * - Gera id/timestamp
 * - Salva no Firestore
 * - Atualiza arrays globais
 * @returns {Promise<boolean>} Sucesso da operação
 */
export async function handleNovoFragmento({ tema, dataRaw, ecoInicialRaw, ecoFinalRaw, confianca, hashtagsTexto }) {
  const uid = getUid();
  if (!uid) { mostrarToast('Faça login para salvar fragmentos.', 'erro'); return false; }
  if (!tema) { mostrarToast('Por favor, insira um tema antes de adicionar o fragmento.', 'aviso'); return false; }
  if (!confianca) { mostrarToast('Por favor, selecione um nível de confiança.', 'aviso'); return false; }

  // Validação de formato (7/10, 7,10, 70 etc.)
  const formatoValido =
    /^(\d+)([\/,])(\d+)$|^\d+$/.test(ecoInicialRaw) &&
    /^(\d+)([\/,])(\d+)$|^\d+$/.test(ecoFinalRaw);
  if (!formatoValido) {
    mostrarToast('Digite os valores no formato correto: acertos/total (ex: 7/10).', 'aviso');
    return false;
  }

  const ecoInicial = converterParaPorcentagem(ecoInicialRaw);
  const ecoFinal = converterParaPorcentagem(ecoFinalRaw);

  if (Number.isNaN(ecoInicial) || Number.isNaN(ecoFinal) ||
      ecoInicial < 0 || ecoInicial > 100 ||
      ecoFinal < 0 || ecoFinal > 100) {
    mostrarToast('Os valores de acertos devem estar entre 0 e 100.', 'aviso');
    return false;
  }

  const data = formatarDataRaw(dataRaw);
  const timestamp = Date.now();
  const hashtags = normalizarHashtags(hashtagsTexto);

  const novoFragmento = {
    id: String(timestamp),
    ownerUid: uid,
    tema,
    ultimaRevisao: data,
    revisaoTimestamp: timestamp,
    ecoInicial,
    ecoFinal,
    ecoInicialRaw,
    ecoFinalRaw,
    confianca,
    hashtags,
    ciclos: 0,
    historico: []
  };

  await salvarFragmentoNoFirestore(novoFragmento, uid);

  // Atualiza arrays locais
  novoFragmento.aura = calcularAura(novoFragmento);
  todosOsFragmentos.push(novoFragmento);
  fragmentosData.push(novoFragmento);
  atualizarContadorFragmentosTotal();

  return true;
}

// -----------------------------------------------------------------------------
// Eventos da tabela
// -----------------------------------------------------------------------------

/**
 * Configura eventos interativos da tabela:
 * - Toggle histórico
 * - Excluir fragmento
 * - Excluir ciclo individual
 */
export function configurarEventosTabela(tbody, excluirCallback, el) {
  if (!tbody || tbody.__handlersBound) return;
  tbody.__handlersBound = true;

  tbody.addEventListener('keydown', async (e) => {
    const tr = e.target.closest('tr.modo-edicao');
    if (!tr) return;
    if (e.key === 'Enter') { e.preventDefault(); await salvarEdicaoInline(tr, el); }
    if (e.key === 'Escape') { sairModoEdicao(tr, fragmentosData); }
  });

  tbody.addEventListener('click', async (e) => {
    // --- Editar fragmento (entrar no modo inline) ---
    const btnEdit = e.target.closest('.botao-editar-fragmento');
    if (btnEdit && tbody.contains(btnEdit)) {
      const trPrincipal = btnEdit.closest('tr');
      if (!trPrincipal.classList.contains('modo-edicao')) {
        entrarModoEdicao(trPrincipal, fragmentosData);
      }
      return;
    }

    // --- Salvar edição inline ---
    const btnSalvar = e.target.closest('.btn-salvar-edicao');
    if (btnSalvar && tbody.contains(btnSalvar)) {
      const trPrincipal = btnSalvar.closest('tr');
      await salvarEdicaoInline(trPrincipal, el);
      return;
    }

    // --- Cancelar edição inline ---
    const btnCancel = e.target.closest('.btn-cancelar-edicao');
    if (btnCancel && tbody.contains(btnCancel)) {
      const trPrincipal = btnCancel.closest('tr');
      sairModoEdicao(trPrincipal, fragmentosData);
      return;
    }

    // --- Toggle histórico (clique na linha, excluindo botões especiais) ---
    const tr = e.target.closest('tr:not(.linha-historico)');
    if (tr && tbody.contains(tr) && !tr.classList.contains('modo-edicao') && !e.target.closest('.botao-excluir') && !e.target.closest('.hashtags-container') && !e.target.closest('.botao-editar-fragmento')) {
      const trHistorico = tr.nextElementSibling;
      if (trHistorico && trHistorico.classList.contains('linha-historico')) {
        const visible = trHistorico.style.display !== 'none';
        trHistorico.style.display = visible ? 'none' : 'table-row';
        tr.classList.toggle('expandido', !visible);
      }
      return;
    }

    // --- Excluir fragmento ---
    const btnDel = e.target.closest('.botao-excluir');
    if (btnDel && tbody.contains(btnDel)) {
      e.preventDefault();
      e.stopPropagation();
      const uid = getUid();
      if (!uid) return;
      const id = btnDel.dataset.id;
      const tr = btnDel.closest('tr');
      const nomeTema = tr.querySelector('td:nth-child(2)')?.textContent.trim() || 'Tema';
      if (!await confirmar(`Excluir o fragmento "${nomeTema}"? Esta ação não pode ser desfeita.`, 'Excluir')) return;
      btnDel.disabled = true;

      try {
        // Diferentes assinaturas possíveis do callback
        if (excluirCallback.length >= 3) {
          await excluirCallback(id, btnDel, uid);
        } else if (excluirCallback.length === 2) {
          await excluirCallback(id, uid);
        } else {
          await excluirFragmentoPorId(id, btnDel, uid);
        }

        // Remove dos arrays locais
        const removeById = (arr) => {
          const i = arr.findIndex(f => f.id === id);
          if (i > -1) arr.splice(i, 1);
        };
        removeById(todosOsFragmentos);
        removeById(fragmentosData);

        atualizarTudo(el, fragmentosData);
      } catch (err) {
        console.error('Erro ao excluir fragmento:', err);
        mostrarToast('Não foi possível excluir o fragmento. Tente novamente.', 'erro');
      } finally {
        btnDel.disabled = false;
      }
      return;
    }

    // --- Excluir ciclo individual ---
    const btnCiclo = e.target.closest('.botao-apagar-ciclo');
    if (btnCiclo && tbody.contains(btnCiclo)) {
      const uid = getUid();
      if (!uid) return;
      const id = btnCiclo.dataset.id;
      const cicloIndex = Number(btnCiclo.dataset.ciclo);
      if (Number.isNaN(cicloIndex)) return;

      const okCiclo = await confirmar(`Excluir o ciclo ${cicloIndex + 1} deste fragmento? Esta ação não pode ser desfeita.`, 'Excluir');
      if (!okCiclo) return;

      try {
        // Guarda quais históricos estavam abertos
        const abertos = [...tbody.querySelectorAll('.linha-historico')]
          .filter(tr => tr.style.display !== 'none')
          .map(tr => tr.previousElementSibling?.dataset.id);

        // Exclui no Firestore
        const atualizados = await excluirRevisaoDoCiclo(id, cicloIndex, fragmentosData, uid);
        if (atualizados) {
          atualizarTudo(el, atualizados);

          // Reabre históricos que estavam abertos
          abertos.forEach(openId => {
            const linha = tbody.querySelector(`tr[data-id="${openId}"]`);
            const historico = linha?.nextElementSibling;
            if (historico) historico.style.display = 'table-row';
          });
        }
      } catch (err) {
        console.error('Erro ao apagar ciclo:', err);
      }
      return;
    }
  });

}

function entrarModoEdicao(tr, dados) {
  const id = tr.dataset.id;
  const frag = dados.find(f => f.id === id);
  if (!frag) return;

  tr.classList.add('modo-edicao');

  // Coluna 1: acoes → salvar + cancelar
  const tdAcoes = tr.querySelector('td.acoes');
  tdAcoes.dataset.orig = tdAcoes.innerHTML;
  tdAcoes.innerHTML = `
    <button class="btn-salvar-edicao" title="Salvar">✓</button>
    <button class="btn-cancelar-edicao" title="Cancelar">✕</button>
  `;

  // Coluna 2: tema
  const tdTema = tr.querySelector('td.aura');
  tdTema.dataset.orig = tdTema.textContent;
  tdTema.innerHTML = `<input class="inline-input" type="text" name="tema" value="${escapeHtml(frag.tema)}" required>`;

  // Coluna 3: última revisão
  const tds = tr.querySelectorAll('td:not(.acoes):not(.aura):not(.hashtags)');
  const tdData = tds[0];
  tdData.dataset.orig = tdData.textContent;
  tdData.innerHTML = `<input class="inline-input" type="date" name="data">`;
  tdData.querySelector('input[name="data"]').value = frag.ultimaRevisao || '';

  // Coluna 4: eco inicial
  const tdEcoI = tds[1];
  tdEcoI.dataset.orig = tdEcoI.textContent;
  tdEcoI.innerHTML = `<input class="inline-input inline-input--num" type="number" name="ecoInicial" value="${frag.ecoInicial ?? ''}" min="0" max="100">`;

  // Coluna 5: eco final
  const tdEcoF = tds[2];
  tdEcoF.dataset.orig = tdEcoF.textContent;
  tdEcoF.innerHTML = `<input class="inline-input inline-input--num" type="number" name="ecoFinal" value="${frag.ecoFinal ?? ''}" min="0" max="100">`;

  // Coluna hashtags
  const tdHashtags = tr.querySelector('td.hashtags');
  tdHashtags.dataset.orig = tdHashtags.innerHTML;
  const hashtagsAtuais = (frag.hashtags || []).map(t => '#' + t.replace(/^#+/, '')).join(' ');
  tdHashtags.innerHTML = `<input class="inline-input" type="text" name="hashtags" value="${escapeHtml(hashtagsAtuais)}" placeholder="#tag1 #tag2">`;

  tr.querySelector('input[name="tema"]').focus();
}

function sairModoEdicao(tr, dados) {
  tr.classList.remove('modo-edicao');
  tr.querySelectorAll('[data-orig]').forEach(td => {
    td.innerHTML = td.dataset.orig;
    delete td.dataset.orig;
  });
}

async function salvarEdicaoInline(tr, el) {
  const uid = getUid();
  if (!uid) return;
  const id = tr.dataset.id;

  const tema = tr.querySelector('input[name="tema"]')?.value.trim();
  const data = tr.querySelector('input[name="data"]')?.value;
  const ecoInicialVal  = tr.querySelector('input[name="ecoInicial"]')?.value;
  const ecoFinalVal    = tr.querySelector('input[name="ecoFinal"]')?.value;
  const hashtagsTexto  = tr.querySelector('input[name="hashtags"]')?.value ?? '';

  if (!tema) { mostrarToast('O tema não pode ficar vazio.', 'aviso'); return; }

  const atualizados = { tema };
  if (data) atualizados.ultimaRevisao = data;
  if (ecoInicialVal !== '') atualizados.ecoInicial = Number(ecoInicialVal);
  if (ecoFinalVal   !== '') atualizados.ecoFinal   = Number(ecoFinalVal);
  atualizados.hashtags = normalizarHashtags(hashtagsTexto);

  const btnSalvar = tr.querySelector('.btn-salvar-edicao');
  btnSalvar.disabled = true;
  try {
    await atualizarFragmentoNoFirebase(id, atualizados, uid);
    [todosOsFragmentos, fragmentosData].forEach(arr => {
      const f = arr.find(f => f.id === id);
      if (f) Object.assign(f, atualizados);
    });
    atualizarTudo(el, fragmentosData);
    mostrarToast('Fragmento atualizado.', 'sucesso');
  } catch (err) {
    console.error('Erro ao editar fragmento:', err);
    mostrarToast('Não foi possível salvar. Tente novamente.', 'erro');
    btnSalvar.disabled = false;
  }
}

// -----------------------------------------------------------------------------
// Métricas de resumo
// -----------------------------------------------------------------------------

export function calcularMetricasFragmentos(fragmentos) {
  const total = fragmentos.length;
  if (!total) return { total: 0, urgentes: 0, ecoMedio: null, consolidados: 0 };
  const urgentes = fragmentos.filter(f => f.aura === 'urgente').length;
  const consolidados = fragmentos.filter(f => f.aura === 'consolidada').length;
  const comEco = fragmentos.filter(f => f.ecoFinal != null && f.ecoFinal !== '');
  const ecoMedio = comEco.length
    ? Math.round(comEco.reduce((s, f) => s + Number(f.ecoFinal), 0) / comEco.length)
    : null;
  return { total, urgentes, ecoMedio, consolidados };
}

// -----------------------------------------------------------------------------
// Debug helpers (disponíveis no console)
// -----------------------------------------------------------------------------
//window.fragmentosData = fragmentosData;
//window.todosOsFragmentos = todosOsFragmentos;