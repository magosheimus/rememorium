// utils.js
/**
 * =============================================================================
 * FUNÇÕES AUXILIARES
 * =============================================================================
 * Contém utilitários genéricos para:
 * - Normalização de texto e hashtags
 * - Conversões numéricas e formatação
 * - Cálculos de desempenho (questões, ECO, evocação)
 * - Manipulação de datas
 * - Seleção de fragmentos para priorização
 * - Suporte ao heatmap
 * =============================================================================
 */

/* ============================================================================
   TEXTO E HASHTAGS
   ============================================================================ */

/**
 * Normaliza texto removendo acentos, espaços extras e deixando em minúsculo.
 * @param {string} texto - Texto de entrada
 * @returns {string} Texto normalizado
 */
export function normalizarTexto(texto) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/**
 * Normaliza hashtags a partir de uma string (separadas por espaço ou vírgula).
 * Remove os "#" do início e descarta entradas vazias.
 * @param {string} input - Texto de entrada
 * @returns {Array<string>} Lista de hashtags limpas
 */
export function normalizarHashtags(input) {
  return input
    .split(/[\s,]+/)
    .map(tag => tag.trim().replace(/^#+/, ''))
    .filter(Boolean);
}

/* ============================================================================
   NÚMEROS E PORCENTAGENS
   ============================================================================ */

/**
 * Substitui valores vazios/nulos/zero por um traço "—".
 * @param {any} valor - Valor a ser exibido
 */
export function exibirValorOuTraco(valor) {
  return valor === '' || valor === undefined || valor === null || valor === 0
    ? '—'
    : valor;
}

/**
 * Converte string tipo "12/15" ou "12,15" em porcentagem.
 * @param {string|number} valor - Ex: "7/10" → 70
 * @returns {number} Percentual entre 0–100
 */
export function converterParaPorcentagem(valor) {
  if (typeof valor !== 'string') return Number(valor);
  const match = valor.match(/(\d+)[\/,](\d+)/);
  if (match) {
    const acertos = parseInt(match[1]);
    const total = parseInt(match[2]);
    if (total === 0) return 0;
    return Math.round((acertos / total) * 100);
  }
  return Number(valor);
}

/**
 * Converte string com "%" em número entre 0 e 100.
 * @param {string|number} v - Ex: "75%" → 75
 */
export function pctNumber(v) {
  if (v == null) return 0;
  const n = String(v).replace('%', '').trim();
  const num = Number(n);
  return Number.isFinite(num) ? Math.max(0, Math.min(100, num)) : 0;
}

/* ============================================================================
   QUESTÕES E DESEMPENHO
   ============================================================================ */

/**
 * Extrai apenas o total de questões de uma string "acertos/total".
 * @param {string} valor - Ex: "7/10"
 * @returns {number} Total de questões (10)
 */
export function extrairTotalQuestoes(valor) {
  if (typeof valor !== 'string') return 0;
  const match = valor.match(/(\d+)[\/,](\d+)/);
  return match ? parseInt(match[2]) : 0;
}

/**
 * Calcula o total de questões (iniciais + finais + histórico).
 * @param {Array} data - Lista de fragmentos
 * @returns {number} Total de questões somadas
 */
export function calcularTotalQuestoes(data) {
  let total = 0;
  data.forEach(fragmento => {
    total += extrairTotalQuestoes(fragmento.ecoInicialRaw);
    total += extrairTotalQuestoes(fragmento.ecoFinalRaw);
    if (fragmento.historico && fragmento.historico.length > 0) {
      fragmento.historico.forEach(ciclo => {
        total += extrairTotalQuestoes(ciclo.ecoInicial);
        total += extrairTotalQuestoes(ciclo.ecoFinal);
      });
    }
  });
  return total;
}

/**
 * Calcula média de desempenho baseado em ECO Final (principal + histórico).
 * @param {Array} data - Lista de fragmentos
 * @returns {number} Percentual médio de acertos
 */
export function calcularEcoDaPerformance(data) {
  let totalQuestoes = 0;
  let totalAcertos = 0;

  data.forEach(fragmento => {
    // ECO Final principal
    if (fragmento.ecoFinalRaw) {
      const match = fragmento.ecoFinalRaw.match(/(\d+)[\/,](\d+)/);
      if (match) {
        totalAcertos += parseInt(match[1], 10);
        totalQuestoes += parseInt(match[2], 10);
      }
    }
    // Históricos
    if (fragmento.historico && Array.isArray(fragmento.historico)) {
      fragmento.historico.forEach(ciclo => {
        if (ciclo.ecoFinalRaw) {
          const match = ciclo.ecoFinalRaw.match(/(\d+)[\/,](\d+)/);
          if (match) {
            totalAcertos += parseInt(match[1], 10);
            totalQuestoes += parseInt(match[2], 10);
          }
        }
      });
    }
  });

  if (totalQuestoes === 0) return 0;
  return Math.round((totalAcertos / totalQuestoes) * 100);
}

/**
 * Retorna o último tema revisado (com base no timestamp).
 * @param {Array} fragmentos
 * @returns {string} Nome do tema ou "—"
 */
export function obterUltimaEvocacao(fragmentos) {
  if (!fragmentos || fragmentos.length === 0) return '—';
  const comTimestamp = fragmentos.filter(f => f.revisaoTimestamp);
  if (comTimestamp.length === 0) return '—';
  const ordenados = [...comTimestamp].sort((a, b) => b.revisaoTimestamp - a.revisaoTimestamp);
  return ordenados[0]?.tema || '—';
}

/* ============================================================================
   DATAS
   ============================================================================ */

/**
 * Converte string data para formato ISO (YYYY-MM-DD).
 * @param {string|Date} dataRaw
 */
export function formatarDataRaw(dataRaw) {
  const parsed = new Date(dataRaw);
  if (isNaN(parsed)) return '';
  return parsed.toISOString().split('T')[0];
}

/**
 * Formata data ISO em formato brasileiro dd-mm-aaaa.
 * @param {string} dataISO
 */
export function formatarDataBR(dataISO) {
  if (!dataISO) return '—';
  const parsed = new Date(dataISO);
  if (isNaN(parsed)) return dataISO;
  const dia = String(parsed.getDate()).padStart(2, '0');
  const mes = String(parsed.getMonth() + 1).padStart(2, '0');
  const ano = parsed.getFullYear();
  return `${dia}-${mes}-${ano}`;
}

/* ============================================================================
   HEATMAP
   ============================================================================ */

/**
 * Conta o total de questões respondidas por data (para heatmap).
 * @param {Array} fragmentos
 * @returns {Object} { "2025-09-11": 12, ... }
 */
export function contarQuestoesPorData(fragmentos) {
  const contagem = {};
  fragmentos.forEach(frag => {
    if (frag.ultimaRevisao) {
      const data = frag.ultimaRevisao.includes('T')
        ? frag.ultimaRevisao.split('T')[0]
        : frag.ultimaRevisao;
      let totalQuestoes = 0;

      // ECO Inicial
      if (frag.ecoInicialRaw) {
        const match = frag.ecoInicialRaw.match(/[\d.]+[\/,]([\d.]+)/);
        if (match) totalQuestoes += parseFloat(match[1]);
      }

      // ECO Final
      if (frag.ecoFinalRaw) {
        const match = frag.ecoFinalRaw.match(/[\d.]+[\/,]([\d.]+)/);
        if (match) totalQuestoes += parseFloat(match[1]);
      }

      contagem[data] = (contagem[data] || 0) + totalQuestoes;
    }
  });
  return contagem;
}

/* ============================================================================
   PRIORIZAÇÃO DE FRAGMENTOS
   ============================================================================ */

/**
 * Seleciona fragmentos urgentes ou recentes, respeitando um limite.
 * - Primeiro preenche com urgentes
 * - Depois com instáveis
 * - Depois com os mais antigos
 * @param {Array} lista - Lista de fragmentos
 * @param {number} limite - Quantidade máxima (default: 5)
 */
export function selecionarFragmentosUrgentesOuRecentes(lista, limite = 5) {
  if (!Array.isArray(lista)) return [];

  const urgentes = lista.filter(f => f.aura === 'urgente');
  if (urgentes.length >= limite) {
    return urgentes.slice(0, limite);
  }

  const instaveis = lista.filter(f => f.aura === 'instavel');
  const restantes = [...urgentes];

  // Preenche com instáveis
  for (let i = 0; i < instaveis.length && restantes.length < limite; i++) {
    restantes.push(instaveis[i]);
  }

  // Preenche com mais antigos se ainda faltar
  if (restantes.length < limite) {
    const outros = lista
      .filter(f => !restantes.includes(f))
      .sort((a, b) => new Date(a.ultimaRevisao) - new Date(b.ultimaRevisao));
    for (let i = 0; i < outros.length && restantes.length < limite; i++) {
      restantes.push(outros[i]);
    }
  }

  return restantes;
}

/* ============================================================================
   OUTROS
   ============================================================================ */

/** Abre o painel principal (UI) e carrega fragmentos. */
export function abrirPainelPrincipal() {
  document.getElementById("painel-principal").classList.add("ativo");
  carregarFragmentos(); 
}