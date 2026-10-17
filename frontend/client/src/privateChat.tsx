import PrivateChatUI from "./privateChatUI";
import { useState } from "react";
import { socket } from "./Socket";




export default function PrivateChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [displayName, setDisplayName] = useState("");
    const [otherDisplayName, setOtherDisplayName] = useState("");
    const [username, setUsername] = useState("");
    const [otherUsername, setOtherUsername] = useState("");
    const [id, setId] = useState(-1);
    const [otherId, setOtherId] = useState(-1);

    socket.on("chat_handshake_accepted", async (other_id, player_id) => {
        try {
            const response1 = await fetch(`/api/users/${player_id}`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                }) 
            const response2 = await fetch(`/api/users/${other_id}`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                });
            setIsOpen(true);
            if(!response1.ok || !response2.ok) {
                console.log("Failed loading user data for chat");
                return;
            }
            const data1 = await response1.json();
            const data2 = await response2.json();
            setUsername(data1.user_name);
            setOtherUsername(data2.user_name);
            setDisplayName(data1.display_name);
            setOtherDisplayName(data2.display_name);
            setId(data1.id);
            setOtherId(data2.id);
        }
        catch(err) {
            console.error("Error to get users: ", err);
        }
    })
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
