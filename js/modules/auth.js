// modules/auth.js
/**
 * =============================================================================
 * Gerencia autenticação, perfil do usuário e modais relacionados
 * =============================================================================
 */
import {
    signOut,
    onAuthStateChanged,
    updateProfile,
    signInWithPopup,
    GoogleAuthProvider,
    fetchSignInMethodsForEmail,
    signInWithEmailAndPassword,
    linkWithCredential
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import { auth, salvarConfigUsuario, obterConfigUsuario } from '../database.js';
import { atualizarCountdown } from './dashboard.js';

// Provedor Google para login
const googleProvider = new GoogleAuthProvider();

/* ============================================================================
   AUTENTICAÇÃO COM GOOGLE
   ============================================================================ */

/**
 * Realiza login com Google (popup).
 * Também trata conflito de credenciais (quando email já existe em outro método).
 * @returns {Promise<User|null>} Usuário autenticado ou null em caso de erro.
 */
export async function loginComGoogle() {
    try {
        const result = await signInWithPopup(auth, googleProvider);
        console.log("Logado com Google:", result.user);
        return result.user;
    } catch (error) {
        if (error.code === "auth/account-exists-with-different-credential") {
            // Conflito de credencial: tenta unir conta Google com senha existente
            const pendingCred = GoogleAuthProvider.credentialFromError(error);
            const email = error.customData.email;
            const methods = await fetchSignInMethodsForEmail(auth, email);

            if (methods.includes("password")) {
                const senha = prompt("Você já tem conta com e-mail/senha. Digite sua senha para unificar com Google:");
                const emailUser = await signInWithEmailAndPassword(auth, email, senha);
                await linkWithCredential(emailUser.user, pendingCred);
                console.log("Conta unificada! Agora pode logar com Google ou senha.");
                return emailUser.user;
            } else {
                console.warn("Esse e-mail já existe, mas em outro provedor:", methods);
            }
        } else {
            console.error("Erro ao logar com Google:", error);
        }
        return null;
    }
}

/**
 * Realiza logout do usuário.
 * Limpa dados locais e redireciona para a tela de login.
 */
export function logout() {
    signOut(auth)
        .then(() => {
            localStorage.removeItem("nomeUsuario");
            const boasVindas = document.getElementById("boas-vindas");
            if (boasVindas) {
                boasVindas.textContent = "Até logo!";
            }
            setTimeout(() => {
                window.location.href = "index.html";
            }, 800);
        })
        .catch((error) => {
            console.error("Erro ao sair:", error);
            alert("Erro ao fazer logout. Tente novamente.");
        });
}

/* ============================================================================
   GERENCIAMENTO DE NOME E PERFIL
   ============================================================================ */

/**
 * Gerencia nome do usuário (pega do localStorage, Firebase ou abre modal).
 * @param {HTMLElement} boasVindasEl - Elemento para exibir saudação.
 * @param {HTMLElement} modalNome - Modal para definir nome.
 * @param {HTMLElement} inputNome - Input opcional para nome.
 */
export function gerenciarUsuario(boasVindasEl, modalNome, inputNome = null) {
    const user = auth.currentUser;
    let nome = localStorage.getItem("nomeUsuario");

    if (!nome) {
        if (user?.displayName) {
            nome = user.displayName;
            localStorage.setItem("nomeUsuario", nome);
            atualizarSaudacao(boasVindasEl, nome);
        } else {
            const inputReal = document.getElementById('nomeArcanoInput') || inputNome;
            abrirModalNome(modalNome, inputReal);
        }
        return;
    }
    atualizarSaudacao(boasVindasEl, nome);
}

/**
 * Salva nome/prova/data no localStorage, atualiza perfil do Firebase
 * e reflete na interface.
 */
export function salvarNomeUsuario(inputEl, boasVindasEl, modalEl) {
    const nome = inputEl?.value.trim();
    const provaEl = document.getElementById('provaInput');
    const dataEl = document.getElementById('dataProvaInput');
    const prova = provaEl?.value?.trim();
    const dataProva = dataEl?.value;

    if (nome) {
        // Salva em localStorage
        localStorage.setItem("nomeUsuario", nome);
        if (prova) localStorage.setItem("provaSelecionada", prova);
        if (dataProva) localStorage.setItem("dataProva", dataProva);

        // Atualiza perfil Firebase
        const user = auth.currentUser;
        if (user) {
            updateProfile(user, { displayName: nome }).catch(err => {
                console.error("Erro ao atualizar perfil:", err);
            });
        }

        // Atualiza UI
        fecharModalNome(modalEl);
        atualizarSaudacao(boasVindasEl, nome);

        const subtituloProva = document.getElementById('subtitulo-prova');
        if (subtituloProva && prova) {
            subtituloProva.textContent = prova;
        }
        const spanDias = document.getElementById('contador-dias');
        const tituloCont = document.getElementById('contador-titulo');
        if (spanDias || tituloCont) {
            atualizarCountdown(spanDias, tituloCont);
        }
    } else {
        if (inputEl) {
            inputEl.style.borderColor = "#c4554c";
            inputEl.placeholder = "Por favor, digite seu nome...";
        }
    }
}

/**
 * Salva dados e fecha o modal SOMENTE se os campos forem válidos
 * além de localStorage/Firebase, também grava no Firestore.
 */
export async function salvarNomeArcano() {
  const el = obterElementosDOM();
  if (!el) return;

  const nome = el.inputNome?.value?.trim() || "";
  const prova = el.subtituloProva?.value?.trim() || document.getElementById("provaInput")?.value?.trim() || "";
  const dataProva = document.getElementById("dataProvaInput")?.value?.trim() || "";

  // exige nome, os outros podem ser vazios
  if (!nome) {
    if (el.inputNome) {
      el.inputNome.style.borderColor = "#c4554c";
      el.inputNome.placeholder = "Por favor, digite seu nome...";
    }
    return;
  }

  const uid = auth.currentUser?.uid;
  if (!uid) {
    alert("Você precisa estar logado para salvar as configurações.");
    return;
  }

  const atual = await obterConfigUsuario(uid) || {};
  const novaConfig = {
    nome: nome || (atual.nome?.trim() ?? ""),
    prova: prova || (atual.prova?.trim() ?? ""),
    dataProva: dataProva || (atual.dataProva?.trim() ?? "")
  };

  await salvarConfigUsuario(uid, novaConfig);

  // Atualiza UI
  if (el.boasVindasEl) {
    el.boasVindasEl.textContent =
      `Welcome back, ${novaConfig.nome}. Your journey to mastery continues.`;
  }

  // Atualiza prova e contador, se os elementos existirem
  if (el.subtituloProva && el.contadorSpan && novaConfig.dataProva && novaConfig.prova) {
    el.subtituloProva.textContent = novaConfig.prova;
    atualizarCountdown(el.contadorSpan, el.subtituloProva, novaConfig.dataProva, novaConfig.prova);
  }

  // Fecha modal
  if (el.modalNome) {
    el.modalNome.classList.remove("ativo");
    el.modalNome.style.display = "none";
  }
}

/**
 * Atualiza elemento de saudação com nome do usuário.
 */
export function atualizarSaudacao(elemento, nome) {
    if (!elemento || !nome) return;
    elemento.innerHTML = `<p class="boas-vindas">Welcome back, ${nome}. Your journey to mastery continues.</p>`;
}

/* ============================================================================
   MODAL DE NOME
   ============================================================================ */

/**
 * Abre modal para definir nome do usuário.
 * Preenche com valores já salvos (localStorage) se existirem.
 */
export function abrirModalNome(modal, inputElement = null) {
    if (!modal) return;

    // Carrega valores salvos
    const nomeSalvo = localStorage.getItem('nomeUsuario') || '';
    const provaSalva = localStorage.getItem('provaSelecionada') || '';
    const dataSalva = localStorage.getItem('dataProva') || '';

    const nomeEl = document.getElementById('nomeArcanoInput');
    const provaEl = document.getElementById('provaInput');
    const dataEl = document.getElementById('dataProvaInput');

    if (nomeEl && !nomeEl.value) nomeEl.value = nomeSalvo;
    if (provaEl && !provaEl.value) provaEl.value = provaSalva;
    if (dataEl && !dataEl.value) dataEl.value = dataSalva;

    // Mostra modal
    modal.classList.add('ativo');

    // Foca no input após abrir
    const foco = inputElement || nomeEl;
    if (foco) setTimeout(() => foco.focus(), 100);
}

/**
 * Fecha SEMPRE o modal de nome, independente de dados preenchidos
 */
export function fecharModalNome() {
    const modal = document.getElementById("modal-nome");
    if (modal) {
        modal.classList.remove("ativo");
        modal.style.display = "none"; // garante que suma da tela
    }
}

/* ============================================================================
   UTILITÁRIOS DE AUTENTICAÇÃO
   ============================================================================ */

/**
 * Verifica se usuário está autenticado.
 * @returns {boolean} True se estiver logado.
 */
export function estaAutenticado() {
    return !!auth.currentUser;
}

/**
 * Observa mudanças no estado de autenticação.
 * Executa callback sempre que login/logout acontece.
 */
export function observarAutenticacao(callback) {
    return onAuthStateChanged(auth, (user) => {
        if (callback) callback(!!user);
    });
}

/* ============================================================================
   DEBUG / EXPOSIÇÃO GLOBAL
   ============================================================================ */
//window.loginComGoogle = loginComGoogle;
window.salvarNomeArcano = salvarNomeArcano;