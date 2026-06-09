"use client";
import { useState, useEffect, useRef } from "react";
import { Send, Loader2, MessageCircle, Bot } from "lucide-react";
import {
  useListMessages, useSendMessage,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import type { Message } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { usePublicConfig } from "@/lib/usePublicConfig";

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString("en-BD", { hour: "numeric", minute: "2-digit", hour12: true });
}
function formatDateGroup(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  if (diff < 86400000 && date.getDate() === now.getDate()) return "Today";
  if (diff < 172800000) return "Yesterday";
  return date.toLocaleDateString("en-BD", { day: "numeric", month: "short", year: "numeric" });
}

export default function MessagesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useListMessages({
    query: { queryKey: getListMessagesQueryKey() },
    refetchInterval: 5000,
  } as Parameters<typeof useListMessages>[0]);
  const { data: config } = usePublicConfig();
  const sendMutation = useSendMessage();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || sending) return;
    const text = body.trim();
    setBody("");
    setSending(true);
    try {
      await sendMutation.mutateAsync({ data: { body: text } });
      queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey() });
    } catch {
    } finally {
      setSending(false);
    }
  };

  const groupedMessages = (messages as Message[]).reduce<Record<string, Message[]>>((acc, msg) => {
    const key = formatDateGroup(msg.createdAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(msg);
    return acc;
  }, {});

  const whatsappNumber = config?.whatsappNumber;

  return (
    <div className="flex flex-col h-[70vh] min-h-[400px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Support Chat</h2>
          <p className="text-sm text-gray-400">Chat with our support team</p>
        </div>
        {whatsappNumber && (
          <a
            href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
            WhatsApp
          </a>
        )}
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-gray-100 flex flex-col overflow-hidden">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#F0185A]" />
          </div>
        ) : (messages as Message[]).length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-[#F0185A]" />
            </div>
            <p className="text-gray-700 font-semibold mb-1">Start a Conversation</p>
            <p className="text-sm text-gray-400">Send us a message and we&apos;ll respond shortly.</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {Object.entries(groupedMessages).map(([date, msgs]) => (
              <div key={date}>
                <div className="flex items-center justify-center my-3">
                  <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">{date}</span>
                </div>
                {msgs.map(msg => {
                  const isMe = msg.senderRole === "customer" || msg.senderId === (user as { id?: number } | null)?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} mb-2`}>
                      {!isMe && (
                        <div className="w-8 h-8 bg-[#F0185A] rounded-full flex items-center justify-center mr-2 flex-shrink-0 self-end">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                      )}
                      <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>
                        {!isMe && <p className="text-xs text-gray-400 mb-1 ml-1">{msg.senderName}</p>}
                        <div className={`px-4 py-2.5 rounded-2xl text-sm ${isMe ? "bg-[#F0185A] text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>
                          {msg.body}
                        </div>
                        <p className={`text-xs text-gray-400 mt-1 ${isMe ? "text-right" : ""}`}>{formatTime(msg.createdAt)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}

        <form onSubmit={handleSend} className="p-3 border-t border-gray-100 flex gap-2">
          <input
            type="text"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Type your message..."
            disabled={sending}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] transition-colors"
          />
          <button
            type="submit"
            disabled={!body.trim() || sending}
            className="w-10 h-10 bg-[#F0185A] text-white rounded-xl flex items-center justify-center hover:bg-[#c8124a] disabled:bg-gray-200 disabled:text-gray-400 transition-colors flex-shrink-0"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
}
