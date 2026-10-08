import {useRef, useEffect} from "react";
import Phaser from "phaser";
import GameScene from "./GameScene";
// import { useNavigate } from "react-router-dom";

// const url = "http://localhost:3000";

export default function PhaserGame() {
    // const navigate = useNavigate();
    // if(!props.authenticated) {
    //     navigate("/login", {replace: true});
    // }

    const gameRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,

            width: window.innerWidth,
            height: window.innerHeight,

            parent: gameRef.current!,
            physics: {
                default: "arcade",
                arcade: {
                    gravity: { x: 0, y: 0 }, // Top-down games generally use 0 gravity
                    debug: false             // Toggle to true to see bounding boxes
                }
            },
            scale: {
                mode: Phaser.Scale.RESIZE,
                autoCenter: Phaser.Scale.CENTER_BOTH
            },
            scene: GameScene,

        };

        const game = new Phaser.Game(config);
        return () => {
            game.destroy(true);
        }

    }, []);
    return <div ref={gameRef}/>

}
