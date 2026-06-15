// modules/dashboard.js
/**
 * =============================================================================
 * MÓDULO DO DASHBOARD / PAINEL PRINCIPAL
 * =============================================================================
 * Funções específicas para a página inicial do Rememorium
 * - Contador regressivo até a prova
 * - Métricas de desempenho (questões, ECO, evocação)
 * - Heatmap e log de revisões
 * =============================================================================
 */
import {
    calcularTotalQuestoes,
    calcularEcoDaPerformance,
    obterUltimaEvocacao,
    selecionarFragmentosUrgentesOuRecentes,
    calcularStreak
} from '../utils.js';
import { gerarHeatmapSimples } from '../components/heatmap.js';
import { renderTabela } from './fragmentos.js'; 

/* ============================================================================
   CONTADOR REGRESSIVO (dias até a prova)
   ============================================================================ */

/**
 * Atualiza contador regressivo de dias até a prova.
 * @param {HTMLElement} contadorSpan - Span que exibe o número de dias
 * @param {HTMLElement} tituloEl - (opcional) elemento para título da prova
 * @param {string} dataProvaStr - Data da prova (YYYY-MM-DD ou Timestamp)
 * @param {string} provaStr - Nome da prova (para o título)
 */
export function atualizarCountdown(contadorSpan, tituloEl = null, dataProvaStr = null, provaStr = null) {
    if (!contadorSpan) return;

    // Busca dados da prova (prioriza argumento > localStorage > fallback fixo)
    const provaLocal = provaStr || localStorage.getItem("provaSelecionada") || null;
    const dataLocal = dataProvaStr || localStorage.getItem("dataProva") || null;

    if (tituloEl && provaLocal) {
        tituloEl.textContent = provaLocal;
    }

    if (!dataLocal) {
      contadorSpan.textContent = '—';
      return;
    }
    const dataStr = dataLocal;
    const dataProva = new Date(dataStr);
    dataProva.setHours(0, 0, 0, 0);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const diffMs = dataProva - hoje;
    const diasRestantes = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);

    const rotuloDias = contadorSpan.closest(".contador")?.querySelector(".dias");

    // Ajusta exibição de acordo com os dias restantes
    if (diasRestantes <= 0) {
        contadorSpan.textContent = "Hoje";
        contadorSpan.style.fontSize = "2rem";
        if (rotuloDias) rotuloDias.textContent = "";
    } else if (diasRestantes === 1) {
        contadorSpan.textContent = "1";
        contadorSpan.style.fontSize = "2.6rem";
        if (rotuloDias) rotuloDias.textContent = "dia";
    } else {
        contadorSpan.textContent = diasRestantes;
        contadorSpan.style.fontSize = "2.6rem";
        if (rotuloDias) rotuloDias.textContent = "dias";
    }
}

/* ============================================================================
   LOG DE REVISÕES
   ============================================================================ */

/**
 * Gera log textual das últimas revisões para exibição no dashboard.
 * @param {Array} fragmentos - Array de fragmentos
 * @param {HTMLElement} container - Elemento container do log
 */
export function gerarLogDeRevisoes(fragmentos, container, ultimaProva = null) {
    if (!container) return;

    const ordenados = [...fragmentos].sort((a, b) => {
        const da = parseDataFlex(a.ultimaRevisao);
        const db = parseDataFlex(b.ultimaRevisao);
        return db - da;
    });

    const ultimos = ordenados.slice(0, 5);

    const auraClass = (confianca) => {
        const c = (confianca || '').toLowerCase();
        if (c === 'alta')              return 'consolidada';
        if (c === 'média' || c === 'media') return 'estavel';
        if (c === 'baixa')             return 'instavel';
        return 'urgente';
    };

    const entradas = ultimos.map(f => {
        const data      = parseDataFlex(f.ultimaRevisao, true) || '—';
        const tema      = f.tema || 'Tema desconhecido';
        const confianca = f.confianca || '—';
        const aura      = auraClass(confianca);
        return `
        <div class="log-entry log-entry--${aura}">
          <span class="log-symbol">✦</span>
          <div class="log-info">
            <span class="log-tema">${tema}</span>
            <span class="log-data">${data}</span>
          </div>
          <span class="log-badge log-badge--${aura}">${confianca}</span>
        </div>`;
    });

    if (ultimaProva) {
        const pct  = ultimaProva.porcentagem ?? Math.round((ultimaProva.acertos / ultimaProva.total) * 100);
        const data = ultimaProva.data ? ultimaProva.data.split('-').reverse().join('/') : '—';
        const aura = ultimaProva.aura || 'instavel';
        entradas.push(`
        <div class="log-entry log-entry--${aura} log-entry--prova">
          <span class="log-symbol">★</span>
          <div class="log-info">
            <span class="log-tema">${ultimaProva.nome}</span>
            <span class="log-data">${data}</span>
          </div>
          <span class="log-badge log-badge--${aura}">${pct}%</span>
        </div>`);
    }

    container.innerHTML = entradas.length ? entradas.join('') : '';
}

/**
 * Parser de data flexível (string, Date ou Timestamp Firestore).
 * @param {any} valor - Valor cru vindo do Firestore
 * @param {boolean} formatado - Se true, retorna string YYYY-MM-DD
 */
function parseDataFlex(valor, formatado = false) {
    if (!valor) return null;

    if (typeof valor === "object" && valor.seconds) {
        const d = new Date(valor.seconds * 1000);
        return formatado ? d.toISOString().split("T")[0] : d;
    }
    if (typeof valor === "string") {
        return formatado ? valor.split("T")[0] : new Date(valor);
    }
    return null;
}

/* ============================================================================
   MÉTRICAS PRINCIPAIS (questões, ECO, evocação)
   ============================================================================ */

/**
 * Atualiza todas as métricas principais do dashboard.
 * @param {Array} fragmentosData - Dados dos fragmentos
 * @param {HTMLElement} contadorQuestoes - Elemento do contador de questões
 * @param {HTMLElement} ecoPerformance - Elemento da performance
 * @param {HTMLElement} ultimaEvocacaoElem - Elemento da última evocação
 */
export function atualizarMetricasDashboard(fragmentosData, contadorQuestoes, ecoPerformance, ultimaEvocacaoElem) {
    if (!fragmentosData || !Array.isArray(fragmentosData)) return;

    const totalQuestoes = calcularTotalQuestoes(fragmentosData);
    const mediaEco = calcularEcoDaPerformance(fragmentosData);
    const ultimaEvocacao = obterUltimaEvocacao(fragmentosData);
    const streak = calcularStreak(fragmentosData);

    if (contadorQuestoes) {
        contadorQuestoes.innerHTML = `<strong>${totalQuestoes}</strong>`;
    }
    if (ecoPerformance) {
        ecoPerformance.innerHTML = `${Math.round(mediaEco)} %`;
    }
    if (ultimaEvocacaoElem) {
        ultimaEvocacaoElem.innerHTML = ultimaEvocacao || "—";
    }

    const streakEl = document.getElementById('streak-dias');
    if (streakEl) streakEl.textContent = streak > 0 ? `${streak} dia${streak > 1 ? 's' : ''}` : '—';
}

/* ============================================================================
   INICIALIZAÇÃO E ATUALIZAÇÃO DO DASHBOARD
   ============================================================================ */

/**
 * Inicializa o dashboard completo na página inicial.
 */
export function inicializarDashboard(
    tbody, 
    heatmapContainer, 
    fragmentosData,
    contadorQuestoes,
    ecoPerformance,
    ultimaEvocacaoElem,
    logRevisoesContainer
) {
    if (!fragmentosData || !Array.isArray(fragmentosData)) return;

    // Filtra os mais urgentes/recentes para tabela compacta
    const fragmentosFiltrados = selecionarFragmentosUrgentesOuRecentes(fragmentosData, 5);

    if (tbody) {
        renderTabela(fragmentosFiltrados, tbody);
    }
    if (heatmapContainer) {
        gerarHeatmapSimples(heatmapContainer, fragmentosData);
    }

    atualizarMetricasDashboard(fragmentosData, contadorQuestoes, ecoPerformance, ultimaEvocacaoElem);

    if (logRevisoesContainer) {
        gerarLogDeRevisoes(fragmentosData, logRevisoesContainer);
    }
}

/**
 * Inicializa paginação da tabela na home page.
 * Retorna { atualizar(dados) } para ser chamado sempre que os dados mudarem.
 */
export function inicializarPaginacaoDashboard(tbody, anterior, paginaAtualEl, totalPaginasEl, proximo) {
    const POR_PAGINA = 10;
    let paginaAtual = 0;
    let dadosAtuais = [];

    function render() {
        const total = dadosAtuais.length;
        const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
        if (paginaAtual >= totalPaginas) paginaAtual = totalPaginas - 1;

        const inicio = paginaAtual * POR_PAGINA;
        renderTabela(dadosAtuais.slice(inicio, inicio + POR_PAGINA), tbody);

        if (paginaAtualEl) paginaAtualEl.textContent = paginaAtual + 1;
        if (totalPaginasEl) totalPaginasEl.textContent = `/ ${totalPaginas}`;
        if (anterior) anterior.classList.toggle('disabled', paginaAtual === 0);
        if (proximo) proximo.classList.toggle('disabled', paginaAtual >= totalPaginas - 1);

        const controles = anterior?.closest('.paginacao');
        if (controles) controles.style.display = total > POR_PAGINA ? '' : 'none';
    }

    if (anterior) anterior.addEventListener('click', () => { if (paginaAtual > 0) { paginaAtual--; render(); } });
    if (proximo) proximo.addEventListener('click', () => {
        if (paginaAtual < Math.ceil(dadosAtuais.length / POR_PAGINA) - 1) { paginaAtual++; render(); }
    });

    return {
        atualizar(dados) {
            dadosAtuais = dados;
            paginaAtual = 0;
            render();
        }
    };
}

/**
 * Atualiza o dashboard com novos dados, sem reinicializar tudo.
 */
export function atualizarDashboard(
    novosDados, 
    contadorQuestoes,
    ecoPerformance,
    ultimaEvocacaoElem,
    logRevisoesContainer,
    heatmapContainer = null
) {
    if (!novosDados || !Array.isArray(novosDados)) return;

    atualizarMetricasDashboard(novosDados, contadorQuestoes, ecoPerformance, ultimaEvocacaoElem);

    if (heatmapContainer) {
        gerarHeatmapSimples(heatmapContainer, novosDados);
    }
    if (logRevisoesContainer) {
        gerarLogDeRevisoes(novosDados, logRevisoesContainer);
    }
}