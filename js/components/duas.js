// components/duas.js

// Coleção padrão de duas (carregada se o usuário não tiver itens no Firestore)
export const duasPadrao = [
  {
    tipo: 'dua',
    arabe: "رَبِّ زِدْنِي عِلْمًا",
    transliteracao: "Rabbi zidni ilmā",
    traducao: "Ó meu Senhor, aumenta-me em conhecimento."
  },
  {
    tipo: 'dua',
    arabe: "اللّهُمَّ لا سَهْلَ إلاَّ ما جَعَلْتَهُ سَهْلاً، وَأَنْتَ تَجْعَلُ الحَزْنَ إذا شِئْتَ سَهْلاً",
    transliteracao: "Allahumma lā sahla illā mā jaʿaltahu sahlān, wa anta tajʿalu al-ḥazna idhā shi'ta sahlān",
    traducao: "Ó Allah, nada é fácil exceto o que Tu tornas fácil, e Tu podes tornar o difícil fácil se quiseres."
  },
  {
    tipo: 'dua',
    arabe: "رَبِّ اشْرَحْ لِي صَدْرِي • وَيَسِّرْ لِي أَمْرِي",
    transliteracao: "Rabbi ishrah lī ṣadrī • wa yassir lī amrī",
    traducao: "Ó meu Senhor, expande o meu peito e facilita o meu caminho."
  },
  {
    tipo: 'dua',
    arabe: "حَسْبُنَا اللهُ وَنِعْمَ الْوَكِيلُ",
    transliteracao: "Ḥasbunallāhu wa niʿmal-wakīl",
    traducao: "Allah é suficiente para nós, e Ele é o melhor Dispositor dos assuntos."
  },
  {
    tipo: 'dua',
    arabe: "اللَّهُمَّ إِنِّي أَسْأَلُكَ عِلْمًا نَافِعًا، وَرِزْقًا طَيِّبًا، وَعَمَلًا مُتَقَبَّلًا",
    transliteracao: "Allahumma innī as'aluka ʿilman nāfiʿan, wa rizqan ṭayyiban, wa ʿamalan mutaqabbalan",
    traducao: "Ó Allah! Peço-Te conhecimento que é benéfico, provisão pura e ações aceitas."
  },
  {
    tipo: 'dua',
    arabe: "اللَّهُمَّ انْفَعْنِي بِمَا عَلَّمْتَنِي وَعَلِّمْنِي مَا يَنْفَعُنِي",
    transliteracao: "Allahumma ʾinfaʿnī bimā ʿallamtanī wa ʿallimnī mā yanfaʿunī",
    traducao: "Ó Allah, torna útil o que me ensinaste e ensina-me aquilo que me seja proveitoso."
  },
  {
    tipo: 'dua',
    arabe: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الْآخِرَةِ حَسَنَةً",
    transliteracao: "Rabbana ātinā fid-dunyā ḥasanatan wa fil-ākhirati ḥasanatan",
    traducao: "Nosso Senhor, concede-nos o bem neste mundo e o bem no Além."
  }
];

// Lista ativa (pode ser substituída pelos dados do Firestore)
let itensAtivos = [...duasPadrao];
let duaAtual = 0;

// Referências aos elementos DOM (definidas em inicializarDuas)
let _elArabe = null;
let _elTranslit = null;
let _elTraducao = null;

export function setItensAtivos(items) {
  itensAtivos = Array.isArray(items) && items.length ? items : [...duasPadrao];
  duaAtual = 0;
}

export function getItensAtivos() {
  return itensAtivos;
}

export function renderizarDua(elArabe, elTranslit, elTraducao) {
  if (!itensAtivos.length) return;
  duaAtual = ((duaAtual % itensAtivos.length) + itensAtivos.length) % itensAtivos.length;
  const item = itensAtivos[duaAtual];

  if (item.tipo === 'nota') {
    if (elArabe)   { elArabe.textContent = '';   elArabe.style.display = 'none'; }
    if (elTranslit){ elTranslit.textContent = ''; elTranslit.style.display = 'none'; }
    if (elTraducao){ elTraducao.textContent = item.texto || ''; elTraducao.style.display = ''; }
  } else {
    if (elArabe)   { elArabe.textContent = item.arabe || '';          elArabe.style.display = ''; }
    if (elTranslit){ elTranslit.textContent = item.transliteracao || ''; elTranslit.style.display = ''; }
    if (elTraducao){ elTraducao.textContent = item.traducao || '';    elTraducao.style.display = ''; }
  }
}

export function mudarDua(direcao, elArabe, elTranslit, elTraducao) {
  duaAtual = (duaAtual + direcao + itensAtivos.length) % itensAtivos.length;
  renderizarDua(elArabe, elTranslit, elTraducao);
}

export function inicializarDuas(elArabe, elTranslit, elTraducao) {
  if (!elArabe || !elTranslit || !elTraducao) return;
  _elArabe   = elArabe;
  _elTranslit = elTranslit;
  _elTraducao = elTraducao;

  renderizarDua(elArabe, elTranslit, elTraducao);

  document.getElementById('dua-anterior')?.addEventListener('click', () =>
    mudarDua(-1, elArabe, elTranslit, elTraducao));
  document.getElementById('dua-proximo')?.addEventListener('click', () =>
    mudarDua(1, elArabe, elTranslit, elTraducao));

  window.mudarDua = (d) => mudarDua(d, elArabe, elTranslit, elTraducao);
}

// Re-renderiza usando as referências salvas (útil após edição)
export function rerenderDua() {
  if (_elArabe) renderizarDua(_elArabe, _elTranslit, _elTraducao);
}
