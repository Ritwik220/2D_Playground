import { useState, useEffect } from "react";
import { io } from "socket.io-client";

interface Message {
    id: number;
    username: string;
    message: string;
    created_at: string;
}

interface ChatUIProps {
    messages: Message[];
    onNewMessage: (message: Message) => void;
}

const socket = io({
    transports: ["websocket"]
});

export default function ChatUI({
    messages,
    onNewMessage
}: ChatUIProps) {
    const [input, setInput] = useState("");
    const [username, setUsername] = useState("");

    useEffect(() => {
        const requestUsername = () => {
            socket.emit("send username");
        };

        const handleChatReady = (name: string) => {
            setUsername(name);
        };

        const handleChatReceived = (data: Message) => {
            onNewMessage(data);
        };

        socket.on("connect", requestUsername);
        socket.on("chat ready", handleChatReady);
        socket.on("chat recieved", handleChatReceived);

        if (socket.connected) {
            requestUsername();
        }

        return () => {
            socket.off("connect", requestUsername);
            socket.off("chat ready", handleChatReady);
            socket.off("chat recieved", handleChatReceived);
        };
    }, [onNewMessage]);

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const inputText = input.trim();

        if (!username || !inputText) return;

        socket.emit("chat message sent", {
            message: inputText,
            username
        });

        setInput("");
    };

    return (
        <div className="flex h-full flex-col min-h-0">
            <div
                id="messages"
                className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-1 mb-2 text-sm custom-scrollbar"
            >
                {messages.map(message => (
                    <div
                        key={message.id}
                        className="leading-relaxed break-words bg-slate-800/50 p-2 rounded"
                    >
                        <strong className="text-blue-400">
                            {message.username}
                        </strong>

                        <span className="text-slate-300">
                            : {message.message}
                        </span>

                        <div className="text-[10px] text-slate-500 mt-0.5">
                            {new Date(message.created_at).toLocaleTimeString()}
                        </div>
                    </div>
                ))}
            </div>

            <form onSubmit={onSubmit}>
                <input
                    id="input"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="Type a message..."
                    maxLength={500}
                />
            </form>
        </div>
    );
}
