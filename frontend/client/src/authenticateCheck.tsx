import { useEffect, useState } from "react";
import PhaserGame from "./PhaserGame";
import LoginCard from "./loginCard";

export default function AuthCheck() {

    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);

    useEffect(() => {

        async function checkAuth() {

            try {

                const response = await fetch(
                    "http://localhost:3000/auth/me",
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

    if (authenticated) {
        return <PhaserGame />;
    }

    return <LoginCard />;
}