import {useRef, useEffect} from "react";
import Phaser from "phaser";
import GameScene from "./GameScene";


export default function PhaserGame() {
    const gameRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const config: Phaser.Types.Core.GameConfig = {
            type: Phaser.AUTO,

            width: 800,
            height: 600,

            parent: gameRef.current!,
            physics: {
                default: "arcade",
                arcade: {
                    gravity: { x: 0, y: 0 }, // Top-down games generally use 0 gravity
                    debug: false             // Toggle to true to see bounding boxes
                }
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
