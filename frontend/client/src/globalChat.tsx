import { useState, useEffect } from "react";
import ChatUI from "./ChatUI";

interface Message {
    id: number;
    username: string;
    message: string;
    created_at: string;
}

export default function GlobalChat() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [messagesLoaded, setMessagesLoaded] = useState(true);
    const [numberLoaded, setNumberLoaded] = useState(0);
    const [isOpen, setIsOpen] = useState(false);

    const clickButton = () => {
        setIsOpen(!isOpen);
    };

    const loadMessages = async (offset: number) => {
        try {
            const response = await fetch(
                `/api/global/chats/${offset}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                }
            );

            if (response.ok) {
                const data: Message[] = await response.json();

                setMessages((prev) => [...prev, ...data]);
                setNumberLoaded(offset + data.length);
                setMessagesLoaded(true);
            } else {
                setMessagesLoaded(false);
            }
        } catch (err) {
            console.error(err);
            setMessagesLoaded(false);
        }
    };

    useEffect(() => {
        loadMessages(0);
    }, []);

    return (
        // Changed `h-screen` to a flex layout with drop shadows and rounded corners
        <div id="globalChat" className="flex flex-col max-h-inherit bg-slate-900/90 text-white rounded-xl shadow-2xl border border-slate-700 backdrop-blur-md overflow-hidden">
            
            {/* Header / Toggle area */}
            <div
                id="globalChatIcon"
                className="relative flex items-center justify-between h-12 px-4 bg-slate-800 border-b border-slate-700"
            >
                <span className="font-semibold text-sm">Global Chat</span>
                <button
                    type="button"
                    className="p-1 hover:bg-slate-700 rounded-md transition-colors"
                    aria-label="Toggle global chat"
                    onClick={clickButton}
                >
                    <img
                        className="w-6 h-6 object-cover invert" // added invert if your icon is dark
                        src="/global-communication.png"
                        alt="Global chat"
                    />
                </button>
            </div>

            {/* Chat Body expands when open */}
            {isOpen && (
                <div id="globalChatUI" className="flex flex-col flex-1 min-h-0 p-3 space-y-2 max-h-[50vh]">
                    {messagesLoaded ? (
                        <>
                            <ChatUI messages={messages} />
                            <button
                                type="button"
                                className="text-xs text-blue-400 hover:text-blue-300 text-left pt-1"
                                onClick={() => loadMessages(numberLoaded)}
                            >
                                ↑ Load older messages
                            </button>
                        </>
                    ) : (
                        <p className="text-sm text-red-400">Failed to load messages.</p>
                    )}
                </div>
            )}
        </div>
    );
}