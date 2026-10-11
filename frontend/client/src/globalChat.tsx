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
        <div id="globalChat" className="flex flex-col w-2/6 h-screen">
            <div
                id="globalChatIcon"
                className="relative w-12 h-12 p-4 bg-blue-600 border border-blue-700 hover:bg-blue-900 transition-colors rounded-lg shadow-sm"
            >
                <button
                    type="button"
                    className="absolute top-2 right-2 p-1 text-gray-400 rounded-md transition-colors"
                    aria-label="Toggle global chat"
                    onClick={clickButton}
                >
                    <img
                        className="object-cover"
                        src="/global-communication.png"
                        alt="Global chat"
                    />
                </button>
            </div>

            {isOpen && (
                <div id="globalChatUI" className="flex-1 min-h-0">
                    {messagesLoaded ? (
                        <>
                            <ChatUI messages={messages} />
                            <button
                                type="button"
                                onClick={() => loadMessages(numberLoaded)}
                            >
                                Load more
                            </button>
                        </>
                    ) : (
                        <p>Failed to load messages.</p>
                    )}
                </div>
            )}
        </div>
    );
}