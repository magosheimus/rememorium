// components/heatmap.js
/**
 * =============================================================================
 * COMPONENTE HEATMAP SIMPLES
 * =============================================================================
 * - Gera um heatmap visual representando a quantidade de questões estudadas
 *   por data, nos últimos N dias (aqui: 60).
 * - As células são classificadas em intensidade conforme o número de questões.
 * - O dia atual recebe destaque visual.
 * =============================================================================
 */

import { contarQuestoesPorData, formatarDataBR } from '../utils.js';

// -----------------------------------------------------------------------------
// Determinação da classe CSS conforme número de questões
// -----------------------------------------------------------------------------

/**
 * Retorna a classe CSS correspondente ao número de questões resolvidas no dia.
 *
 * @param {number} n - Quantidade de questões
 * @returns {string} Classe CSS correspondente
 */
export function classePorQuestoes(n) {
  n = Number(n);

  if (n === 0) return 'questoes-0';
  if (n <= 19) return 'questoes-1';
  if (n <= 49) return 'questoes-2';
  if (n <= 79) return 'questoes-3';
  return 'questoes-4';
}

// -----------------------------------------------------------------------------
// Geração do heatmap
// -----------------------------------------------------------------------------

/**
 * Gera e renderiza um heatmap dos últimos 60 dias.
 *
 * @param {HTMLElement} heatmapContainer - Container onde o heatmap será renderizado
 * @param {Array} fragmentosData - Dados dos fragmentos (com informações de revisões/questões)
 */
export function gerarHeatmapSimples(heatmapContainer, fragmentosData) {
  if (!heatmapContainer || !fragmentosData) {
    console.warn('Heatmap: Container ou dados não fornecidos');
    return;
  }

  const dias = 60; // período analisado (60 dias)
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - (dias - 1)); // começa 59 dias atrás

  // Obtém mapa de datas -> quantidade de questões
  const contagem = contarQuestoesPorData(fragmentosData);

  // Cria array de células (um objeto por dia)
  const celulas = [];
  for (let i = 0; i < dias; i++) {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);

    const dataISO = dia.toISOString().split('T')[0];
    const qtd = contagem[dataISO] || 0;

    celulas.push({ dataISO, qtd });
  }

  // Inverte (deixa os dias mais recentes por último no array → exibidos à direita)
  celulas.reverse();

  // Limpa container antes de inserir
  heatmapContainer.innerHTML = '';

  // Renderiza cada célula
  celulas.forEach(celula => {
    const div = document.createElement('div');
    div.className = `heatmap-cell ${classePorQuestoes(celula.qtd)}`;

    const dataFormatada = formatarDataBR(celula.dataISO);

    // Verifica se é o dia atual
    const hojeNormalizado = new Date();
    hojeNormalizado.setHours(0, 0, 0, 0);
    const hojeISO = hojeNormalizado.toISOString().split('T')[0];
    const ehHoje = celula.dataISO === hojeISO;

    // Tooltip
    const textoData = ehHoje
      ? `Hoje: ${celula.qtd} questões`
      : `${dataFormatada}: ${celula.qtd} questões`;
    div.title = textoData;

    // Destaque visual para o dia atual
    if (ehHoje) {
      div.style.border = '2px solid #d9903d';
      div.style.boxShadow = '0 0 5px rgba(217, 144, 61, 0.5)';
    }

    heatmapContainer.appendChild(div);
  });

  console.log('Heatmap gerado com sucesso');
}