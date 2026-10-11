import { useState } from "react"
import ChatUI from "./ChatUI";


export default async function GlobalChat() {
    const [messages, setMessages] = useState({});
    const [messagesLoaded, setMessagesLoaded] = useState(true);
    const [numberLoaded, setNumberLoaded] = useState(0);
    
    const [isOpen, setIsOpen] = useState(false);
    const clickButton = () => {
      if(isOpen)
        setIsOpen(true);
      else
        setIsOpen(false);
    }
    try{
      const response = await fetch(`api/global/chats/{numberLoaded}`, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json" // Readies the server for json data
                },
                credentials: "include",
            });
      if(response.ok) {
        setMessagesLoaded(true);
        setMessages(response.json())
        setNumberLoaded(numberLoaded+10);
      }
      else {
        setMessagesLoaded(false);
      }
    }
    catch(err) {
      setMessagesLoaded(false);
    }

    return (
        <div id="globalChat" className="flex-column w-2/6 h-screen">
          <div id="globalChatIcon" className="relative w-12 h-12 p-4 bg-blue-600 border border-blue-700 hover:bg-blue-900 transition-colors rounded-lg shadow-sm">
            <button type="button" className="absolute top-2 right-2 p-1 text-gray-400 rounded-md transition-colors" aria-label="Action" onClick={clickButton}>
                <img className="object-cover" src="/global-communication.png"></img>
            </button>
          </div>
          <div id="#globalChatUI">
            {messagesLoaded?<ChatUI messages={messages}/>:<p>404</p>}
          </div>
        </div>
    )
}

