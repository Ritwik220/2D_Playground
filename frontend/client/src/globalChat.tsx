import { useState } from "react"
import ChatUI from "./ChatUI";


export default function GlobalChat() {
    const [isOpen, setIsOpen] = useState(false);
    const clickButton = () => {
      if(isOpen)
        setIsOpen(true);
      else
        setIsOpen(false);
    }

    return (
        <div id="globalChat" className="flex-column w-2/6 h-screen">
          <div id="globalChatIcon" className="relative w-12 h-12 p-4 bg-blue-600 border border-blue-700 hover:bg-blue-900 transition-colors rounded-lg shadow-sm">
            <button type="button" className="absolute top-2 right-2 p-1 text-gray-400 rounded-md transition-colors" aria-label="Action" onClick={clickButton}>
                <img className="object-cover" src="/global-communication.png"></img>
            </button>
          </div>
          <div id="#globalChatUI">
            {<ChatUI />}
          </div>
        </div>
    )
}

