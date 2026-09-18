import Phaser from "phaser";
import { EventBus } from "./EventBus";


export default class GameScene extends Phaser.Scene {

    constructor() {
        super("Game Scene");
    }

    preload() {
        this.load.spritesheet(
            "idle_up",
            "/Sprites/IDLE/idle_up.png",
            {
                frameWidth: 96,
                frameHeight: 80,
                endFrame: 7 
            }
        );
    }

    create() {

        this.anims.create({
            key: "idle_up",
            frames: this.anims.generateFrameNumbers("idle_up"),
            frameRate: 4,
            repeat: -1
        });

        const player = this.add.sprite(
            400,
            300,
            "idle_up"
        );

        player.anims.play("idle_up", true);

        EventBus.emit("lol", this);
    }
}
