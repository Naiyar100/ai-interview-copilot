const relativeTime = (value) => {
  if (!value) return "";
  const days = Math.round((new Date(value).getTime() - Date.now()) / 86400000);
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(days, "day");
};

export default function CoachSidebar({ chats, selectedId, search, setSearch, onSelect, onNew, onPin, onRename, onDelete, open, onClose }) {
  return <aside className={`coach-sidebar ${open ? "open" : ""}`} aria-label="Career coach conversations">
    <div className="coach-side-head"><strong>Career Coach</strong><button type="button" onClick={onClose} aria-label="Close conversation sidebar">×</button></div>
    <button className="coach-new" type="button" onClick={onNew}><span>+</span>New conversation</button>
    <label className="coach-search"><span className="sr-only">Search conversations</span><input aria-label="Search conversations" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search chats" /></label>
    <div className="coach-history" aria-live="polite">{chats.length ? chats.map((chat) => <article className={selectedId === chat.id ? "active" : ""} key={chat.id}>
      <button className="chat-select" type="button" onClick={() => onSelect(chat.id)}><span>{chat.pinned ? "◆" : "◇"}</span><div><strong>{chat.title}</strong><small>{relativeTime(chat.lastMessageAt)} · {chat.messageCount} messages</small></div></button>
      <div className="chat-actions"><button type="button" onClick={() => onPin(chat)} aria-label={`${chat.pinned ? "Unpin" : "Pin"} ${chat.title}`}>{chat.pinned ? "Unpin" : "Pin"}</button><button type="button" onClick={() => onRename(chat)} aria-label={`Rename ${chat.title}`}>Rename</button><button type="button" onClick={() => onDelete(chat)} aria-label={`Delete ${chat.title}`}>Delete</button></div>
    </article>) : <div className="coach-no-history"><span>◇</span><strong>No conversations found</strong><p>Start a new chat or change your search.</p></div>}</div>
  </aside>;
}
