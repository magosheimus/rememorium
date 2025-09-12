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
    selecionarFragmentosUrgentesOuRecentes
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

    const dataStr = dataLocal || "2025-10-19";
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
export function gerarLogDeRevisoes(fragmentos, container) {
    if (!container) return;

    // Ordena por data da última revisão (mais recente primeiro)
    const ordenados = [...fragmentos].sort((a, b) => {
        const da = parseDataFlex(a.ultimaRevisao);
        const db = parseDataFlex(b.ultimaRevisao);
        return db - da;
    });

    // Pega os 3 mais recentes
    const ultimos = ordenados.slice(0, 3);

    // Monta frases do log
    const logs = ultimos.map(f => {
        const data = parseDataFlex(f.ultimaRevisao, true) || "—";
        const tema = f.tema || "Tema desconhecido";
        const confianca = f.confianca?.toLowerCase() || "sem confiança";
        return `<span class="emoji-fixa">✦</span> ${data}: Revisado "${tema}" com confiança ${confianca}.`;
    });

    // Renderiza no container
    container.innerHTML = logs.map(log => `<p class="log-item">${log}</p>`).join("");
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

    if (contadorQuestoes) {
        contadorQuestoes.innerHTML = `<strong>${totalQuestoes}</strong>`;
    }
    if (ecoPerformance) {
        ecoPerformance.innerHTML = `${Math.round(mediaEco)} %`;
    }
    if (ultimaEvocacaoElem) {
        ultimaEvocacaoElem.innerHTML = ultimaEvocacao || "—";
    }
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