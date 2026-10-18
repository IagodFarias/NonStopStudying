/* Camada social do YPT Squads, toda no Firebase Realtime Database.
 *
 *   users/{uid}                      { name, groupId }
 *   invites/{CODE}                   groupId
 *   groups/{gid}                     { name, ownerId, inviteCode, createdAt, members, squads, live }
 *   groups/{gid}/members/{uid}       { name, squadId, joinedAt, code }
 *   groups/{gid}/squads/{sid}        { name, color, motto, targetHoursPerMember, createdAt }
 *   groups/{gid}/live/{uid}          { online, studying, subject, color, startedAt, base, dayKey, updatedAt, lastSeen }
 *   groupDays/{gid}/{dayKey}/{uid}   segundos estudados no dia (alimenta o comparativo de 7 dias)
 *   messages/{gid}/{msgId}           { uid, name, text, ts }
 *
 * O cronômetro ao vivo só é gravado no Play e na pausa: `base` é o tempo do dia antes da sessão atual
 * e `startedAt` é o início dela no relógio do servidor. Cada aparelho calcula o resto sozinho.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import {
  get,
  limitToLast,
  onDisconnect,
  onValue,
  orderByKey,
  push,
  query,
  ref,
  serverTimestamp,
  set,
  startAt,
  update,
} from 'firebase/database';
import { auth, db, firebaseReady } from './firebase.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O e 1/I para não confundir ao digitar
const MESSAGE_LIMIT = 100;

const DEFAULT_SQUADS = [
  { name: 'Lobos Noturnos', color: '#4F8CFF', motto: 'Enquanto o mundo dorme, a gente avança.', targetHoursPerMember: 4 },
  { name: 'Corujas Insones', color: '#B46BFF', motto: 'Café, foco e aprovação.', targetHoursPerMember: 4 },
];

const ERROR_MESSAGES = {
  'auth/email-already-in-use': 'Já existe uma conta com esse e-mail.',
  'auth/invalid-email': 'E-mail inválido.',
  'auth/missing-email': 'Digite seu e-mail.',
  'auth/missing-password': 'Digite a senha.',
  'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.',
  'auth/too-many-requests': 'Muitas tentativas. Espere um pouco e tente de novo.',
  'auth/network-request-failed': 'Sem conexão com a internet.',
  'auth/operation-not-allowed': 'O login por e-mail não está ativado no projeto do Firebase.',
  'auth/configuration-not-found': 'O login ainda não foi ativado no projeto do Firebase (Authentication → Vamos começar).',
};

export function friendlyError(error) {
  const code = String(error?.code ?? '');
  if (ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
  if (/permission/i.test(`${code} ${error?.message ?? ''}`)) return 'Sem permissão para fazer isso.';
  return error?.message || 'Algo deu errado. Tente de novo.';
}

function appError(code, message) {
  return Object.assign(new Error(message), { code });
}

export const normalizeCode = (value) =>
  String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);

function randomCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
}

async function reserveInviteCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomCode();
    if (!(await get(ref(db, `invites/${code}`))).exists()) return code;
  }
  throw appError('code-collision', 'Não deu para gerar um código de convite. Tente de novo.');
}

function squadSizes(squadIds, members, ignoreUid) {
  const sizes = Object.fromEntries(squadIds.map((id) => [id, 0]));
  Object.entries(members ?? {}).forEach(([memberId, member]) => {
    if (memberId !== ignoreUid && sizes[member.squadId] !== undefined) sizes[member.squadId] += 1;
  });
  return sizes;
}

const smallestOf = (sizes) => Object.keys(sizes).sort((a, b) => sizes[a] - sizes[b])[0];

export function useSocial() {
  const [user, setUser] = useState(firebaseReady ? undefined : null);
  const [profile, setProfile] = useState(undefined);
  const [group, setGroup] = useState(undefined);
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const [serverOffset, setServerOffset] = useState(0);
  const [notice, setNotice] = useState(null);
  const groupRef = useRef(group);
  groupRef.current = group;
  const leavingRef = useRef(null);
  const autoSquadRef = useRef(null);

  const uid = user?.uid ?? null;
  const groupId = profile?.groupId ?? null;
  const activeGroupId = group?.id ?? null;
  const myName = (profile?.name || user?.displayName || '').trim();

  useEffect(() => (firebaseReady ? onAuthStateChanged(auth, (next) => setUser(next ?? null)) : undefined), []);

  useEffect(() => {
    if (!uid) return undefined;
    const stopOffset = onValue(ref(db, '.info/serverTimeOffset'), (snap) => setServerOffset(Number(snap.val()) || 0));
    const stopConnected = onValue(ref(db, '.info/connected'), (snap) => setConnected(snap.val() === true));
    return () => {
      stopOffset();
      stopConnected();
    };
  }, [uid]);

  useEffect(() => {
    setProfile(undefined);
    if (!uid) return undefined;
    return onValue(
      ref(db, `users/${uid}`),
      (snap) => setProfile(snap.val() ?? {}),
      () => setProfile({}),
    );
  }, [uid]);

  useEffect(() => {
    if (!uid || !groupId) {
      setGroup(null);
      return undefined;
    }
    setGroup(undefined);
    // perdeu o acesso: o dono removeu a pessoa ou o grupo foi apagado (sair por conta própria não avisa)
    const forget = () => {
      setGroup(null);
      if (leavingRef.current === groupId) return;
      setNotice('Você não faz mais parte desse grupo.');
      set(ref(db, `users/${uid}/groupId`), null).catch(() => {});
    };
    return onValue(
      ref(db, `groups/${groupId}`),
      (snap) => {
        const value = snap.val();
        if (value?.members?.[uid]) setGroup({ id: groupId, ...value });
        else forget();
      },
      forget,
    );
  }, [uid, groupId]);

  useEffect(() => {
    setMessages([]);
    if (!uid || !activeGroupId) return undefined;
    return onValue(
      query(ref(db, `messages/${activeGroupId}`), orderByKey(), limitToLast(MESSAGE_LIMIT)),
      (snap) => {
        const list = [];
        snap.forEach((child) => {
          list.push({ id: child.key, ...child.val() });
        });
        setMessages(list);
      },
      () => setMessages([]),
    );
  }, [uid, activeGroupId]);

  // presença: se o aparelho cair, o servidor marca offline e guarda a hora (o tempo conta até ali)
  useEffect(() => {
    if (!uid || !activeGroupId || !connected) return undefined;
    const presence = onDisconnect(ref(db, `groups/${activeGroupId}/live/${uid}`));
    presence.update({ online: false, lastSeen: serverTimestamp() }).catch(() => {});
    return () => {
      presence.cancel().catch(() => {});
    };
  }, [uid, activeGroupId, connected]);

  // quem entra sem squad (ou teve o squad excluído) vai para o squad com menos gente
  useEffect(() => {
    if (!group || !uid) return;
    const squadIds = Object.keys(group.squads ?? {});
    const mine = group.members?.[uid]?.squadId;
    if (!squadIds.length || (mine && group.squads[mine])) return;
    const attempt = `${group.id}:${squadIds.join(',')}:${mine ?? ''}`;
    if (autoSquadRef.current === attempt) return;
    autoSquadRef.current = attempt;
    set(ref(db, `groups/${group.id}/members/${uid}/squadId`), smallestOf(squadSizes(squadIds, group.members, uid))).catch(() => {});
  }, [group, uid]);

  const publishLive = useCallback(
    (live) => {
      if (!uid || !activeGroupId) return Promise.resolve();
      return update(ref(db), {
        [`groups/${activeGroupId}/live/${uid}`]: { ...live, online: true, updatedAt: serverTimestamp() },
        [`groupDays/${activeGroupId}/${live.dayKey}/${uid}`]: live.base,
      });
    },
    [uid, activeGroupId],
  );

  const clearNotice = useCallback(() => setNotice(null), []);

  const actions = useMemo(() => {
    const currentGroup = () => {
      if (!groupRef.current) throw appError('no-group', 'Você não está em um grupo.');
      return groupRef.current;
    };
    const displayName = () => myName.slice(0, 24) || 'Estudante';

    return {
      async signUp({ name, email, password }) {
        const cleanName = name.trim().slice(0, 24);
        if (!cleanName) throw appError('missing-name', 'Digite seu nome.');
        const { user: created } = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await Promise.all([updateProfile(created, { displayName: cleanName }), set(ref(db, `users/${created.uid}/name`), cleanName)]);
      },

      signIn: ({ email, password }) => signInWithEmailAndPassword(auth, email.trim(), password),

      resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),

      async signOut() {
        const current = groupRef.current;
        if (current && uid) {
          const liveRef = ref(db, `groups/${current.id}/live/${uid}`);
          await onDisconnect(liveRef).cancel().catch(() => {});
          await update(liveRef, { online: false, lastSeen: serverTimestamp() }).catch(() => {});
        }
        await firebaseSignOut(auth);
      },

      async createGroup(rawName) {
        const name = rawName.trim().slice(0, 40);
        if (!name) throw appError('missing-name', 'Dê um nome para o grupo.');
        const gid = push(ref(db, 'groups')).key;
        const code = await reserveInviteCode();
        const squads = {};
        DEFAULT_SQUADS.forEach((squad) => {
          squads[push(ref(db, `groups/${gid}/squads`)).key] = { ...squad, createdAt: serverTimestamp() };
        });
        await update(ref(db), {
          [`groups/${gid}`]: {
            name,
            ownerId: uid,
            inviteCode: code,
            createdAt: serverTimestamp(),
            members: { [uid]: { name: displayName(), squadId: Object.keys(squads)[0], joinedAt: serverTimestamp() } },
            squads,
          },
          [`invites/${code}`]: gid,
          [`users/${uid}/groupId`]: gid,
        });
      },

      async joinGroup(rawCode) {
        const code = normalizeCode(rawCode);
        if (code.length !== 6) throw appError('invalid-code', 'O código tem 6 letras ou números.');
        const invite = await get(ref(db, `invites/${code}`));
        if (!invite.exists()) throw appError('invite-not-found', 'Código de convite não encontrado.');
        const gid = invite.val();
        await update(ref(db), {
          [`groups/${gid}/members/${uid}`]: { name: displayName(), joinedAt: serverTimestamp(), code },
          [`users/${uid}/groupId`]: gid,
        });
      },

      async leaveGroup() {
        const current = currentGroup();
        leavingRef.current = current.id;
        await onDisconnect(ref(db, `groups/${current.id}/live/${uid}`)).cancel().catch(() => {});
        const others = Object.entries(current.members ?? {})
          .filter(([memberId]) => memberId !== uid)
          .sort(([, a], [, b]) => (a.joinedAt ?? 0) - (b.joinedAt ?? 0));
        if (current.ownerId === uid && others.length === 0) {
          // último membro: apaga grupo, chat, histórico e convite
          await update(ref(db), {
            [`groups/${current.id}`]: null,
            [`invites/${current.inviteCode}`]: null,
            [`messages/${current.id}`]: null,
            [`groupDays/${current.id}`]: null,
            [`users/${uid}/groupId`]: null,
          });
          return;
        }
        const updates = {
          [`groups/${current.id}/members/${uid}`]: null,
          [`groups/${current.id}/live/${uid}`]: null,
          [`users/${uid}/groupId`]: null,
        };
        if (current.ownerId === uid) updates[`groups/${current.id}/ownerId`] = others[0][0];
        await update(ref(db), updates);
      },

      async renameMe(rawName) {
        const name = rawName.trim().slice(0, 24);
        if (!name) throw appError('missing-name', 'Digite seu nome.');
        const updates = { [`users/${uid}/name`]: name };
        if (groupRef.current) updates[`groups/${groupRef.current.id}/members/${uid}/name`] = name;
        await update(ref(db), updates);
        if (auth.currentUser) await updateProfile(auth.currentUser, { displayName: name });
      },

      renameGroup: (rawName) => set(ref(db, `groups/${currentGroup().id}/name`), rawName.trim().slice(0, 40)),

      async createSquad(squad, join) {
        const current = currentGroup();
        const squadId = push(ref(db, `groups/${current.id}/squads`)).key;
        const updates = { [`groups/${current.id}/squads/${squadId}`]: { ...squad, createdAt: serverTimestamp() } };
        if (join) updates[`groups/${current.id}/members/${uid}/squadId`] = squadId;
        await update(ref(db), updates);
      },

      updateSquad: (squadId, patch) => update(ref(db, `groups/${currentGroup().id}/squads/${squadId}`), patch),

      async deleteSquad(squadId) {
        const current = currentGroup();
        const remaining = Object.keys(current.squads ?? {}).filter((id) => id !== squadId);
        const sizes = squadSizes(remaining, current.members);
        const updates = { [`groups/${current.id}/squads/${squadId}`]: null };
        Object.entries(current.members ?? {}).forEach(([memberId, member]) => {
          if (member.squadId !== squadId || !remaining.length) return;
          const target = smallestOf(sizes);
          sizes[target] += 1;
          updates[`groups/${current.id}/members/${memberId}/squadId`] = target;
        });
        await update(ref(db), updates);
      },

      switchSquad: (squadId) => set(ref(db, `groups/${currentGroup().id}/members/${uid}/squadId`), squadId),

      removeMember: (memberId) => set(ref(db, `groups/${currentGroup().id}/members/${memberId}`), null),

      async sendMessage(rawText) {
        const text = rawText.trim().slice(0, 1000);
        if (!text) return;
        await push(ref(db, `messages/${currentGroup().id}`), { uid, name: displayName(), text, ts: serverTimestamp() });
      },

      async fetchDays(fromKey) {
        if (!groupRef.current) return {};
        const snapshot = await get(query(ref(db, `groupDays/${groupRef.current.id}`), orderByKey(), startAt(fromKey)));
        return snapshot.val() ?? {};
      },
    };
  }, [uid, myName]);

  let status = 'ready';
  if (!firebaseReady) status = 'disabled';
  else if (user === undefined || (user && profile === undefined)) status = 'loading';
  else if (user === null) status = 'signed-out';
  else if (!groupId || group === null) status = 'no-group';
  else if (group === undefined) status = 'loading';

  return { status, user, profile, group, messages, connected, serverOffset, notice, clearNotice, myName, publishLive, actions };
}
