import { useState } from "react";

// interface Message {
//     id: number;
//     username: string;
//     message: string;
//     created_at: string;
// }

interface ChatUIProps {
    messages: Object;
}

export default function ChatUI({ messages }: ChatUIProps) {
    const [input, setInput] = useState("");

    return (
        <div className="flex h-full flex-col">
            <div
                id="messages"
                className="min-h-0 flex-1 overflow-y-auto"
            >
                {messages.map((message) => (
                    <div key={message.id}>
                        {message.username}: '{message.message}' at{" "}
                        {message.created_at}
                    </div>
                ))}
            </div>

            <input
                className="w-full rounded border p-2"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
            />
        </div>
    );
}
