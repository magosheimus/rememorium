const STORAGE_KEY   = 'rememorium_tutorial_visto';
const STORAGE_PASSO = 'rememorium_tutorial_passo';

function paginaAtual() {
  const p = window.location.pathname.split('/').pop() || 'home.html';
  if (p.includes('fragmentos')) return 'fragmentos';
  return 'home';
}

const PASSOS = [

  // ── HOME ──────────────────────────────────────────────────────────────────
  {
    pagina: 'home',
    titulo: '✦ Bem-vindo ao Re:memorium',
    descricao: `O Re:memorium é um sistema de <strong>estudo ativo com revisão espaçada</strong>.<br><br>
      Em vez de apenas reler o conteúdo, você mede seu conhecimento <em>antes</em> de estudar,
      reforça com questões de múltipla escolha <em>depois</em>,
      e o sistema agenda automaticamente quando cada tema precisa ser revisado novamente.`,
    elemento: null,
  },
  {
    pagina: 'home',
    titulo: 'Eco Inicial e Eco Final',
    descricao: `Cada sessão tem dois momentos de medição:<br><br>
      <strong>Eco Inicial</strong> — antes de abrir qualquer material, resolva um <em>set pequeno de questões</em>
      (5–10 questões) sobre o tema. Mede o que ainda está retido na memória de longo prazo. Ex.: <em>"3/5"</em><br><br>
      <strong>Eco Final</strong> — após revisar o conteúdo, resolva um <em>bloco maior de múltipla escolha</em>
      (20–30 questões). Esse é o indicador real de consolidação da sessão. Ex.: <em>"22/30"</em>`,
    elemento: null,
  },
  {
    pagina: 'home',
    titulo: 'Contagem Regressiva',
    descricao: `Este bloco mostra quantos dias faltam até sua prova ou objetivo.<br><br>
      Clique no ícone de lápis ✏ no canto do card para editar o nome da prova e a data — o contador atualiza automaticamente.`,
    elemento: '.contagem-regressiva',
    posicao: 'baixo',
  },
  {
    pagina: 'home',
    titulo: 'Bloco de Inspiração',
    descricao: `Aqui ficam suas inspirações, frases ou lembretes pessoais — uma espécie de post-it digital.<br><br>
      Clique no ícone de lápis ✏ para adicionar, editar ou remover itens. As frases aparecem em rotação automática.`,
    elemento: '.bloco-inspiracao',
    posicao: 'baixo',
  },
  {
    pagina: 'home',
    titulo: 'Painel de Desempenho',
    descricao: `Seus indicadores gerais em tempo real:<br><br>
      <strong>Questões Evocadas</strong> — total de questões de todos os registros<br>
      <strong>Eco de Performance</strong> — média dos seus ecos finais<br>
      <strong>Última Evocação</strong> — tema estudado mais recentemente<br>
      <strong>Sequência</strong> — dias consecutivos de estudo`,
    elemento: '#painel-principal',
    posicao: 'baixo',
  },
  {
    pagina: 'home',
    titulo: 'Tabela de Fragmentos',
    descricao: `Todos os seus temas aparecem aqui com data da última revisão, ecos, confiança e total de ciclos.<br><br>
      As cores da linha indicam a urgência de revisão — temas vermelhos pedem atenção imediata.`,
    elemento: '#fragmentos',
    posicao: 'cima',
    scrollBlock: 'start',
  },
  {
    pagina: 'home',
    titulo: 'O Sistema de Aura',
    descricao: `Cada tema recebe uma cor conforme a urgência de revisão:<br><br>
      <span style="color:#c4554c;font-size:1.1rem">⬤</span> <strong>Urgente</strong> — revisão imediata necessária<br>
      <span style="color:#d9903d;font-size:1.1rem">⬤</span> <strong>Instável</strong> — revisar em breve<br>
      <span style="color:#c2b046;font-size:1.1rem">⬤</span> <strong>Estável</strong> — no ritmo certo<br>
      <span style="color:#8a9b5b;font-size:1.1rem">⬤</span> <strong>Consolidado</strong> — bem fixado na memória`,
    elemento: null,
  },
  {
    pagina: 'home',
    titulo: 'Diário de Progresso',
    descricao: `O heatmap mostra sua atividade ao longo do ano. Quadrados mais escuros = mais questões evocadas naquele dia.<br><br>
      Ideal para manter a sequência de estudos e identificar períodos de baixa atividade antes que se tornem um problema.`,
    elemento: '#heatmap',
    posicao: 'cima',
  },
  {
    pagina: 'home',
    titulo: 'Timer Pomodoro',
    descricao: `Na barra inferior fica o timer <strong>Pomodoro</strong> integrado ao sistema.<br><br>
      Use ciclos de estudo focados: 25 min de estudo, 5 min de pausa. Clique em <strong>▶</strong> para iniciar
      e em <strong>⚙</strong> para personalizar os tempos conforme seu ritmo.`,
    elemento: 'footer#pomodoro',
    posicao: 'cima',
    fixo: true,
  },
  {
    pagina: 'home',
    titulo: 'Provas — questões de múltipla escolha',
    descricao: `Em <strong>Provas</strong> você registra as questões de múltipla escolha que resolver, organizadas por data e tema.<br><br>
      O sistema acompanha sua performance longitudinalmente e ajuda a identificar quais temas precisam de mais atenção até o dia da prova.`,
    elemento: 'a[href="provas.html"]',
    posicao: 'baixo',
  },
  {
    pagina: 'home',
    titulo: 'Agora veja como registrar um Fragmento',
    descricao: `Clique em <strong>Fragmentos</strong> na barra de navegação acima para continuar o tutorial e ver como registrar um tema de estudo na prática.`,
    elemento: 'a[href="fragmentos.html"]',
    posicao: 'baixo',
    transicao: true,
  },

  // ── FRAGMENTOS ────────────────────────────────────────────────────────────
  {
    pagina: 'fragmentos',
    titulo: 'O formulário de registro',
    descricao: `Aqui você registra cada sessão de estudo. Preencha o tema, a data, a confiança e os ecos para criar um fragmento.<br><br>
      O sistema usa esses dados para calcular a aura do tema e agendar a próxima revisão.`,
    elemento: '#novo-fragmento',
    posicao: 'baixo',
    semVoltar: true,
  },
  {
    pagina: 'fragmentos',
    titulo: 'Campo Tema',
    descricao: `Digite o assunto que você estudou. O campo tem <strong>autocomplete</strong> com os temas da sua lista curada — isso garante nomenclatura consistente e facilita filtros futuros.`,
    elemento: '#tema-input',
    posicao: 'baixo',
  },
  {
    pagina: 'fragmentos',
    titulo: 'Eco Inicial — antes de estudar',
    descricao: `Antes de abrir qualquer material, resolva um <strong>pequeno set de questões</strong> (5–10) sobre o tema e registre o resultado aqui.<br><br>
      Mede o que ainda está retido na memória de longo prazo. Ex.: <em>"3/5"</em> ou <em>"60%"</em>`,
    elemento: 'input[name="ecoInicial"]',
    posicao: 'baixo',
  },
  {
    pagina: 'fragmentos',
    titulo: 'Eco Final — depois de estudar',
    descricao: `Após revisar o conteúdo, resolva um <strong>bloco maior de questões de múltipla escolha</strong> (20–30) e registre aqui.<br><br>
      Esse é o indicador real de consolidação da sessão. Ex.: <em>"22/30"</em> ou <em>"73%"</em>`,
    elemento: 'input[name="ecoFinal"]',
    posicao: 'baixo',
  },
  {
    pagina: 'fragmentos',
    titulo: 'Tabela de Fragmentos',
    descricao: `Os temas registrados aparecem aqui com histórico completo de revisões — eco inicial, eco final, confiança e número de ciclos.<br><br>
      Clique no ícone de edição para ver e gerenciar os ciclos de um tema específico.`,
    elemento: '#fragmentos',
    posicao: 'cima',
    scrollBlock: 'start',
  },
  {
    pagina: 'fragmentos',
    titulo: 'Lista de Temas Curados',
    descricao: `Cadastre aqui os temas que planeja estudar. Eles aparecem como sugestões no autocomplete do formulário, ajudando a manter organização e consistência nos registros.`,
    elemento: '#painel-temas-curados',
    posicao: 'baixo',
    scrollBlock: 'start',
    preparo() {
      // Garante que a sidebar está aberta antes de mostrar o spotlight
      const sidebar   = document.getElementById('sidebar-temas');
      const toggleBtn = document.getElementById('sidebar-toggle');
      const layoutEl  = document.querySelector('.layout-fragmentos');
      if (!sidebar || !sidebar.classList.contains('recolhida')) return;
      sidebar.classList.remove('recolhida');
      layoutEl?.classList.remove('sidebar-recolhida');
      if (toggleBtn) { toggleBtn.textContent = '‹'; toggleBtn.title = 'Recolher painel'; }
      localStorage.setItem('sidebar-recolhida', '0');
    },
  },
  {
    pagina: 'fragmentos',
    titulo: 'Tudo pronto! ✦',
    descricao: `Você conhece o essencial do Re:memorium.<br><br>
      Comece registrando seu primeiro fragmento agora mesmo — preencha o tema, resolva as questões iniciais e registre o resultado.`,
    elemento: null,
    ultimo: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────

class Tour {
  constructor() {
    this.atual = 0;
    this.els = {};
  }

  iniciar(passo = 0) {
    this.atual = passo;
    this._destruir();
    this._criarDOM();
    this._renderPasso();
    document.addEventListener('keydown', this._onKeyDown);
  }

  _criarDOM() {
    const overlay   = document.createElement('div'); overlay.id   = 'tut-overlay';
    const spotlight = document.createElement('div'); spotlight.id = 'tut-spotlight';
    const flecha    = document.createElement('div'); flecha.id    = 'tut-flecha';
    const card      = document.createElement('div'); card.id      = 'tut-card';
    document.body.append(overlay, spotlight, flecha, card);
    this.els = { overlay, spotlight, flecha, card };
  }

  _renderPasso() {
    const passo = PASSOS[this.atual];

    // Cross-page: se o passo pertence a outra página, salva e redireciona
    if (passo.pagina && passo.pagina !== paginaAtual()) {
      sessionStorage.setItem(STORAGE_PASSO, this.atual);
      this._destruir();
      window.location.href = passo.pagina + '.html';
      return;
    }

    const total = PASSOS.length;
    const { card, spotlight, overlay } = this.els;

    const prevNaPagina = this.atual > 0 && !passo.semVoltar &&
      PASSOS[this.atual - 1].pagina === paginaAtual();
    const labelNext = passo.ultimo ? 'Começar ✦' : 'Próximo →';

    card.innerHTML = `
      <div class="tut-header">
        <span class="tut-progresso">${this.atual + 1} / ${PASSOS.length}</span>
        <button class="tut-skip">Pular tutorial</button>
      </div>
      <h3 class="tut-titulo">${passo.titulo}</h3>
      <p class="tut-descricao">${passo.descricao}</p>
      <div class="tut-acoes">
        ${prevNaPagina ? `<button class="tut-btn tut-btn--back">← Voltar</button>` : '<span></span>'}
        ${!passo.transicao ? `<button class="tut-btn tut-btn--next">${labelNext}</button>` : ''}
      </div>
    `;

    card.querySelector('.tut-skip').onclick = () => this._concluir();
    if (!passo.transicao) {
      card.querySelector('.tut-btn--next').onclick = () => this._ir(this.atual + 1);
    }
    const back = card.querySelector('.tut-btn--back');
    if (back) back.onclick = () => this._ir(this.atual - 1);

    if (passo.elemento) {
      const alvo = document.querySelector(passo.elemento);
      if (alvo) {
        if (passo.preparo) passo.preparo();

        const delay = passo.fixo ? 80 : 480;

        if (!passo.fixo) {
          this._desbloquearScroll();
          alvo.scrollIntoView({ behavior: 'smooth', block: passo.scrollBlock || 'center' });
        }

        setTimeout(() => {
          this._bloquearScroll();
          spotlight.classList.remove('tut-spotlight--pulse');
          spotlight.style.pointerEvents = 'none';
          spotlight.style.cursor = '';
          spotlight.onclick = null;
          spotlight.style.opacity = '1';
          overlay.className = 'tut-overlay-spotlight';
          this._posicionarNaElemento(alvo, passo.posicao, !!passo.transicao);

          if (passo.transicao) {
            sessionStorage.setItem(STORAGE_PASSO, this.atual + 1);
            spotlight.style.pointerEvents = 'all';
            spotlight.style.cursor = 'pointer';
            spotlight.classList.add('tut-spotlight--pulse');
            spotlight.onclick = () => {
              this._destruirSemLimpar();
              alvo.click();
            };
          }
        }, delay);
        return;
      }
    }

    // Sem elemento: overlay escuro + card centralizado
    this._bloquearScroll();
    spotlight.style.opacity = '0';
    this.els.flecha.style.opacity = '0';
    overlay.className = 'tut-overlay-escuro';
    this._centralizarCard();
  }

  _posicionarNaElemento(el, posicao, transicao = false) {
    const { spotlight, flecha, card } = this.els;
    const r   = el.getBoundingClientRect();
    const pad = 8, margem = 12;

    // Para elementos muito altos (ex: tabela), limita a altura ao viewport
    const H = window.innerHeight;
    const alturaEfetiva = Math.min(r.height, H * 0.6);

    Object.assign(spotlight.style, {
      left:   `${r.left - pad}px`,
      top:    `${r.top  - pad}px`,
      width:  `${r.width  + pad * 2}px`,
      height: `${alturaEfetiva + pad * 2}px`,
    });

    const W = window.innerWidth;
    const cardW = card.offsetWidth  || 360;
    const cardH = card.offsetHeight || 300;
    const spotlightBottom = r.top + alturaEfetiva;

    const left = Math.max(margem, Math.min(r.left, W - cardW - margem));

    const espaçoBaixo = H - (spotlightBottom + pad + margem);
    const espaçoCima  = r.top - pad - margem;
    let top;

    if (posicao === 'baixo') {
      if (espaçoBaixo >= cardH)      top = spotlightBottom + pad + margem;
      else if (espaçoCima >= cardH)  top = r.top - pad - margem - cardH;
      else top = espaçoBaixo >= espaçoCima ? Math.max(margem, H - cardH - margem) : margem;
    } else {
      if (espaçoCima >= cardH)       top = r.top - pad - margem - cardH;
      else if (espaçoBaixo >= cardH) top = spotlightBottom + pad + margem;
      else top = espaçoCima >= espaçoBaixo ? margem : Math.max(margem, H - cardH - margem);
    }

    const topFinal = Math.max(margem, Math.min(top, H - cardH - margem));
    Object.assign(card.style, {
      left:      `${left}px`,
      top:       `${topFinal}px`,
      transform: 'none',
    });

    // Flecha de transição: posicionada abaixo do centro do spotlight, acima do card
    if (transicao) {
      const esquerdaX = r.left + r.width * 0.25; // lado esquerdo do botão
      const spotBottom = r.top + alturaEfetiva + pad;
      flecha.style.cssText = `
        left: ${esquerdaX}px;
        top: ${spotBottom + 6}px;
        opacity: 1;
      `;
    } else {
      flecha.style.opacity = '0';
    }
  }

  _centralizarCard() {
    Object.assign(this.els.card.style, {
      left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
    });
  }

  _bloquearScroll()    { document.documentElement.style.overflow = 'hidden'; }
  _desbloquearScroll() { document.documentElement.style.overflow = ''; }

  _ir(indice) {
    if (indice >= PASSOS.length) { this._concluir(); return; }
    if (indice < 0) return;
    this.atual = indice;
    this._renderPasso();
  }

  _concluir() {
    localStorage.setItem(STORAGE_KEY, '1');
    sessionStorage.removeItem(STORAGE_PASSO);
    this._destruir();
  }

  _destruirSemLimpar() {
    this._desbloquearScroll();
    document.removeEventListener('keydown', this._onKeyDown);
    document.getElementById('tut-overlay')?.remove();
    document.getElementById('tut-spotlight')?.remove();
    document.getElementById('tut-flecha')?.remove();
    document.getElementById('tut-card')?.remove();
  }

  _destruir() {
    this._destruirSemLimpar();
  }

  _onKeyDown = (e) => {
    if (e.key === 'Escape')     this._concluir();
    if (e.key === 'ArrowRight') this._ir(this.atual + 1);
    if (e.key === 'ArrowLeft')  this._ir(this.atual - 1);
  };
}

export function iniciarTutorial() {
  new Tour().iniciar();
}

export function iniciarTutorialSeNovo() {
  const passoSalvo = sessionStorage.getItem(STORAGE_PASSO);
  if (passoSalvo !== null) {
    sessionStorage.removeItem(STORAGE_PASSO);
    setTimeout(() => new Tour().iniciar(parseInt(passoSalvo, 10)), 700);
    return;
  }
  if (!localStorage.getItem(STORAGE_KEY)) {
    setTimeout(() => new Tour().iniciar(), 900);
  }
}
