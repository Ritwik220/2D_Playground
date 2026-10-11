


export default function ChatUI(props:any) {
    const messages = props.messages;
    return (
        <div>
        <div id="messages" className="h-9/12">
            {messages.map((message:any, index:integer) => (
                <div>{message.username}: '{message.message}' at {message.created_at}</div>
            ))}
        </div>
        <input className="h-9/12"></input>
        </div>
    )
}
