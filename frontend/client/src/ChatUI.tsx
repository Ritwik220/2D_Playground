import { useState } from "react";
import {io} from "socket.io-client"

interface Message {
    id: number;
    username: string;
    message: string;
    created_at: string;
}

interface ChatUIProps {
    messages: Message[];
}

const socket = io({
            transports: ["websocket"]
});

export default function ChatUI({ messages }: ChatUIProps) {
    const [input, setInput] = useState("");
    const [username, setUsername] = useState("");
    // flip will be multiplied by -1 whenever we want to re run the component
    const [flip, setFlip] = useState(1);
    socket.on("chat ready", (username) => {
        setUsername(username)
    })

    const onSumbit = (e: any) => {
        if(!username) return;
        console.log("on submit entered");
        e.preventDefault();
        if(input != "") {
            socket.emit("chat message sent", {message: input, username: username});
            setInput("");
        }
    }
    socket.on("chat recieved", (message, username, created_at, id) => {
        const mes_obj: Message = {
            id: id,
            username: username,
            message: message,
            created_at: created_at
        }
        messages.push(mes_obj);
        setFlip(flip * -1);
    })

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
            <form onSubmit={onSumbit}>
            <input
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a message..."
            />
            </form>
        </div>
    );
}