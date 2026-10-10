import Phaser from "phaser";
import { EventBus } from "./EventBus";
import { Socket, io } from "socket.io-client";
import { VirtualJoystick } from "phaser-virtual-joystick";

const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    {
        urls: "turn:standard.relay.metered.ca:80",
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_PASSWORD
    }
];

export default class GameScene extends Phaser.Scene {
    // Virtual joystick axes
    private joystickX = 0;
    private joystickY = 0;
    // Peer connections made using webrtc
    private peerConnections = new Map<string, RTCPeerConnection>();
    // Keeps track of pending ice candidates
    private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
    // Audio stream variable
    private localStream!: MediaStream;
    // direction that the player is facing
    private direction = "up";
    // Previous state of the player, later used to find out if there was any change that needs to emitted through web sockets
    private prevState = "idle";
    private stateChanged = false;
    // spawn postion
    // private spawnPosition = {x: 300, y: 400};
    // Web socket variable
    private socket!: Socket;
    // variable that defines what action the player needs to take
    private action = "idle";
    // Player sprite
    private player!: Phaser.Physics.Arcade.Sprite;
    // Initializing the virtual joystick
    private joystick!: VirtualJoystick;
    // Initializing the keys that are needed
    private keys!: {
        W: Phaser.Input.Keyboard.Key;
        A: Phaser.Input.Keyboard.Key;
        S: Phaser.Input.Keyboard.Key;
        D: Phaser.Input.Keyboard.Key;
    };
    // Arrays of all possible actions and directions
    private Actions = ['idle', 'run', 'attack1', 'attack2'];
    private directions = ['up', 'down', 'left', 'right'];
    // A map for the other players
    private otherPlayers = new Map<
        string,
        Phaser.Physics.Arcade.Sprite
    >();

    constructor() {
        super("Game Scene");
    }

    preload() {
        // Preloading the keys and the spritesheets
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

    private createPeerConnection(peer_id:string) {
        // Creating a peer connection
        const peer = new RTCPeerConnection({iceServers: ICE_SERVERS});
        const find_peer = this.peerConnections.get(peer_id);
        if(find_peer) return find_peer;
        // Addidng this peer connection to the set of all the peer connections
        this.peerConnections.set(peer_id, peer)

        // Getting the voice track(user audio message) and adding it to the tracks in the peer connection
        this.localStream.getTracks().forEach((track) => {
            peer.addTrack(track, this.localStream);
        })

        // Gathering the ice candidates
        peer.onicecandidate = (event) => {
            if(event.candidate) {
                this.socket.emit('voice_ice_candidate', {
                    target: peer_id,
                    candidate: event.candidate
                })
            }
        }

        // Playing the audio stream recieved
        peer.ontrack = (event) => {
            const audio = new Audio();
            audio.srcObject = event.streams[0];
            audio.play().catch((err) => {
                console.log(`Failed to play audio from ${peer_id}. Error: ${err}`);
            })
        }

        // Checking if the connection failed or close so that peer can be removed when its time is due
        peer.onconnectionstatechange= () => {
            console.log("Peer: "+peer_id + " connection "+peer.connectionState);
            if(peer.connectionState == 'failed' || peer.connectionState == 'closed') {
                this.cleanupPeer(peer_id);
            }
        }

        return peer;
    }

    // For removing peer connections taht have closed
    private cleanupPeer(peer_id: string) {
        const peer = this.peerConnections.get(peer_id);
        if(peer) {
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

    async createOffer(peer_id:string) {
        try {
            const peer = this.createPeerConnection(peer_id);
            const offer = await peer.createOffer();
            // Store the offer locally
            await peer.setLocalDescription(offer);

            // emitting a message that informs about the peer connection offer
            this.socket.emit('voice_offer', {
                target: peer_id,
                offer
            });
        }
        catch(err) {
            console.log(`Failed to create offer for ${peer_id}: `, err);
        }
    }

    async create() {
        // Adding the joystick
        this.joystick = new VirtualJoystick({scene: this});
        this.add.existing(this.joystick)
        // Addidng functionality to the joystick
        this.joystick.on("move", (data) => {
            this.joystickX = data.x;
            this.joystickY = data.y;
        });
        this.input.on("pointerup", () => {
            this.joystickX = 0;
            this.joystickY = 0;
        });

        this.input.on("pointerupoutside", () => {
            this.joystickX = 0;
            this.joystickY = 0;
        });
        this.socket = io({
            transports: ["websocket"]
        });

        // Adding all the players online on the client screen
        this.socket.on("players", (players) => {
            players.forEach((player: any) => {

                if (player.id === this.socket.id) return;

                const sprite = this.physics.add.sprite(
                    player.x,
                    player.y,
                    "idle_up"
                );
                this.physics.add.collider(this.player, sprite);
                this.otherPlayers.set(player.id, sprite);
            });
        });
        this.socket.on("spawn position", (position) => {
            console.log("in spawn");
            if(!this.player) return;

            // Adding our player
            this.player = this.physics.add.sprite(
                position.x,
                position.y,
                "idle_up"
            );

            this.player.anims.play("idle_up", true);
        });
        // When a new player joins he gets added in the scene too
        this.socket.on("player_joined", (player) => {
            const sprite = this.physics.add.sprite(
                player.x,
                player.y,
                "idle_up"
            );
            this.physics.add.collider(this.player, sprite);
            this.otherPlayers.set(player.id, sprite);
        });
        // Move the sprite of the user(other than out player) that moved
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
        // Remove the users that went offline
        this.socket.on("player_left", (id) => {

            const sprite = this.otherPlayers.get(id);

            if (!sprite) return;

            sprite.destroy();

            this.otherPlayers.delete(id);
            this.cleanupPeer(id);

        });
        // Creating animations
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



        

        // --- Voice signaling ---

        // Server tells us who's already voice-ready when we announce readiness.
        // We are guaranteed to have localStream by the time this fires, and so
        // is every peer in the list, so it's safe to offer to all of them.
        // This is triggered when someone gets a voice offer
        this.socket.on("voice_offer", async ({sender, offer}) => {
            try{
                const peer = this.createPeerConnection(sender);
                // Stores the offer as the remote description
                await peer.setRemoteDescription(offer);
                // remove the pending ice candidates as a suitable path has been found
                await this.flushPendingCandidates(sender, peer);
                
                const answer = await peer.createAnswer();
                // Stores the answer as the local description
                await peer.setLocalDescription(answer);

                this.socket.emit('voice_answer', {
                    target: sender,
                    answer
                })
            } catch(err) {
                console.log(`Failed to generate answer from ${sender}:`, err);
            }
        })

        this.socket.on("voice_ready_peers", async (peerIds:string[]) => {

            for(const peer_id of peerIds){

            await this.createOffer(peer_id);

            }

        });

        // This is the triggered on the comp that send the offer when an answer is recieved
        this.socket.on('voice_answer', async({sender, answer}) => {
            try {
                const peer = this.peerConnections.get(sender);
                if(!peer) return;
                // Settign the remote decription as the answer
                await peer.setRemoteDescription(answer);
                // flushing the pending cadidates since a suitable path has been found
                await this.flushPendingCandidates(sender, peer);
            }
            catch(err) {
                console.log(`Failed to get answer from ${sender}:`, err);
            }
        })

        this.socket.on("voice_ice_candidate", async ({ sender, candidate}) => {
            const peer = this.peerConnections.get(sender);

            if(!peer || !peer.remoteDescription) {
                const queue = this.pendingCandidates.get(sender)?? [];
                queue?.push(candidate);
                this.pendingCandidates.set(sender, queue);
                return;
            }
            try {
                await peer.addIceCandidate(candidate);
            } catch(err) {
                console.log(`Failed to add ICE candidate from ${sender}:`, err);
            }
        })

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

    
    update(_time: number, _delta: number) {
        this.joystick?.update();

        let moveX = 0;
        let moveY = 0;

        const speed = 100;

        // Keyboard takes priority if pressed
        if (this.keys.W.isDown) {
            moveY = -1;
        } else if (this.keys.S.isDown) {
            moveY = 1;
        } else if (this.keys.A.isDown) {
        moveX = -1;
        } else if (this.keys.D.isDown) {
            moveX = 1;
        } else {
        // Otherwise use joystick input
            moveX = this.joystickX;
            moveY = this.joystickY;
        }

    // Determine animation state and facing direction
        if (Math.abs(moveX) < 0.05 && Math.abs(moveY) < 0.05) {
            moveX = 0;
            moveY = 0;
            this.action = "idle";
        } else {
            this.action = "run";

            if (Math.abs(moveX) > Math.abs(moveY)) {
                this.direction = moveX > 0 ? "right" : "left";
            } else {
                this.direction = moveY > 0 ? "down" : "up";
            }
        }

        // Normalize diagonal movement
        const length = Math.sqrt(moveX * moveX + moveY * moveY);
        if (length > 1) {
            moveX /= length;
            moveY /= length;
        }

        this.player.setVelocity(moveX * speed, moveY * speed);

        if (
            this.prevState !== this.action ||
            this.stateChanged ||
            moveX !== 0 ||
            moveY !== 0
        ) {
            this.socket.emit("player_move", {
            x: this.player.x,
            y: this.player.y,
            direction: this.direction,
            action: this.action
            });
        }

        this.prevState = this.action;
        this.stateChanged = false;

        this.player.anims.play(
        `${this.action}_${this.direction}`,
        true
        );

        this.otherPlayers.forEach((sprite) => {
            const targetX = sprite.getData("targetX");
            const targetY = sprite.getData("targetY");

            if (targetX === undefined || targetY === undefined) return;

            sprite.x = Phaser.Math.Linear(sprite.x, targetX, 0.25);
            sprite.y = Phaser.Math.Linear(sprite.y, targetY, 0.25);
        });
    }
}
