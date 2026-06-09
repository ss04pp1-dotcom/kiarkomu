import React, { useState, useEffect, useRef } from "react";
import { useListConversations, useListMessages, useSendMessage, getListConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Send, Bot, Plus, Trash2, Pencil, Check, X, ToggleLeft, ToggleRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { API_URL } from "@/lib/api-url";

const TOKEN_KEY = "shohure_admin_token";

function getToken() {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(`${API_URL}/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}`, ...(opts?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

interface AutoReplyRule {
  id: number;
  keyword: string;
  response: string;
  isActive: boolean;
  createdAt: string;
}

function AutoRepliesTab() {
  const [rules, setRules] = useState<AutoReplyRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newKeyword, setNewKeyword] = useState("");
  const [newResponse, setNewResponse] = useState("");
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editKeyword, setEditKeyword] = useState("");
  const [editResponse, setEditResponse] = useState("");
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/auto-replies");
      setRules(data);
    } catch {
      toast({ title: "Failed to load auto-reply rules", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newKeyword.trim() || !newResponse.trim()) return;
    setAdding(true);
    try {
      const rule = await apiFetch("/auto-replies", { method: "POST", body: JSON.stringify({ keyword: newKeyword, response: newResponse }) });
      setRules(prev => [...prev, rule]);
      setNewKeyword("");
      setNewResponse("");
    } catch {
      toast({ title: "Failed to add rule", variant: "destructive" });
    }
    setAdding(false);
  };

  const handleDelete = async (id: number) => {
    await apiFetch(`/auto-replies/${id}`, { method: "DELETE" });
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const handleToggle = async (rule: AutoReplyRule) => {
    const updated = await apiFetch(`/auto-replies/${rule.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !rule.isActive }) });
    setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
  };

  const startEdit = (rule: AutoReplyRule) => {
    setEditId(rule.id);
    setEditKeyword(rule.keyword);
    setEditResponse(rule.response);
  };

  const saveEdit = async () => {
    if (!editId) return;
    const updated = await apiFetch(`/auto-replies/${editId}`, { method: "PATCH", body: JSON.stringify({ keyword: editKeyword, response: editResponse }) });
    setRules(prev => prev.map(r => r.id === editId ? updated : r));
    setEditId(null);
  };

  return (
    <div className="p-5 space-y-5 overflow-y-auto flex-1">
      <div className="flex items-center gap-2 text-gray-700">
        <Bot className="h-5 w-5 text-blue-500" />
        <p className="text-sm text-gray-500">
          When a customer's message contains a keyword, the system automatically replies with the configured response.
        </p>
      </div>

      {/* Add new rule */}
      <div className="rounded-lg border bg-blue-50 border-blue-200 p-4 space-y-3">
        <p className="text-sm font-semibold text-blue-800">Add New Rule</p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Keyword (case-insensitive match)</label>
            <Input
              placeholder="e.g. delivery, track, return"
              value={newKeyword}
              onChange={e => setNewKeyword(e.target.value)}
              className="bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Auto-reply message</label>
            <Input
              placeholder="e.g. Your order ships in 1-3 days…"
              value={newResponse}
              onChange={e => setNewResponse(e.target.value)}
              className="bg-white"
            />
          </div>
        </div>
        <Button size="sm" onClick={handleAdd} disabled={adding || !newKeyword.trim() || !newResponse.trim()}>
          <Plus className="h-3.5 w-3.5 mr-1" /> {adding ? "Adding…" : "Add Rule"}
        </Button>
      </div>

      {/* Rules list */}
      {loading ? (
        <p className="text-sm text-gray-400 text-center py-8">Loading rules…</p>
      ) : rules.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <Bot className="h-10 w-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No auto-reply rules yet. Add one above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div key={rule.id} className={cn("rounded-lg border p-3 bg-white transition-all", !rule.isActive && "opacity-60")}>
              {editId === rule.id ? (
                <div className="space-y-2">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <Input value={editKeyword} onChange={e => setEditKeyword(e.target.value)} placeholder="Keyword" className="h-8 text-sm" />
                    <Input value={editResponse} onChange={e => setEditResponse(e.target.value)} placeholder="Response" className="h-8 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={saveEdit}><Check className="h-3 w-3 mr-1" /> Save</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditId(null)}><X className="h-3 w-3 mr-1" /> Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">
                        🔑 {rule.keyword}
                      </span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full", rule.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
                        {rule.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{rule.response}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleToggle(rule)} className="p-1 text-gray-400 hover:text-blue-500 transition-colors" title="Toggle">
                      {rule.isActive ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    </button>
                    <button onClick={() => startEdit(rule)} className="p-1 text-gray-400 hover:text-gray-700 transition-colors" title="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(rule.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors" title="Delete">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Chat() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"conversations" | "auto-replies">("conversations");
  const { data: conversations, isLoading } = useListConversations({ query: { refetchInterval: 5000 } as any });
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const { data: messages, refetch } = useListMessages(
    selectedUserId ? { conversationUserId: selectedUserId } : {},
    { query: { enabled: !!selectedUserId, refetchInterval: 3000 } as any }
  );
  const sendMessage = useSendMessage();
  const [text, setText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const convList = (conversations as any[]) ?? [];
  const msgList = (messages as any[]) ?? [];

  useEffect(() => {
    if (!selectedUserId) return;
    apiFetch(`/messages/mark-read/${selectedUserId}`, { method: "PATCH" })
      .then(() => queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() }))
      .catch(() => {});
  }, [selectedUserId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [msgList.length]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !selectedUserId) return;
    sendMessage.mutate(
      { data: { body: text, toUserId: selectedUserId } },
      { onSuccess: () => { setText(""); refetch(); } }
    );
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
        <MessageSquare className="h-7 w-7" /> Customer Chat
      </h2>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("conversations")}
          className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", tab === "conversations" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}
        >
          <MessageSquare className="h-3.5 w-3.5 inline mr-1.5" />Conversations
        </button>
        <button
          onClick={() => setTab("auto-replies")}
          className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-all", tab === "auto-replies" ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700")}
        >
          <Bot className="h-3.5 w-3.5 inline mr-1.5" />Auto Replies
        </button>
      </div>

      {tab === "auto-replies" ? (
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
          <AutoRepliesTab />
        </div>
      ) : (
        <div className="flex h-[600px] rounded-xl border bg-white shadow-sm overflow-hidden">
          {/* Conversation list */}
          <div className="w-72 flex-shrink-0 border-r flex flex-col">
            <div className="px-4 py-3 border-b bg-gray-50">
              <p className="text-sm font-semibold text-gray-600">Conversations</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-gray-500">Loading…</div>
              ) : convList.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">No conversations yet</div>
              ) : (
                convList.map((c: any) => {
                  const hasUnread = (c.unreadCount ?? 0) > 0;
                  return (
                    <button
                      key={c.userId}
                      onClick={() => setSelectedUserId(c.userId)}
                      className={cn(
                        "w-full text-left px-4 py-3 flex items-center gap-3 transition-colors border-b",
                        selectedUserId === c.userId ? "bg-blue-50 border-r-2 border-r-blue-600" : hasUnread ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-gray-50"
                      )}
                    >
                      <div className={cn("h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0", hasUnread ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-600")}>
                        {c.userName?.[0]?.toUpperCase() ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <p className={cn("text-sm truncate", hasUnread ? "font-bold text-gray-900" : "font-medium text-gray-900")}>{c.userName ?? `User #${c.userId}`}</p>
                          {hasUnread && (
                            <span className="flex-shrink-0 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                        <p className={cn("text-xs truncate", hasUnread ? "text-gray-700 font-medium" : "text-gray-500")}>{c.lastMessage ?? "No messages"}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Message area */}
          <div className="flex-1 flex flex-col">
            {!selectedUserId ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Select a conversation</p>
                </div>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 border-b bg-gray-50 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                    {convList.find((c: any) => c.userId === selectedUserId)?.userName?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <p className="text-sm font-semibold text-gray-700">
                    {convList.find((c: any) => c.userId === selectedUserId)?.userName ?? `User #${selectedUserId}`}
                  </p>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {msgList.map((m: any) => {
                    const isAdmin = ["owner", "manager"].includes(m.senderRole);
                    return (
                      <div key={m.id} className={cn("flex", isAdmin ? "justify-end" : "justify-start")}>
                        {!isAdmin && (
                          <div className="h-7 w-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs mr-2 flex-shrink-0 self-end">
                            {convList.find((c: any) => c.userId === selectedUserId)?.userName?.[0]?.toUpperCase() ?? "?"}
                          </div>
                        )}
                        <div className="max-w-xs">
                          <div className={cn("px-3 py-2 rounded-2xl text-sm", isAdmin ? "bg-blue-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm")}>
                            {m.body}
                          </div>
                          <p className={cn("text-[10px] mt-0.5 text-gray-400", isAdmin ? "text-right" : "text-left")}>
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        {isAdmin && (
                          <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center ml-2 flex-shrink-0 self-end">
                            <MessageSquare className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
                  <Input
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder="Type a message…"
                    className="flex-1"
                  />
                  <Button type="submit" size="icon" disabled={!text.trim() || sendMessage.isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
