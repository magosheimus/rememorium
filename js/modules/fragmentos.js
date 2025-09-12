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
  excluirRevisaoDoCiclo
} from '../database.js';

import {
  exibirValorOuTraco,
  converterParaPorcentagem,
  pctNumber,
  normalizarHashtags,
  formatarDataRaw,
  formatarDataBR
} from '../utils.js';

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

    // Busca no Firestore
    const data = await obterFragmentos(uid);

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
export function calcularAura(item) {
  let pontos = 0;

  // --- Desempenho (pondera ecoInicial 70% + ecoFinal 30%)
  const ecoInicial = pctNumber(item.ecoInicial);
  const ecoFinal = pctNumber(item.ecoFinal);
  const desempenho = (ecoInicial * 0.7) + (ecoFinal * 0.3);
  if (desempenho < 50) pontos += 3;
  else if (desempenho < 80) pontos += 2;
  else pontos += 1;
  if (ecoFinal < ecoInicial) pontos += 1; // penaliza se piorou

  // --- Tempo desde última revisão
  const hoje = new Date();
  const ultima = new Date(item.ultimaRevisao);
  const diffDias = Math.floor((hoje - ultima) / (1000 * 60 * 60 * 24));
  if (diffDias >= 14) pontos += 3;
  else if (diffDias >= 7) pontos += 2;
  else pontos += 1;

  // --- Confiança subjetiva
  const confianca = (item.confianca || '').toLowerCase();
  if (confianca === 'baixo') pontos += 2;
  else if (confianca === 'médio') pontos += 1;

  // --- Classificação final
  if (pontos >= 7) return 'urgente';
  if (pontos >= 4) return 'instavel';
  return 'consolidada';
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
        <button class="botao-historico" data-id="${item.id}" title="Ver histórico">✎</button>
      </td>
      <td class="aura aura-${aura}">${item.tema}</td>
      <td>${item.ultimaRevisao ? formatarDataBR(item.ultimaRevisao) : '—'}</td>
      <td>${exibirValorOuTraco(item.ecoInicial)}${temEcoInicial ? ' %' : ''}</td>
      <td>${exibirValorOuTraco(item.ecoFinal)}${temEcoFinal ? ' %' : ''}</td>
      <td>
        <span class="indicador indicador-${confClass}" data-tooltip="${tooltip}"></span>
        <span class="conf-label">${conf}</span>
      </td>
      <td>${qtdCiclos}</td>
      <td class="hashtags">
        <div class="hashtags-inner">
          <div class="hashtags-container">
            ${(item.hashtags || []).map(tag => `<span>#${tag.replace(/^#+/, '')}</span>`).join(' ')}
          </div>
          <button class="botao-excluir" title="Excluir fragmento" data-id="${item.id}">✕</button>
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
                  <span class="tag-info">✨ Confiança: ${rev.confianca || '—'}</span>
                  <button class="botao-apagar-ciclo" data-id="${item.id}" data-ciclo="${i}" title="Excluir este ciclo">🧹</button>
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
  if (!uid) { alert('Faça login para salvar fragmentos.'); return false; }
  if (!tema) { alert("Por favor, insira um tema antes de adicionar o fragmento."); return false; }
  if (!confianca) { alert("Por favor, selecione um nível de confiança."); return false; }

  // Validação de formato (7/10, 7,10, 70 etc.)
  const formatoValido =
    /^(\d+)([\/,])(\d+)$|^\d+$/.test(ecoInicialRaw) &&
    /^(\d+)([\/,])(\d+)$|^\d+$/.test(ecoFinalRaw);
  if (!formatoValido) {
    alert("Digite os valores no formato correto: acertos/total ou acertos,total (ex: 7/10 ou 7,10).");
    return false;
  }

  const ecoInicial = converterParaPorcentagem(ecoInicialRaw);
  const ecoFinal = converterParaPorcentagem(ecoFinalRaw);

  if (Number.isNaN(ecoInicial) || Number.isNaN(ecoFinal) ||
      ecoInicial < 0 || ecoInicial > 100 ||
      ecoFinal < 0 || ecoFinal > 100) {
    alert("Os valores de acertos devem estar entre 0 e 100.");
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

  tbody.addEventListener('click', async (e) => {
    // --- Toggle histórico ---
    const btnHist = e.target.closest('.botao-historico');
    if (btnHist && tbody.contains(btnHist)) {
      const trPrincipal = btnHist.closest('tr');
      const trHistorico = trPrincipal?.nextElementSibling;
      if (trHistorico && trHistorico.classList.contains('linha-historico')) {
        const visible = trHistorico.style.display !== 'none';
        trHistorico.style.display = visible ? 'none' : 'table-row';
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
      if (!confirm(`Tem certeza que deseja excluir o fragmento "${nomeTema}"? Esta ação não pode ser desfeita.`)) return;
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
        alert('Não foi possível excluir o fragmento. Tente novamente.');
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

// -----------------------------------------------------------------------------
// Debug helpers (disponíveis no console)
// -----------------------------------------------------------------------------
//window.fragmentosData = fragmentosData;
//window.todosOsFragmentos = todosOsFragmentos;