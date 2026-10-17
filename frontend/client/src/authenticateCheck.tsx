import { useEffect, useState } from "react";
import PhaserGame from "./PhaserGame";
// import LoginCard from "./loginCard";
import { useNavigate } from "react-router-dom";
import GlobalChat from "./globalChat";
import AudioToggle from "./audioToggle";
import PrivateChat from "./privateChat";


const url = import.meta.env.VITE_BACKEND_URL  || "http://localhost:3000/";

export default function AuthCheck() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {

        async function checkAuth() {

            try {

                const response = await fetch(
                    url + "auth/me",
                    {
                        credentials: "include"
                    }
                );

                if (response.ok) {
                    setAuthenticated(true);
                }
                else {
                    setAuthenticated(false);
                }

            } catch (err) {
                console.error(err);
                setAuthenticated(false);
            }

            setLoading(false);
        }

        checkAuth();

    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    // AuthCheck.tsx
    if (authenticated) {
        return (
        <div className="relative w-screen h-screen overflow-hidden bg-black">
            
            {/* The Game serves as the background canvas layer */}
            <PhaserGame />
            
            {/* The Chat layer floats pinned to a corner above it */}
            <div className="absolute top-4 right-4 z-50 w-80 max-h-[80vh] flex flex-col">
                <GlobalChat />
            </div>
            <div className="absolute top-4 left-4 z-50 w-80 max-h-[80vh] flex flex-col">
                <PrivateChat/>
            </div>
            <AudioToggle />

        </div>
        );
    }

    navigate("/login", {replace: true});
}