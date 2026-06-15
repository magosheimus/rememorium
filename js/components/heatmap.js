// components/heatmap.js
import { contarQuestoesPorData, formatarDataBR } from '../utils.js';

export function classePorQuestoes(n) {
  n = Number(n);
  if (n === 0) return 'questoes-0';
  if (n <= 19) return 'questoes-1';
  if (n <= 49) return 'questoes-2';
  if (n <= 79) return 'questoes-3';
  return 'questoes-4';
}

export function gerarHeatmapSimples(heatmapContainer, fragmentosData) {
  if (!heatmapContainer || !fragmentosData || !Array.isArray(fragmentosData)) return;

  const dias = 90;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - (dias - 1));

  const contagem = contarQuestoesPorData(fragmentosData);

  const celulas = [];
  for (let i = 0; i < dias; i++) {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    const dataISO = dia.toISOString().split('T')[0];
    celulas.push({ dataISO, qtd: contagem[dataISO] || 0 });
  }
  celulas.reverse();

  heatmapContainer.innerHTML = '';

  const hojeISO = hoje.toISOString().split('T')[0];

  celulas.forEach(celula => {
    const div = document.createElement('div');
    div.className = `heatmap-cell ${classePorQuestoes(celula.qtd)}`;
    const dataFormatada = formatarDataBR(celula.dataISO);
    const ehHoje = celula.dataISO === hojeISO;
    if (celula.qtd > 0 || ehHoje) {
      div.dataset.tooltip = ehHoje
        ? `Hoje · ${celula.qtd} questões`
        : `${dataFormatada} · ${celula.qtd} questões`;
    }
    if (ehHoje) {
      div.style.border = '2px solid #d9903d';
      div.style.boxShadow = '0 0 5px rgba(217, 144, 61, 0.5)';
    }
    heatmapContainer.appendChild(div);
  });
}
