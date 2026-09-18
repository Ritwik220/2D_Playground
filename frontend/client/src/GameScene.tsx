import Phaser from "phaser";
import { EventBus } from "./EventBus";


export default class GameScene extends Phaser.Scene {
    private direction = "up";
    private action = "idle";
    private player!:Phaser.GameObjects.Sprite;
    private keys!: {
        W: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
    };
    private Actions = ['idle', 'run', 'attack1', 'attack2'];
    private directions = ['up', 'down', 'left', 'right'];

    constructor() {
        super("Game Scene");
    }

    preload() {
        this.keys = this.input.keyboard!.addKeys("W,A,S,D") as typeof this.keys;
        this.Actions.forEach((action:string, index:number) => {
            this.directions.forEach((dir:string, index:number) => {
                this.load.spritesheet(
                    `${action}_${dir}`,
                    `/Sprites/${action}/${action}_${dir}.png`,
                    {
                        frameWidth: 96,
                        frameHeight: 80,
                        endFrame: 7 
                    }
                );
            } )
        })
        
    }

    create() {
        this.Actions.forEach((action:string, index:number) => {
            this.directions.forEach((dir:string, index:number) => {
                this.anims.create({
                    key: `${action}_${dir}`,
                    frames: this.anims.generateFrameNumbers(`${action}_${dir}`),
                    frameRate: 10,
                    repeat: -1
                });
        
            } )
        })

        

        this.player = this.add.sprite(
            400,
            300,
            "idle_up"
        );

        this.player.anims.play("idle_up", true);

        EventBus.emit("lol", this);
    }

    update(time:number, delta:number) {
        const speed = 100;
        if(this.keys.W.isDown) {
            this.player.y -= speed * delta / 1000;
            this.action = "run";
            this.direction = "up";
        }
        else if(this.keys.S.isDown) {
            this.player.y += speed * delta / 1000;
            this.action = "run";
            this.direction = "down";
        }
        else if(this.keys.A.isDown) {
            this.player.x -= speed * delta / 1000;
            this.action = "run";
            this.direction = "left";
        }
        else if(this.keys.D.isDown) {
            this.player.x += speed * delta / 1000;
            this.action = "run";
            this.direction = "right";
        }
        else {
            this.action = "idle"
        }
        this.player.anims.play(`${this.action}_${this.direction}`, true);
    }
}
