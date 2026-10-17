
import { useState, useEffect } from "react";
import { socket } from "./Socket";

interface Message {
    id: number;
    username: string;
    message: string;
    created_at: string;
    sender_id: number;
    receiver_id: number;
}

interface PrivateChatProps {
    display_name: string;
    other_display_name: string;
    username: string;
    other_username: string;
    id: number;
    other_id: number;
    onClose: () => void;
}

export default  function PrivateChatUI({
    display_name,
    other_display_name,
    username,
    other_username,
    id,
    other_id,
    onClose
}: PrivateChatProps) {
    console.log(display_name);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Message[]>([]);

    useEffect(() => {
        let cancelled = false;

        async function loadMessages() {
            try {
                const response = await fetch(
                    `/api/chats/${id}/${other_id}`,
                    { credentials: "include" }
                );

                if (response.status === 404) {
                    if (!cancelled) setMessages([]);
                    return;
                }

                if (!response.ok) {
                    throw new Error("Failed to load chat history");
                }

                const data: Message[] = await response.json();

                if (!cancelled) setMessages(data);
            } catch (err) {
                console.error("Failed to load chat history:", err);
            }
        }

        setMessages([]);
        loadMessages();

        const handleMessage = (message: Message) => {
            const belongsToChat =
                (message.sender_id === id &&
                    message.receiver_id === other_id) ||
                (message.sender_id === other_id &&
                    message.receiver_id === id);

            if (belongsToChat) {
                setMessages(prev => [...prev, message]);
            }
        };

        socket.on("private_chat_message", handleMessage);

        return () => {
            cancelled = true;
            socket.off("private_chat_message", handleMessage);
        };
    }, [id, other_id]);

    const onSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();

        const inputText = input.trim();
        if (!username || !inputText) return;

        socket.emit("private_chat_message_sent", {
            message: inputText,
            sender_id: id,
            receiver_id: other_id,
        });

        setInput("");
    };

    return (
        <div className="flex h-full min-h-0 flex-col overflow-hidden
                        rounded-2xl border border-slate-700/70
                        bg-slate-950 text-slate-100 shadow-2xl">

            {/* Header */}
            <header className="flex items-center gap-3 border-b
                               border-slate-800 bg-slate-900/90
                               px-4 py-3">
                <div className="relative flex h-11 w-11 shrink-0
                                items-center justify-center rounded-full
                                bg-gradient-to-br from-indigo-500
                                to-violet-600 text-lg font-bold
                                shadow-lg shadow-indigo-950/40">
                    {other_display_name?.charAt(0)?.toUpperCase() || "?"}

                    <span className="absolute bottom-0 right-0 h-3 w-3
                                     rounded-full border-2 border-slate-900
                                     bg-emerald-400" />
                </div>

                <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-semibold
                                   tracking-wide text-white">
                        {other_display_name || other_username}
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-400">
                        @{other_username}
                    </p>
                </div>

                <div className="rounded-lg border border-indigo-400/20
                                bg-indigo-500/10 px-2.5 py-1.5
                                text-[10px] font-semibold uppercase
                                tracking-widest text-indigo-300">
                    Direct
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close private chat"
                    className="flex h-9 w-9 shrink-0 items-center justify-center
                            rounded-lg text-slate-400 transition-colors
                            hover:bg-slate-800 hover:text-white"
                >
                    ✕
                </button>
            </header>

            {/* Conversation */}
            <div
                id="messages"
                className="flex min-h-0 flex-1 flex-col gap-4
                           overflow-y-auto bg-slate-950 px-4 py-5
                           custom-scrollbar"
            >
                {messages.length === 0 ? (
                    <div className="m-auto flex max-w-56 flex-col
                                    items-center text-center">
                        <div className="mb-4 flex h-16 w-16
                                        items-center justify-center
                                        rounded-2xl border border-slate-800
                                        bg-slate-900 text-3xl">
                            <span>✦</span>
                        </div>

                        <h3 className="text-sm font-semibold text-slate-200">
                            Your conversation starts here
                        </h3>

                        <p className="mt-2 text-xs leading-relaxed
                                      text-slate-500">
                            Send a message to {other_display_name || other_username}
                            {" "}and say hello!
                        </p>
                    </div>
                ) : (
                    messages.map((message) => {
                        const isMine = message.sender_id === id;

                        return (
                            <div
                                key={message.id}
                                className={`flex w-full ${
                                    isMine ? "justify-end" : "justify-start"
                                }`}
                            >
                                <div className={`flex max-w-[85%] flex-col
                                                gap-1 ${
                                    isMine ? "items-end" : "items-start"
                                }`}>
                                    <span className="px-1 text-[10px]
                                                     font-medium text-slate-500">
                                        {isMine ? "You" : message.username}
                                    </span>

                                    <div className={`rounded-2xl px-3.5 py-2.5
                                                     text-sm leading-relaxed
                                                     break-words ${
                                        isMine
                                            ? "rounded-br-sm bg-indigo-600 text-white"
                                            : "rounded-bl-sm border border-slate-700/60 bg-slate-800 text-slate-200"
                                    }`}>
                                        {message.message}
                                    </div>

                                    <span className="px-1 text-[10px]
                                                     text-slate-600">
                                        {new Date(
                                            message.created_at
                                        ).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Composer */}
            <div className="border-t border-slate-800 bg-slate-900/80 p-3">
                <form
                    onSubmit={onSubmit}
                    className="flex items-end gap-2 rounded-xl
                               border border-slate-700/80 bg-slate-950
                               p-1.5 transition-colors
                               focus-within:border-indigo-500/70
                               focus-within:ring-2
                               focus-within:ring-indigo-500/10"
                >
                    <textarea
                        id="input"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            e.stopPropagation();

                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                e.currentTarget.form?.requestSubmit();
                            }
                        }}
                        placeholder="Message..."
                        maxLength={500}
                        rows={1}
                        className="max-h-28 min-h-10 flex-1 resize-y
                                   bg-transparent px-2.5 py-2.5 text-sm
                                   text-white placeholder-slate-600
                                   outline-none"
                    />

                    <button
                        type="submit"
                        disabled={!input.trim()}
                        aria-label="Send message"
                        className="mb-0.5 flex h-9 w-9 shrink-0
                                   items-center justify-center rounded-lg
                                   bg-indigo-600 text-white
                                   transition-all hover:bg-indigo-500
                                   active:scale-95 disabled:cursor-not-allowed
                                   disabled:bg-slate-800
                                   disabled:text-slate-600"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="h-4 w-4"
                        >
                            <path d="M22 2 11 13" />
                            <path d="m22 2-7 20-4-9-9-4Z" />
                        </svg>
                    </button>
                </form>

                <div className="flex items-center justify-between px-1 pt-2">
                    <span className="text-[10px] text-slate-600">
                        Enter to send · Shift + Enter for a new line
                    </span>
                    <span className="text-[10px] tabular-nums text-slate-600">
                        {input.length}/500
                    </span>
                </div>
            </div>
        </div>
    );
}
