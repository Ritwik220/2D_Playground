import Phaser from "phaser";
import { EventBus } from "./EventBus";
import { Socket, io } from "socket.io-client";

const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    {
        urls: "turn:standard.relay.metered.ca:80",
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_PASSWORD
    }
];

export default class GameScene extends Phaser.Scene {
    private peerConnections = new Map<string, RTCPeerConnection>();
    private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
    private localStream!: MediaStream;
    private direction = "up";
    private prevState = "idle";
    private stateChanged = false;
    private socket!: Socket;
    private action = "idle";
    private player!: Phaser.GameObjects.Sprite;
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

    // Creates a peer connection with the shared config, common event
    // wiring (ICE candidates, remote tracks) and candidate queuing.
    private createPeerConnection(peer_id: string): RTCPeerConnection {
        const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        this.peerConnections.set(peer_id, peer);

        this.localStream.getTracks().forEach((track) => {
            peer.addTrack(track, this.localStream);
        });

        peer.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit("voice_ice_candidate", {
                    target: peer_id,
                    candidate: event.candidate
                });
            }
        };

        peer.ontrack = (event) => {
            const audio = new Audio();
            audio.srcObject = event.streams[0];
            audio.play().catch((err) => {
                console.error(`Failed to play audio from ${peer_id}:`, err);
            });
        };

        peer.onconnectionstatechange = () => {
            console.log(`Peer ${peer_id} connection state:`, peer.connectionState);
            if (peer.connectionState === "failed" || peer.connectionState === "closed") {
                this.cleanupPeer(peer_id);
            }
        };

        return peer;
    }

    private cleanupPeer(peer_id: string) {
        const peer = this.peerConnections.get(peer_id);
        if (peer) {
            peer.close();
            this.peerConnections.delete(peer_id);
        }
        this.pendingCandidates.delete(peer_id);
    }

    private async flushPendingCandidates(peer_id: string, peer: RTCPeerConnection) {
        const queued = this.pendingCandidates.get(peer_id);
        if (!queued || queued.length === 0) return;

        for (const candidate of queued) {
            try {
                await peer.addIceCandidate(candidate);
            } catch (err) {
                console.error(`Failed to add queued ICE candidate for ${peer_id}:`, err);
            }
        }
        this.pendingCandidates.delete(peer_id);
    }

    async createOffer(peer_id: string) {
        try {
            const peer = this.createPeerConnection(peer_id);
            const offer = await peer.createOffer();
            await peer.setLocalDescription(offer);

            this.socket.emit("voice_offer", {
                target: peer_id,
                offer
            });
        } catch (err) {
            console.error(`Failed to create offer for ${peer_id}:`, err);
        }
    }

    preload() {
        this.keys = this.input.keyboard!.addKeys("W,A,S,D") as typeof this.keys;
        this.Actions.forEach((action: string) => {
            this.directions.forEach((dir: string) => {
                this.load.spritesheet(
                    `${action}_${dir}`,
                    `/Sprites/${action}/${action}_${dir}.png`,
                    {
                        frameWidth: 96,
                        frameHeight: 80,
                        endFrame: 7
                    }
                );
            })
        })

    }

    async create() {
        this.socket = io({
            transports: ["websocket"]
        });

        this.socket.on("players", (players) => {
            players.forEach((player: any) => {

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

            sprite.setData("targetX", player.x);
            sprite.setData("targetY", player.y);

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
            this.cleanupPeer(id);

        });
        this.Actions.forEach((action: string) => {
            this.directions.forEach((dir: string) => {
                this.anims.create({
                    key: `${action}_${dir}`,
                    frames: this.anims.generateFrameNumbers(`${action}_${dir}`),
                    frameRate: 15,
                    repeat: -1
                });

            })
        })



        this.player = this.add.sprite(
            400,
            300,
            "idle_up"
        );

        this.player.anims.play("idle_up", true);

        // --- Voice signaling ---

        // Server tells us who's already voice-ready when we announce readiness.
        // We are guaranteed to have localStream by the time this fires, and so
        // is every peer in the list, so it's safe to offer to all of them.
        this.socket.on("voice_ready_peers", async (peerIds: string[]) => {
            for (const peer_id of peerIds) {
                await this.createOffer(peer_id);
            }
        });

        this.socket.on("voice_offer", async ({ sender, offer }) => {
            try {
                const peer = this.createPeerConnection(sender);
                await peer.setRemoteDescription(offer);
                await this.flushPendingCandidates(sender, peer);

                const answer = await peer.createAnswer();
                await peer.setLocalDescription(answer);

                this.socket.emit("voice_answer", {
                    target: sender,
                    answer
                });
            } catch (err) {
                console.error(`Failed to handle voice_offer from ${sender}:`, err);
            }
        });

        this.socket.on("voice_answer", async ({ sender, answer }) => {
            try {
                const peer = this.peerConnections.get(sender);
                if (!peer) return;
                await peer.setRemoteDescription(answer);
                await this.flushPendingCandidates(sender, peer);
            } catch (err) {
                console.error(`Failed to handle voice_answer from ${sender}:`, err);
            }
        });

        this.socket.on("voice_ice_candidate", async ({ sender, candidate }) => {
            const peer = this.peerConnections.get(sender);

            // If we don't have a peer connection yet, or its remote description
            // isn't set, queue the candidate instead of dropping it.
            if (!peer || !peer.remoteDescription) {
                const queue = this.pendingCandidates.get(sender) ?? [];
                queue.push(candidate);
                this.pendingCandidates.set(sender, queue);
                return;
            }

            try {
                await peer.addIceCandidate(candidate);
            } catch (err) {
                console.error(`Failed to add ICE candidate from ${sender}:`, err);
            }
        });

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.localStream = stream;
            // Only announce voice readiness once we actually have the stream,
            // so peers never try to attach tracks before localStream exists.
            this.socket.emit("voice_ready");
        } catch (err) {
            console.error("Failed to get microphone access:", err);
        }

        EventBus.emit("lol", this);
    }

    update(_time: number, delta: number) {
        var moveX: number, moveY: number;
        moveX = moveY = 0;
        const speed = 100;
        if (this.keys.W.isDown) {
            moveY = -1;
            this.action = "run";
            this.direction = "up";
        }
        else if (this.keys.S.isDown) {
            moveY = 1;
            this.action = "run";
            this.direction = "down";
        }
        else if (this.keys.A.isDown) {
            moveX = -1;
            this.action = "run";
            this.direction = "left";
        }
        else if (this.keys.D.isDown) {
            moveX = 1;
            this.action = "run";
            this.direction = "right";
        }
        else {
            this.action = "idle"
        }
        if (this.prevState !== this.action) {
            this.prevState = this.action;
            this.stateChanged = true;
        }
        this.player.x += moveX * speed * delta / 1000;
        this.player.y += moveY * speed * delta / 1000;
        if (this.stateChanged || moveX !== 0 || moveY !== 0) {
            this.socket.emit("player_move", {
                x: this.player.x,
                y: this.player.y,
                direction: this.direction,
                action: this.action
            });
        }
        this.stateChanged = false;
        this.player.anims.play(`${this.action}_${this.direction}`, true);
        this.otherPlayers.forEach((sprite) => {
            const targetX = sprite.getData("targetX");
            const targetY = sprite.getData("targetY");

            if (targetX === undefined || targetY === undefined) return;

            sprite.x = Phaser.Math.Linear(sprite.x, targetX, 0.25);
            sprite.y = Phaser.Math.Linear(sprite.y, targetY, 0.25);
        });

    }
}