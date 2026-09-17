import Phaser from "phaser";
import { EventBus } from "./EventBus";

export class GameScene extends Phaser.Scene {
    private score=0;
    constructor() {
        super("Game Scene");
    }

    preload() {
        // Load assets here
    }

    create() {
        // Example interactive text object inside Phaser canvas
        const clickText = this.add.text(100, 100, 'Click me to increase React score!', { color: '#0f0' });
        clickText.setInteractive();

        clickText.on('pointerdown', () => {
            this.score += 10;
            // Emit the event to update React UI
            EventBus.emit('score-updated', this.score);
        });
    }
}
