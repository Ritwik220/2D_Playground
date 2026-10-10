


export default function globalChat() {
    return (
        <div id="globalChat">
          <div id="globalChatIcon" className="relative w-32 h-32 p-4 bg-blue-600 border border-blue-900 rounded-lg shadow-sm">
            <button type="button" className="absolute top-2 right-2 p-1 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors" aria-label="Action">
                <img className="object-cover" src="/global-communication.png"></img>
            </button>
          </div>
          <div id="#globalChatUI"></div>
        </div>
    )
}

