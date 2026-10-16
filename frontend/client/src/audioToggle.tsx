import { socket } from "./Socket";
import { useState } from "react";

export default function AudioToggle() {
    const [isChecked, setIsChecked] = useState(false);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const checked = event.target.checked;

        setIsChecked(checked);
        socket.emit(checked ? "Microphone on" : "Microphone off");
    };

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
            <label className="inline-flex items-center cursor-pointer">
                {/* Keep your existing SVG icons here */}

                <input
                    type="checkbox"
                    checked={isChecked}
                    className="sr-only peer"
                    onChange={handleChange}
                />

                {/* Keep your existing toggle styling here */}
            </label>
        </div>
    );
}