// =============================================================================
// DATABASE.JS - Firestore por usuário (users/{uid}/…)
// =============================================================================
// Responsável por:
// - Conexão e inicialização do Firebase
// - Gestão de configs do usuário
// - CRUD de fragmentos (notas/revisões)
// - CRUD de temas curados (autocomplete)
// =============================================================================

import { normalizarTexto } from './utils.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDoc, 
  getDocs,
  doc,
  writeBatch,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {
  getAuth,
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

// -----------------------------------------------------------------------------
// Configuração Firebase
// -----------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyD4bYd2ftMKgpuhVQesgHoZ9pa2sYbqhqU",
  authDomain: "rememorium-1e926.firebaseapp.com",
  projectId: "rememorium-1e926",
  storageBucket: "rememorium-1e926.appspot.com",
  messagingSenderId: "747957308270",
  appId: "1:747957308270:web:959f82a2978db950138f7f",
  measurementId: "G-1088X2B8LE"
};

// Inicialização principal
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// -----------------------------------------------------------------------------
// Helpers internos
// -----------------------------------------------------------------------------
function ensureUid(uid) {
  return uid || auth?.currentUser?.uid || null;
}
function fragCol(uid) {
  return collection(db, `users/${uid}/fragmentos`);
}
function temasCol(uid) {
  return collection(db, `users/${uid}/temas`);
}

// =============================================================================
// CONFIGURAÇÕES DO USUÁRIO
// =============================================================================

/** Salva ou atualiza a configuração do usuário (merge no doc principal) */
export async function salvarConfigUsuario(uid, config) {
  if (!uid) throw new Error("UID ausente em salvarConfigUsuario");
  const ref = doc(db, "users", uid);
  await setDoc(ref, config, { merge: true }); // merge → preserva subcoleções
}

/** Obtém a configuração do usuário (cria doc inicial vazio se não existir) */
export async function obterConfigUsuario(uid) {
  if (!uid) return null;
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Garante que o doc existe para evitar erros na 1ª vez
    await setDoc(ref, { nome: "", prova: "", dataProva: "" });
    return { nome: "", prova: "", dataProva: "" };
  }
  return snap.data() || { nome: "", prova: "", dataProva: "" };
}

/** Reseta as configs do usuário (mantém fragmentos/temas intactos) */
export async function resetConfigUsuario(uid) {
  if (!uid) throw new Error("UID ausente em resetConfigUsuario");
  const ref = doc(db, "users", uid);
  await setDoc(ref, {
    nome: "",
    prova: "",
    dataProva: ""
  }, { merge: true });
}

// =============================================================================
// FRAGMENTOS (users/{uid}/fragmentos)
// =============================================================================

/** Obtém todos os fragmentos do usuário atual */
export async function obterFragmentos(uid) {
  uid = ensureUid(uid);
  if (!uid) return [];

  const snap = await getDocs(fragCol(uid));
  return snap.docs.map(d => {
    const data = d.data() || {};
    return {
      id: d.id,
      temaSlug: data.temaSlug ?? normalizarTexto(data.tema || ''),
      ...data,
    };
  });
}

/** 
 * Salva um fragmento no Firestore
 * - Se já existir (mesmo temaSlug ou tema exato): atualiza e cria novo histórico
 * - Se não existir: cria doc novo
 */
export async function salvarFragmentoNoFirestore(novo, uid) {
  uid = ensureUid(uid);
  if (!uid) throw new Error('uid ausente em salvarFragmentoNoFirestore');

  const colRef = fragCol(uid);
  const slug = normalizarTexto(novo.tema);

  // 1) busca por temaSlug
  let snap = await getDocs(query(colRef, where('temaSlug', '==', slug)));

  // 2) fallback: busca por tema exato
  if (snap.empty) {
    snap = await getDocs(query(colRef, where('tema', '==', novo.tema)));
  }

  let docAlvo = null;
  if (!snap.empty) {
    docAlvo = snap.docs[0];
  }

  if (docAlvo) {
    // 🔹 Atualiza fragmento existente + adiciona ao histórico
    const dadosAntigos = docAlvo.data() || {};
    const historicoAnterior = (dadosAntigos.historico || []).slice();

    historicoAnterior.push({
      data: dadosAntigos.ultimaRevisao || new Date().toISOString(),
      ecoInicial: dadosAntigos.ecoInicial ?? 0,
      ecoFinal: dadosAntigos.ecoFinal ?? 0,
      confianca: dadosAntigos.confianca || '',
    });

    await updateDoc(docAlvo.ref, {
      ...novo,
      id: docAlvo.id,
      ownerUid: uid,
      temaSlug: slug,
      historico: historicoAnterior,
      ciclos: historicoAnterior.length,
      ultimaRevisao: new Date().toISOString(),
    });

  } else {
    // 🔹 Cria novo fragmento
    const docRef = await addDoc(colRef, {
      ...novo,
      ownerUid: uid,
      temaSlug: slug,
      historico: [],
      ciclos: 0,
      ultimaRevisao: new Date().toISOString(),
    });

    // garante ID dentro do próprio documento
    await updateDoc(docRef, { id: docRef.id });
    novo.id = docRef.id;
  }
}

/** Atualiza fragmento existente diretamente */
export async function atualizarFragmentoNoFirebase(id, dadosAtualizados, uid) {
  uid = ensureUid(uid);
  if (!uid) throw new Error('uid ausente em atualizarFragmentoNoFirebase');
  const ref = doc(db, `users/${uid}/fragmentos/${id}`);
  await updateDoc(ref, dadosAtualizados);
}

/** Exclui um fragmento por ID */
export async function excluirFragmentoPorId(id, _botao, uid) {
  uid = ensureUid(uid);
  if (!uid) throw new Error('uid ausente em excluirFragmentoPorId');
  const ref = doc(db, `users/${uid}/fragmentos/${id}`);
  await deleteDoc(ref);
}

/** Exclui apenas um ciclo de revisão de um fragmento */
export async function excluirRevisaoDoCiclo(id, cicloIndex, fragmentosData, uid) {
  uid = ensureUid(uid);
  if (!uid) throw new Error('uid ausente em excluirRevisaoDoCiclo');

  const fragmento = fragmentosData.find(f => f.id === id);
  if (!fragmento || !fragmento.historico || !fragmento.historico[cicloIndex]) return null;

  const tema = fragmento.tema;
  const ok = confirm(`Deseja realmente excluir o ciclo ${cicloIndex + 1} do tema "${tema}"? Esta ação não pode ser desfeita.`);
  if (!ok) return null;

  // Atualiza local
  fragmento.historico.splice(cicloIndex, 1);
  fragmento.ciclos = fragmento.historico.length;

  // Atualiza Firestore
  const ref = doc(db, `users/${uid}/fragmentos/${id}`);
  await updateDoc(ref, {
    historico: [...fragmento.historico],
    ciclos: fragmento.historico.length,
  });

  return fragmentosData;
}

// =============================================================================
// TEMAS CURADOS (users/{uid}/temas)
// =============================================================================

/** Obtém lista de temas curados do usuário */
export async function obterTemasCurados(uid) {
  uid = ensureUid(uid);
  if (!uid) return [];

  const snap = await getDocs(temasCol(uid));
  return snap.docs
    .map(d => {
      const x = d.data() || {};
      return (x.nome ?? x.label ?? x.title ?? d.id)?.toString().trim();
    })
    .filter(Boolean);
}

/** Salva lista de temas curados (batch) */
export async function salvarTemasCurados(temas, uid) {
  uid = ensureUid(uid);
  if (!uid) throw new Error('uid ausente em salvarTemasCurados');

  const col = temasCol(uid);
  const batch = writeBatch(db);

  temas.forEach(tema => {
    const id = normalizarTexto(tema);
    const ref = doc(db, `users/${uid}/temas/${id}`);
    batch.set(ref, { nome: tema });
  });

  await batch.commit();
}

/** Remove tema curado específico */
export async function apagarTemaCurado(nome, uid) {
  uid = ensureUid(uid);
  if (!uid) throw new Error('uid ausente em apagarTemaCurado');

  const q = query(temasCol(uid), where('nome', '==', nome));
  const snapshot = await getDocs(q);

  for (const d of snapshot.docs) {
    await deleteDoc(doc(db, `users/${uid}/temas/${d.id}`));
  }
}

// =============================================================================
// Debug helpers (para console do navegador)
// =============================================================================
//window.salvarConfigUsuario = salvarConfigUsuario;
//window.obterConfigUsuario  = obterConfigUsuario;
//window.resetConfigUsuario  = resetConfigUsuario;
//window.obterFragmentos     = obterFragmentos;

// Firestore debug
//window._db = db;
//window._auth = auth;
//window._doc = doc;
//window._getDoc = getDoc;
//window._getDocs = getDocs;
//window._collection = collection;