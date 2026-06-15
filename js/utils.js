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

  function extrairQuestoes(ecoRaw, ecoNum) {
    if (ecoRaw) {
      const match = String(ecoRaw).match(/[\d.]+[\/,]([\d.]+)/);
      if (match) return parseFloat(match[1]);
    }
    // eco numérico (ex: seed): conta como 1 revisão mínima
    return (ecoNum != null && ecoNum !== '') ? 1 : 0;
  }

  function registrar(dataStr, questoes) {
    if (!dataStr) return;
    const key = dataStr.includes('T') ? dataStr.split('T')[0] : dataStr;
    contagem[key] = (contagem[key] || 0) + Math.max(questoes, 1);
  }

  fragmentos.forEach(frag => {
    if (!frag.ultimaRevisao) return;

    const q = extrairQuestoes(frag.ecoInicialRaw, frag.ecoInicial)
            + extrairQuestoes(frag.ecoFinalRaw,   frag.ecoFinal);
    registrar(frag.ultimaRevisao, q);

    // historico de ciclos anteriores
    (frag.historico || []).forEach(ciclo => {
      if (!ciclo.data) return;
      const qc = extrairQuestoes(ciclo.ecoInicialRaw, ciclo.ecoInicial)
               + extrairQuestoes(ciclo.ecoFinalRaw,   ciclo.ecoFinal);
      registrar(ciclo.data, qc);
    });
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

  const AURA_ORDEM = { urgente: 0, instavel: 1, estavel: 2, consolidada: 3 };

  function pontuacao(f) {
    const ei = pctNumber(f.ecoInicial);
    const ef = pctNumber(f.ecoFinal);
    const eco = (ei * 0.7) + (ef * 0.3);
    const desempenhoScore = eco < 50 ? 3 : eco < 80 ? 2 : 1;
    const temHistorico = (f.historico?.length > 0) || (f.ciclos > 0);
    const faixaI = ei < 50 ? 0 : ei < 80 ? 1 : 2;
    const faixaF = ef < 50 ? 0 : ef < 80 ? 1 : 2;
    const regressaoScore = temHistorico && faixaF < faixaI ? 1 : 0;
    const dias = Math.floor((Date.now() - new Date(f.ultimaRevisao)) / 86_400_000);
    const diasScore = dias >= 14 ? 3 : dias >= 7 ? 2 : 1;
    const conf = (f.confianca || '').toLowerCase();
    const confScore = conf === 'baixa' ? 2 : conf === 'média' ? 1 : 0;
    return desempenhoScore + regressaoScore + diasScore + confScore;
  }

  return [...lista]
    .sort((a, b) => {
      const auraA = AURA_ORDEM[a.aura] ?? 4;
      const auraB = AURA_ORDEM[b.aura] ?? 4;
      if (auraA !== auraB) return auraA - auraB;
      return pontuacao(b) - pontuacao(a);
    })
    .slice(0, limite);
}

/* ============================================================================
   SEGURANÇA
   ============================================================================ */

/**
 * Escapa caracteres HTML para evitar XSS ao inserir conteúdo via innerHTML.
 * @param {any} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ============================================================================
   STREAK DE ESTUDOS
   ============================================================================ */

/**
 * Calcula streak de dias consecutivos de estudo.
 * Considera ultimaRevisao dos fragmentos e historico de ciclos.
 * @param {Array} fragmentos
 * @returns {number} Número de dias consecutivos
 */
export function calcularStreak(fragmentos) {
  if (!fragmentos || fragmentos.length === 0) return 0;

  const datasEstudo = new Set();
  fragmentos.forEach(f => {
    if (f.ultimaRevisao) datasEstudo.add(f.ultimaRevisao.split('T')[0]);
    (f.historico || []).forEach(ciclo => {
      if (ciclo.data) datasEstudo.add(ciclo.data.split('T')[0]);
    });
  });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeStr = hoje.toISOString().split('T')[0];

  // Começa de hoje; se não estudou hoje, começa de ontem
  const diaAtual = new Date(hoje);
  if (!datasEstudo.has(hojeStr)) diaAtual.setDate(diaAtual.getDate() - 1);

  let streak = 0;
  while (true) {
    const diaStr = diaAtual.toISOString().split('T')[0];
    if (!datasEstudo.has(diaStr)) break;
    streak++;
    diaAtual.setDate(diaAtual.getDate() - 1);
  }
  return streak;
}

/* ============================================================================
   EXPORTAÇÃO
   ============================================================================ */

/**
 * Exporta fragmentos para arquivo CSV com BOM UTF-8.
 * @param {Array} fragmentos
 */
export function exportarCSV(fragmentos) {
  if (!fragmentos || fragmentos.length === 0) return;

  const cabecalho = ['Tema', 'Última Revisão', 'Eco Inicial (%)', 'Eco Final (%)', 'Confiança', 'Revisões', 'Hashtags'];
  const linhas = fragmentos.map(f => [
    f.tema || '',
    (f.ultimaRevisao || '').split('T')[0],
    f.ecoInicial ?? '',
    f.ecoFinal ?? '',
    f.confianca || '',
    f.ciclos || 0,
    (f.hashtags || []).join(' '),
  ]);

  const csvContent = [cabecalho, ...linhas]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rememorium_fragmentos_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ============================================================================
   OUTROS
   ============================================================================ */

/** Abre o painel principal (UI) e carrega fragmentos. */
export function abrirPainelPrincipal() {
  document.getElementById("painel-principal").classList.add("ativo");
  carregarFragmentos();
}