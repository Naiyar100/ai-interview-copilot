import "./Coach.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import CoachSidebar from "../components/Coach/CoachSidebar";
import CoachChat from "../components/Coach/CoachChat";
import { deleteCoachChat, getCoachChat, getCoachChats, streamCoachMessage, updateCoachChat } from "../services/api";
import { useTheme } from "../context/ThemeContext";

function Coach() {
  const { preference, setPreference } = useTheme();
  const [chats, setChats] = useState([]); const [chat, setChat] = useState(null);
  const [search, setSearch] = useState(""); const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true); const [streaming, setStreaming] = useState(false); const [error, setError] = useState("");
  const streamController = useRef(null);

  const refreshChats = useCallback(async (query = search) => {
    const response = await getCoachChats(query); setChats(response.data.chats); return response.data.chats;
  }, [search]);

  useEffect(() => {
    let active = true; const timer = setTimeout(() => {
      getCoachChats(search).then((response) => { if (active) setChats(response.data.chats); }).catch((requestError) => { if (active) setError(requestError.message); }).finally(() => { if (active) setLoading(false); });
    }, search ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [search]);

  const selectChat = async (id) => {
    if (streaming) return;
    setError("");
    try { const response = await getCoachChat(id); setChat(response.data.chat); setSidebarOpen(false); }
    catch (requestError) { setError(requestError.message); }
  };
  const newChat = () => { if (streaming) return; setChat(null); setError(""); setSidebarOpen(false); };

  const runStream = async ({ message, regenerate = false }) => {
    if (streaming) return;
    const existingId = chat?.id || null;
    const optimisticUser = regenerate ? [] : [{ id: `user-${Date.now()}`, role: "user", content: message, createdAt: new Date().toISOString() }];
    const placeholder = { id: `assistant-${Date.now()}`, role: "assistant", content: "", streaming: true };
    setChat((current) => ({ ...(current || { id: null, title: "New career conversation", pinned: false }), messages: [...(current?.messages || []).slice(0, regenerate ? -1 : undefined), ...optimisticUser, placeholder] }));
    setStreaming(true); setError("");
    const controller = new AbortController(); streamController.current = controller;
    try {
      await streamCoachMessage({ message, chatId: existingId, regenerate, signal: controller.signal, onEvent: (event, data) => {
        if (event === "meta") setChat((current) => ({ ...current, id: data.chatId, title: data.title }));
        if (event === "chunk") setChat((current) => ({ ...current, messages: current.messages.map((item, index) => index === current.messages.length - 1 ? { ...item, content: item.content + data.text } : item) }));
        if (event === "done") setChat(data.chat);
      } });
      await refreshChats();
    } catch (requestError) {
      if (requestError.name !== "AbortError") setError(requestError.message || "Career coach response failed");
      if (existingId) {
        const response = await getCoachChat(existingId).catch(() => null); if (response) setChat(response.data.chat);
      } else setChat(null);
      await refreshChats().catch(() => {});
    } finally { setStreaming(false); streamController.current = null; }
  };

  const pinChat = async (item) => {
    try { await updateCoachChat(item.id, { pinned: !item.pinned }); await refreshChats(); if (chat?.id === item.id) setChat((current) => ({ ...current, pinned: !item.pinned })); }
    catch (requestError) { setError(requestError.message); }
  };
  const renameChat = async (item) => {
    const title = window.prompt("Rename conversation", item.title)?.trim(); if (!title || title === item.title) return;
    try { const response = await updateCoachChat(item.id, { title }); await refreshChats(); if (chat?.id === item.id) setChat((current) => ({ ...current, title: response.data.chat.title })); }
    catch (requestError) { setError(requestError.message); }
  };
  const removeChat = async (item) => {
    if (!window.confirm(`Delete “${item.title}”? This cannot be undone.`)) return;
    try { await deleteCoachChat(item.id); if (chat?.id === item.id) setChat(null); await refreshChats(); }
    catch (requestError) { setError(requestError.message); }
  };

  return <main className="coach-page">
    <div className="coach-app">
      <CoachSidebar chats={chats} selectedId={chat?.id} search={search} setSearch={setSearch} onSelect={selectChat} onNew={newChat} onPin={pinChat} onRename={renameChat} onDelete={removeChat} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && <button className="coach-scrim" type="button" aria-label="Close conversation sidebar" onClick={() => setSidebarOpen(false)} />}
      <div className="coach-main">
        <header className="coach-header"><button className="coach-menu" type="button" aria-label="Open conversation sidebar" onClick={() => setSidebarOpen(true)}>☰</button><Link className="coach-logo" to="/dashboard"><span>AI</span><strong>Career Coach</strong></Link><div className="coach-title"><strong>{chat?.title || "New conversation"}</strong><small>{chat?.messages?.length ? `${chat.messages.length} messages` : "Private, personalized guidance"}</small></div><label><span className="sr-only">Color theme</span><select aria-label="Color theme" value={preference} onChange={(event) => setPreference(event.target.value)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label><Link className="coach-dashboard-link" to="/dashboard">Dashboard</Link></header>
        {loading ? <div className="coach-loading" role="status" aria-label="Loading career coach"><i /><i /><i /></div> : <CoachChat chat={chat} streaming={streaming} error={error} onSend={(message) => runStream({ message })} onStop={() => streamController.current?.abort()} onRegenerate={() => runStream({ regenerate: true })} />}
      </div>
    </div>
  </main>;
}

export default Coach;
