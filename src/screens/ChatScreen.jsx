import { Fragment, useEffect, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { CARD, COLORS, INPUT_BASE, PRIMARY_BTN } from '../theme.js';
import { calendarDayLabel, formatClock, MINUTE } from '../lib/time.js';
import { Avatar, LoadingBlock } from '../components/ui.jsx';
import { AuthPanel, SocialUnavailable } from './GroupsScreen.jsx';

function ChatRoom({ group, messages, myUid, connected, memberById, squadById, onSend }) {
  const [text, setText] = useState('');
  const lastId = messages[messages.length - 1]?.id;
  const today = Date.now();
  const online = Object.values(memberById).filter((m) => m.isCurrentUser || m.online).length;

  useEffect(() => {
    window.scrollTo({ top: document.documentElement.scrollHeight });
  }, [lastId]);

  const submit = async (event) => {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText('');
    if (!(await onSend(value))) setText(value);
  };

  return (
    <div className="pb-20">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
          <MessageCircle size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="truncate font-bold text-fg">{group.name}</h2>
          <p className="flex items-center gap-1.5 text-xs text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-online" />
            {online} online · as mensagens ficam só para o grupo
          </p>
        </div>
      </div>

      {messages.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">Nenhuma mensagem ainda. Dá um oi pro grupo! 👋</p>
      ) : (
        <ol>
          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const dayLabel = calendarDayLabel(message.ts, today);
            const newDay = !previous || calendarDayLabel(previous.ts, today) !== dayLabel;
            const grouped = !newDay && previous.uid === message.uid && message.ts - previous.ts < 5 * MINUTE;
            const mine = message.uid === myUid;
            const color = squadById[memberById[message.uid]?.subgroupId]?.color ?? COLORS.muted;
            return (
              <Fragment key={message.id}>
                {newDay && (
                  <li className="my-4 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-widest text-muted/70">
                    <span className="h-px flex-1 bg-line" />
                    {dayLabel}
                    <span className="h-px flex-1 bg-line" />
                  </li>
                )}
                <li className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-1' : 'mt-3'}`}>
                  {!mine && (grouped ? <span className="w-8 shrink-0" /> : <Avatar name={message.name} color={color} size={32} />)}
                  <div className={`flex min-w-0 max-w-[78%] flex-col ${mine ? 'items-end' : 'items-start'}`}>
                    {!grouped && (
                      <p className="mb-1 px-1 text-[11px] font-semibold" style={{ color: mine ? COLORS.primary : color }}>
                        {mine ? 'Você' : message.name} <span className="font-normal text-muted/70">{formatClock(message.ts)}</span>
                      </p>
                    )}
                    <p
                      className={`max-w-full whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                        mine ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md border border-line bg-card text-fg/90'
                      }`}
                    >
                      {message.text}
                    </p>
                  </div>
                </li>
              </Fragment>
            );
          })}
        </ol>
      )}

      <form
        onSubmit={submit}
        className="fixed inset-x-0 bottom-[calc(4.1rem_+_env(safe-area-inset-bottom))] z-30 border-t border-line/70 bg-shell/95 backdrop-blur-md"
      >
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-2.5">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={1000}
            enterKeyHint="send"
            placeholder={connected ? 'Mensagem para o grupo…' : 'Sem conexão — envia quando voltar'}
            aria-label="Mensagem"
            className={`${INPUT_BASE} min-w-0 flex-1 py-2.5`}
          />
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label="Enviar mensagem"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-white transition hover:brightness-110 disabled:opacity-30"
          >
            <Send size={18} />
          </button>
        </div>
      </form>
    </div>
  );
}

export function ChatScreen({ social, runSocial, pushToast, memberById, squadById, onOpenGroups }) {
  if (social.status === 'disabled') return <SocialUnavailable />;
  if (social.status === 'loading') return <LoadingBlock label="Abrindo o chat…" />;
  if (social.status === 'signed-out') return <AuthPanel actions={social.actions} pushToast={pushToast} />;
  if (social.status === 'no-group') {
    return (
      <div className={`${CARD} px-5 py-8 text-center`}>
        <MessageCircle size={26} className="mx-auto text-primary" />
        <h2 className="mt-3 font-bold text-fg">O chat é do seu grupo</h2>
        <p className="mt-1 text-sm text-muted">Crie um grupo ou entre com um código para conversar com os amigos.</p>
        <button type="button" onClick={onOpenGroups} className={`${PRIMARY_BTN} mx-auto mt-4`}>
          Ir para Grupos
        </button>
      </div>
    );
  }
  return (
    <ChatRoom
      group={social.group}
      messages={social.messages}
      myUid={social.user.uid}
      connected={social.connected}
      memberById={memberById}
      squadById={squadById}
      onSend={(text) => runSocial(() => social.actions.sendMessage(text))}
    />
  );
}
