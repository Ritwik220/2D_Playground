import Phaser from "phaser";
import { EventBus } from "./EventBus";
import { Socket, io } from "socket.io-client";


export default class GameScene extends Phaser.Scene {
    private direction = "up";
    private prevState = "idle";
    private stateChanged = false;
    private socket!: Socket;
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
    private otherPlayers = new Map<
        string,
        Phaser.GameObjects.Sprite
    >();

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
        this.socket = io("http://localhost:3001");
        this.socket.on("players", (players) => {
            players.forEach((player:any) => {

            if (player.id === this.socket.id) return;

            const sprite = this.add.sprite(
                player.x,
                player.y,
                "idle_up"
            );

            this.otherPlayers.set(player.id, sprite);
            });
        });
        this.socket.on("player_joined", (player) => {
            const sprite = this.add.sprite(
                player.x,
                player.y,
                "idle_up"
            );
            this.otherPlayers.set(player.id, sprite);
        });
        this.socket.on("player_moved", (player) => {

            const sprite = this.otherPlayers.get(player.id);

                if (!sprite) return;

                sprite.setPosition(player.x, player.y);

                sprite.anims.play(
                    `${player.action}_${player.direction}`,
                    true
                );

        });
        this.socket.on("player_left", (id) => {

            const sprite = this.otherPlayers.get(id);

            if (!sprite) return;

            sprite.destroy();

            this.otherPlayers.delete(id);

        });
        this.Actions.forEach((action:string, index:number) => {
            this.directions.forEach((dir:string, index:number) => {
                this.anims.create({
                    key: `${action}_${dir}`,
                    frames: this.anims.generateFrameNumbers(`${action}_${dir}`),
                    frameRate: 15,
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
        var moveX:number, moveY:number;
        moveX = moveY = 0;
        const speed = 100;
        if(this.keys.W.isDown) {
            moveY = -1;
            this.action = "run";
            this.direction = "up";
        }
        else if(this.keys.S.isDown) {
            moveY = 1;
            this.action = "run";
            this.direction = "down";
        }
        else if(this.keys.A.isDown) {
            moveX = -1;
            this.action = "run";
            this.direction = "left";
        }
        else if(this.keys.D.isDown) {
            moveX = 1;
            this.action = "run";
            this.direction = "right";
        }
        else {
            this.action = "idle"
        }
        if(this.prevState !== this.action) {
            this.prevState = this.action;
            this.stateChanged = true;
        }
        this.player.x += moveX * speed * delta / 1000;
        this.player.y += moveY * speed * delta / 1000;
        if(this.stateChanged) {
            this.socket.emit("player_move", {
                x: this.player.x,
                y: this.player.y,
                direction: this.direction,
                action: this.action
            });
        }
        this.stateChanged = false;
        this.player.anims.play(`${this.action}_${this.direction}`, true);
        
    }
}
