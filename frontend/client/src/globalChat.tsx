import { useState, useEffect, useCallback } from "react";
import ChatUI from "./ChatUI";

interface Message {
    id: number;
    username: string;
    message: string;
    created_at: string;
}

export default function GlobalChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [messagesLoaded, setMessagesLoaded] = useState(false);
    const [numberLoaded, setNumberLoaded] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [loadingOlder, setLoadingOlder] = useState(false);
    const [hasMoreMessages, setHasMoreMessages] = useState(true);

    const clickButton = () => {
        setIsOpen(prev => !prev);
    };

    const handleNewMessage = useCallback((message: Message) => {
        setMessages(prev => {
            const updated = prev.some(m => m.id === message.id)
                ? prev
                : [...prev, message];

            return updated.sort(
                (a, b) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime()
            );
        });
    }, []);

    const loadMessages = useCallback(async (offset: number) => {
        if (loadingOlder && offset !== 0) return;

        if (offset !== 0) {
            setLoadingOlder(true);
        }

        try {
            const response = await fetch(
                `/api/global/messages/${offset}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                }
            );

            if (!response.ok) {
                throw new Error(`Failed to load messages: ${response.status}`);
            }

            const data: Message[] = (await response.json()).reverse();

            setMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                const newMessages = data.filter(m => !existingIds.has(m.id));

                return offset === 0
                    ? [...newMessages, ...prev]
                    : [...newMessages, ...prev];
            });

            setNumberLoaded(offset + data.length);
            setHasMoreMessages(data.length === 10);
            setMessagesLoaded(true);
        } catch (error) {
            console.error("Error loading global messages:", error);
        } finally {
            setMessagesLoaded(true);
            setLoadingOlder(false);
        }
    }, [loadingOlder]);

    useEffect(() => {
        loadMessages(0);
    }, [loadMessages]);

    return (
        <div
            id="globalChat"
            className="flex flex-col max-h-inherit bg-slate-900/90 text-white rounded-xl shadow-2xl border border-slate-700 backdrop-blur-md overflow-hidden"
        >
            <div
                id="globalChatIcon"
                className="relative flex items-center justify-between h-12 px-4 bg-slate-800 border-b border-slate-700"
            >
                <span className="font-semibold text-sm">Global Chat</span>

                <button
                    type="button"
                    className="p-1 hover:bg-slate-700 rounded-md transition-colors"
                    aria-label="Toggle global chat"
                    aria-expanded={isOpen}
                    onClick={clickButton}
                >
                    <img
                        className="w-6 h-6 object-cover invert"
                        src="/global-communication.png"
                        alt="Global chat"
                    />
                </button>
            </div>

            {isOpen && (
                <div
                    id="globalChatUI"
                    className="flex flex-col flex-1 min-h-0 p-3 space-y-2 max-h-[50vh]"
                >
                    {messagesLoaded ? (
                        <>
                            <ChatUI
                                messages={messages}
                                onNewMessage={handleNewMessage}
                            />

                            {hasMoreMessages && (
                                <button
                                    type="button"
                                    className="text-xs text-blue-400 hover:text-blue-300 text-left pt-1 disabled:opacity-50"
                                    disabled={loadingOlder}
                                    onClick={() => loadMessages(numberLoaded)}
                                >
                                    {loadingOlder
                                        ? "Loading..."
                                        : "↑ Load older messages"}
                                </button>
                            )}
                        </>
                    ) : (
                        <p className="text-sm text-slate-400">
                            Loading messages...
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}
