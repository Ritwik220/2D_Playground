import { useState } from "react";

interface Message {
    id: number;
    username: string;
    message: string;
    created_at: string;
}

interface ChatUIProps {
    messages: Message[];
}

export default function ChatUI({ messages }: ChatUIProps) {
    const [input, setInput] = useState("");

    return (
        <div className="flex h-full flex-col min-h-0">
            {/* Scrolling Messages container */}
            <div
                id="messages"
                className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-1 mb-2 text-sm custom-scrollbar"
            >
                {messages.map((message) => (
                    <div key={message.id} className="leading-relaxed break-words bg-slate-800/50 p-2 rounded">
                        <strong className="text-blue-400">{message.username}</strong>
                        <span className="text-slate-300">: {message.message}</span>
                        <div className="text-[10px] text-slate-500 mt-0.5">{new Date(message.created_at).toLocaleTimeString()}</div>
                    </div>
                ))}
            </div>

            {/* Input Element */}
            <input
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
            />
        </div>
    );
}