// Testes das regras do Realtime Database (database.rules.json) contra os emuladores locais.
// Rode com `npm run test:rules`: sobe os emuladores, executa os testes e desliga tudo no final.
import assert from 'node:assert/strict';
import { deleteApp, initializeApp, setLogLevel } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { connectDatabaseEmulator, get, getDatabase, push, ref, serverTimestamp, set, update } from 'firebase/database';

const CONFIG = { apiKey: 'demo-api-key', projectId: 'demo-ypt', databaseURL: 'https://demo-ypt-default-rtdb.firebaseio.com' };
const RUN = Date.now().toString(36);
const TODAY = '2026-10-17';
const CODE = Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const apps = [];
let passed = 0;

setLogLevel('error'); // as escritas negadas de propósito geram avisos do SDK

async function newUser(label) {
  const app = initializeApp(CONFIG, `${label}-${RUN}`);
  apps.push(app);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getDatabase(app);
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  const { user } = await createUserWithEmailAndPassword(auth, `${label}-${RUN}@teste.dev`, 'senha123');
  return { db, uid: user.uid };
}

async function allowed(name, action) {
  await action();
  passed += 1;
  console.log(`  ok  ${name}`);
}

async function denied(name, action) {
  await assert.rejects(action, (error) => /permission/i.test(`${error.code} ${error.message}`), `${name}: deveria ser negado`);
  passed += 1;
  console.log(`  ok  ${name} (negado)`);
}

const squad = (name, color) => ({ name, color, motto: '', targetHoursPerMember: 4, createdAt: serverTimestamp() });

try {
  const ana = await newUser('ana');
  const bia = await newUser('bia');
  const eva = await newUser('eva');
  const gid = push(ref(ana.db, 'groups')).key;
  const lobos = push(ref(ana.db, `groups/${gid}/squads`)).key;
  const corujas = push(ref(ana.db, `groups/${gid}/squads`)).key;

  console.log('Grupo e convite');
  await allowed('Ana cria o grupo com código de convite', () =>
    update(ref(ana.db), {
      [`groups/${gid}`]: {
        name: 'Turma',
        ownerId: ana.uid,
        inviteCode: CODE,
        createdAt: serverTimestamp(),
        members: { [ana.uid]: { name: 'Ana', squadId: lobos, joinedAt: serverTimestamp() } },
        squads: { [lobos]: squad('Lobos', '#4F8CFF'), [corujas]: squad('Corujas', '#B46BFF') },
      },
      [`invites/${CODE}`]: gid,
      [`users/${ana.uid}`]: { name: 'Ana', groupId: gid },
    }),
  );
  await denied('Eva, de fora, não lê o grupo', () => get(ref(eva.db, `groups/${gid}`)));
  await denied('Eva não lista os convites', () => get(ref(eva.db, 'invites')));
  await denied('Eva não cria convite para o grupo da Ana', () => set(ref(eva.db, 'invites/ZZZZZ9'), gid));
  await denied('Bia não entra com código errado', () =>
    set(ref(bia.db, `groups/${gid}/members/${bia.uid}`), { name: 'Bia', joinedAt: serverTimestamp(), code: 'XXXXXX' }),
  );
  await allowed('Bia encontra o grupo pelo código', async () => assert.equal((await get(ref(bia.db, `invites/${CODE}`))).val(), gid));
  await allowed('Bia entra com o código certo', () =>
    update(ref(bia.db), {
      [`groups/${gid}/members/${bia.uid}`]: { name: 'Bia', joinedAt: serverTimestamp(), code: CODE },
      [`users/${bia.uid}/groupId`]: gid,
    }),
  );
  await allowed('Bia lê o grupo', () => get(ref(bia.db, `groups/${gid}`)));

  console.log('Cronômetros e squads');
  await allowed('Bia publica o próprio cronômetro', () =>
    update(ref(bia.db), {
      [`groups/${gid}/live/${bia.uid}`]: {
        online: true,
        studying: true,
        subject: 'Física',
        color: '#2ED47A',
        startedAt: Date.now(),
        base: 1200,
        dayKey: TODAY,
        updatedAt: serverTimestamp(),
      },
      [`groupDays/${gid}/${TODAY}/${bia.uid}`]: 1200,
    }),
  );
  await denied('Bia não altera o cronômetro da Ana', () => set(ref(bia.db, `groups/${gid}/live/${ana.uid}`), { online: true, studying: true }));
  await denied('Bia não grava horas no lugar da Ana', () => set(ref(bia.db, `groupDays/${gid}/${TODAY}/${ana.uid}`), 3600));
  await denied('Campo inventado no cronômetro é rejeitado', () => set(ref(bia.db, `groups/${gid}/live/${bia.uid}/trapaca`), true));
  await denied('Mais de 24 h num dia é rejeitado', () => set(ref(bia.db, `groupDays/${gid}/${TODAY}/${bia.uid}`), 90000));
  await denied('Eva não publica cronômetro no grupo', () => set(ref(eva.db, `groups/${gid}/live/${eva.uid}`), { online: true }));
  const fenix = push(ref(bia.db, `groups/${gid}/squads`)).key;
  await allowed('Bia cria um squad', () => set(ref(bia.db, `groups/${gid}/squads/${fenix}`), squad('Fênix', '#FF4D8D')));
  await allowed('Bia troca de squad', () => set(ref(bia.db, `groups/${gid}/members/${bia.uid}/squadId`), fenix));
  await denied('Bia não exclui squad (só o dono)', () => set(ref(bia.db, `groups/${gid}/squads/${corujas}`), null));
  await denied('Bia não muda o squad da Ana', () => set(ref(bia.db, `groups/${gid}/members/${ana.uid}/squadId`), fenix));
  await denied('Bia não vira dona do grupo', () => set(ref(bia.db, `groups/${gid}/ownerId`), bia.uid));
  await denied('Bia não renomeia o grupo', () => set(ref(bia.db, `groups/${gid}/name`), 'Grupo da Bia'));
  await allowed('Ana (dona) exclui um squad', () => set(ref(ana.db, `groups/${gid}/squads/${corujas}`), null));

  console.log('Chat');
  await allowed('Bia manda mensagem', () =>
    push(ref(bia.db, `messages/${gid}`), { uid: bia.uid, name: 'Bia', text: 'bora estudar?', ts: serverTimestamp() }),
  );
  await denied('Bia não manda mensagem se passando pela Ana', () =>
    push(ref(bia.db, `messages/${gid}`), { uid: ana.uid, name: 'Ana', text: 'fake', ts: serverTimestamp() }),
  );
  await denied('Mensagem com horário falso é rejeitada', () => push(ref(bia.db, `messages/${gid}`), { uid: bia.uid, name: 'Bia', text: 'oi', ts: 1 }));
  await denied('Eva não lê o chat', () => get(ref(eva.db, `messages/${gid}`)));
  await denied('Eva não manda mensagem', () =>
    push(ref(eva.db, `messages/${gid}`), { uid: eva.uid, name: 'Eva', text: 'oi', ts: serverTimestamp() }),
  );
  await allowed('Ana lê o chat', async () => assert.equal((await get(ref(ana.db, `messages/${gid}`))).size, 1));

  console.log('Saída do grupo');
  await allowed('Ana sai e passa a liderança para a Bia', () =>
    update(ref(ana.db), {
      [`groups/${gid}/ownerId`]: bia.uid,
      [`groups/${gid}/members/${ana.uid}`]: null,
      [`groups/${gid}/live/${ana.uid}`]: null,
      [`users/${ana.uid}/groupId`]: null,
    }),
  );
  await denied('Depois de sair, Ana não lê mais o grupo', () => get(ref(ana.db, `groups/${gid}`)));
  await allowed('Bia, agora dona, renomeia o grupo', () => set(ref(bia.db, `groups/${gid}/name`), 'Turma da Bia'));
  await allowed('Bia, sozinha, apaga grupo, chat, histórico e convite', () =>
    update(ref(bia.db), {
      [`groups/${gid}`]: null,
      [`invites/${CODE}`]: null,
      [`messages/${gid}`]: null,
      [`groupDays/${gid}`]: null,
      [`users/${bia.uid}/groupId`]: null,
    }),
  );
  await allowed('O código de convite deixa de existir', async () => assert.equal((await get(ref(bia.db, `invites/${CODE}`))).exists(), false));

  console.log(`\n${passed} verificações passaram.`);
} catch (error) {
  console.error(`\nFALHOU: ${error.message}`);
  process.exitCode = 1;
} finally {
  await Promise.all(apps.map((app) => deleteApp(app)));
  process.exit(process.exitCode ?? 0);
}
