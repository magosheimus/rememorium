// modules/duas.js
/**
 * =============================================================================
 * SISTEMA DE EXIBIÇÃO DE DUAS (SÚPLICAS ISLÂMICAS)
 * =============================================================================
 * - Mantém uma coleção de duas (supplications) com:
 *   • Texto em árabe
 *   • Transliteração
 *   • Tradução para português
 * - Permite navegar entre as duas (anterior/próxima)
 * - Atualiza automaticamente a interface
 * =============================================================================
 */

// -----------------------------------------------------------------------------
// Coleção de duas (supplications) disponíveis
// -----------------------------------------------------------------------------
export const duas = [
  {
    arabe: "رَبِّ زِدْنِي عِلْمًا",
    transliteracao: "Rabbi zidni ilmā",
    traducao: "Ó meu Senhor, aumenta-me em conhecimento."
  },
  {
    arabe: "اللّهُمَّ لا سَهْلَ إلاَّ ما جَعَلْتَهُ سَهْلاً، وَأَنْتَ تَجْعَلُ الحَزْنَ إذا شِئْتَ سَهْلاً",
    transliteracao: "Allahumma lā sahla illā mā jaʿaltahu sahlān, wa anta tajʿalu al-ḥazna idhā shi'ta sahlān",
    traducao: "Ó Allah, nada é fácil exceto o que Tu tornas fácil, e Tu podes tornar o difícil fácil se quiseres."
  },
  {
    arabe: "رَبِّ اشْرَحْ لِي صَدْرِي • وَيَسِّرْ لِي أَمْرِي",
    transliteracao: "Rabbi ishrah lī ṣadrī • wa yassir lī amrī",
    traducao: "Ó meu Senhor, expande o meu peito e facilita o meu caminho."
  },
  {
    arabe: "حَسْبُنَا اللهُ وَنِعْمَ الْوَكِيلُ",
    transliteracao: "Ḥasbunallāhu wa niʿmal-wakīl",
    traducao: "Allah é suficiente para nós, e Ele é o melhor Dispositor dos assuntos."
  },
  {
    arabe: "اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا",
    transliteracao: "Allahumma innī as’aluka ʿilman nāfiʿan, wa rizqan ṭayyiban, wa ʿamalan mutaqabbalan",
    traducao: "Ó Allah! Peço-Te conhecimento que é benéfico, provisão pura e ações aceitas."
  },
  {
    arabe: "اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي وَعَلِّمْنِي مَا يَنْفَعُنِي",
    transliteracao: "Allahumma ʾinfaʿnī bimā ʿallamtanī wa ʿallimnī mā yanfaʿunī",
    traducao: "Ó Allah, torna útil o que me ensinaste e ensina-me aquilo que me seja proveitoso."
  },
  {
    arabe: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً",
    transliteracao: "Rabbana ātinā fid-dunyā ḥasanatan wa fil-ākhirati ḥasanatan",
    traducao: "Nosso Senhor, concede-nos o bem neste mundo e o bem no Além."
  }
];

// -----------------------------------------------------------------------------
// Estado interno: índice da dua atual
// -----------------------------------------------------------------------------
let duaAtual = 0;

// -----------------------------------------------------------------------------
// Renderização da dua atual
// -----------------------------------------------------------------------------

/**
 * Renderiza a dua atualmente selecionada nos elementos da interface.
 *
 * @param {HTMLElement} elementoArabe - Elemento destino para o texto em árabe
 * @param {HTMLElement} elementoTransliteracao - Elemento destino para a transliteração
 * @param {HTMLElement} elementoTraducao - Elemento destino para a tradução
 */
export function renderizarDua(elementoArabe, elementoTransliteracao, elementoTraducao) {
  if (!duas || !duas.length) {
    console.error('Array de duas não inicializado ou vazio');
    return;
  }

  // Normaliza índice (garante que esteja dentro dos limites do array)
  duaAtual = (duaAtual + duas.length) % duas.length;

  const dua = duas[duaAtual];

  if (elementoArabe && dua.arabe) elementoArabe.textContent = dua.arabe;
  if (elementoTransliteracao && dua.transliteracao) elementoTransliteracao.textContent = dua.transliteracao;
  if (elementoTraducao && dua.traducao) elementoTraducao.textContent = dua.traducao;
}

// -----------------------------------------------------------------------------
// Navegação (próxima / anterior)
// -----------------------------------------------------------------------------

/**
 * Move a exibição da dua para frente ou para trás.
 *
 * @param {number} direcao - 1 = próxima | -1 = anterior
 * @param {HTMLElement} elementoArabe
 * @param {HTMLElement} elementoTransliteracao
 * @param {HTMLElement} elementoTraducao
 */
export function mudarDua(direcao, elementoArabe, elementoTransliteracao, elementoTraducao) {
  duaAtual = (duaAtual + direcao + duas.length) % duas.length;
  renderizarDua(elementoArabe, elementoTransliteracao, elementoTraducao);
}

// -----------------------------------------------------------------------------
// Inicialização do sistema
// -----------------------------------------------------------------------------

/**
 * Inicializa o sistema de exibição de duas.
 * Define a primeira dua e conecta botões de navegação.
 *
 * @param {HTMLElement} elementoArabe
 * @param {HTMLElement} elementoTransliteracao
 * @param {HTMLElement} elementoTraducao
 */
export function inicializarDuas(elementoArabe, elementoTransliteracao, elementoTraducao) {
  if (!elementoArabe || !elementoTransliteracao || !elementoTraducao) {
    console.warn('Elementos para exibição de duas não encontrados');
    return;
  }

  // Render inicial
  renderizarDua(elementoArabe, elementoTransliteracao, elementoTraducao);

  // Liga botões de navegação
  const btnAnterior = document.getElementById('dua-anterior');
  const btnProximo = document.getElementById('dua-proximo');

  if (btnAnterior) {
    btnAnterior.addEventListener('click', () => {
      mudarDua(-1, elementoArabe, elementoTransliteracao, elementoTraducao);
    });
  }

  if (btnProximo) {
    btnProximo.addEventListener('click', () => {
      mudarDua(1, elementoArabe, elementoTransliteracao, elementoTraducao);
    });
  }

  // Opcional: expõe no escopo global (útil para depuração)
  window.mudarDua = (direcao) =>
    mudarDua(direcao, elementoArabe, elementoTransliteracao, elementoTraducao);
}