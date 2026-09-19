import Phaser from "phaser";
import { EventBus } from "./EventBus";
import { Socket, io } from "socket.io-client";


export default class GameScene extends Phaser.Scene {
    private peerConnections = new Map<string, RTCPeerConnection>();
    private localStream!: MediaStream;
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

    async createOffer(peer_id:string) {
        const peer = new RTCPeerConnection({
            iceServers: [
                { urls: "stun:stun.l.google.com:19302" }
            ]
        });
        this.peerConnections.set(peer_id, peer);
        this.localStream.getTracks().forEach((track) => {
            peer.addTrack(track);
        })
        peer.onicecandidate = (event) => {
            if(event.candidate) {
                this.socket.emit("voice_ice_candidate", {
                    target: peer_id,
                    candidate: event.candidate
                });
            }
        }

        peer.ontrack = (event) => {
            const audio = new Audio();
            audio.srcObject = event.streams[0];
            audio.play();
        }
        const offer = await peer.createOffer();

        await peer.setLocalDescription(offer);

        this.socket.emit("voice_offer", {
            target: peer_id,
            offer
        });
    }

    constructor() {
        super("Game Scene");
    }

    preload() {
        this.keys = this.input.keyboard!.addKeys("W,A,S,D") as typeof this.keys;
        this.Actions.forEach((action:string) => {
            this.directions.forEach((dir:string) => {
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

    async create() {
        this.socket = io();
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
        this.Actions.forEach((action:string) => {
            this.directions.forEach((dir:string) => {
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

        this.socket.on("voice_offer", async ({sender, offer})  => {
            const peer = new RTCPeerConnection({
                iceServers: [
                    { urls: "stun:stun.l.google.com:19302" }
                ]
            });
            this.peerConnections.set(sender, peer);
            this.localStream.getTracks().forEach((track) => {
                peer.addTrack(track);
            })
            peer.onicecandidate = (event) => {
                if(event.candidate) {
                    this.socket.emit("voice_ice_candidate", {
                        target: sender,
                        candidate: event.candidate
                    });
                }
            }

            peer.ontrack = (event) => {
                const audio = new Audio();
                audio.srcObject = event.streams[0];
                audio.play();
            }

            await peer.setRemoteDescription(offer);
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);

            this.socket.emit("voice_answer", {
                target: sender,
                answer
            })

        })

        this.socket.on("voice_answer", async ({sender, answer}) => {
            const peer = this.peerConnections.get(sender);
            if(!peer) return;
            await peer.setRemoteDescription(answer);
        })

        this.socket.on("voiced_peer_joined", async (peer_id) => {
            console.log("New voice peer: ", peer_id);
            await this.createOffer(peer_id);
        })
        this.socket.on("voice_ice_candidate", async ({sender, candidate}) => {
            const peer = this.peerConnections.get(sender);
            if (!peer) return;
            await peer.addIceCandidate(candidate);
        })
        const stream = await navigator.mediaDevices.getUserMedia({audio: true})
        this.localStream = stream;
        EventBus.emit("lol", this);
    }

    update(_time:number, delta:number) {
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
