import PrivateChatUI from "./privateChatUI";
import { useState, useEffect } from "react";
import { socket } from "./Socket";




export default function PrivateChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [otherDisplayName, setOtherDisplayName] = useState("");
    const [username, setUsername] = useState("");
    const [otherUsername, setOtherUsername] = useState("");
    const [id, setId] = useState(-1);
    const [otherId, setOtherId] = useState(-1);

    useEffect(() => {
        const handleHandshakeAccepted = async (
            other_id: number,
            player_id: number
        ) => {
            console.log("chat handshake accepted");
            try {
                const [response1, response2] = await Promise.all([
                    fetch(`/api/users/${player_id}`, {
                        credentials: "include",
                    }),
                    fetch(`/api/users/${other_id}`, {
                        credentials: "include",
                    }),
                ]);

                if (!response1.ok || !response2.ok) {
                    console.error("Failed loading user data for chat");
                    return;
                }

                const [data1, data2] = await Promise.all([
                    response1.json(),
                    response2.json(),
                ]);

                setUsername(data1.user_name);
                setOtherUsername(data2.user_name);
                setDisplayName(data1.display_name);
                setOtherDisplayName(data2.display_name);
                setId(Number(data1.id));
                setOtherId(Number(data2.id));
                setIsOpen(true);
            } catch (err) {
                console.error("Error getting users:", err);
            }
        };

        socket.on("chat_handshake_accepted", handleHandshakeAccepted);

        return () => {
            socket.off("chat_handshake_accepted", handleHandshakeAccepted);
        };
    }, []);

    const return_val = () => {
        if(isOpen)
            return <PrivateChatUI display_name={displayName} other_display_name={otherDisplayName} username={username} other_username={otherUsername} id={id} other_id={otherId} onClose={() => setIsOpen(false)}/>;
        else
            return;
    }
    return (
        <div>
            {return_val()};
        </div>
    )
}
