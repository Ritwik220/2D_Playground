import Phaser from "phaser";
import { EventBus } from "./EventBus";
import { Socket } from "socket.io-client";
import { VirtualJoystick } from "phaser-virtual-joystick";
import {socket} from "./Socket";

const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.relay.metered.ca:80" },
    {
        urls: "turn:global.relay.metered.ca:80",
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_PASSWORD,
    },
    {
        urls: "turn:global.relay.metered.ca:80?transport=tcp",
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_PASSWORD,
    },
    {
        urls: "turn:global.relay.metered.ca:443",
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_PASSWORD,
    },
    {
        urls: "turns:global.relay.metered.ca:443?transport=tcp",
        username: import.meta.env.VITE_TURN_USERNAME,
        credential: import.meta.env.VITE_TURN_PASSWORD,
    },
];
export default class GameScene extends Phaser.Scene {
    private fpsText: any;
    private lastFootstep = 0;
    // private footstepSound: any;
    private camera!: Phaser.Cameras.Scene2D.Camera;
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
    private playerNameText? : Phaser.GameObjects.Text;
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
        Number,
        Phaser.Physics.Arcade.Sprite
    >();
    private otherPlayerNameTags = new Map<
        Number,
        Phaser.GameObjects.Text
    >();
    private otherPlayersPopup = new Map<Number, Phaser.GameObjects.Container>

    constructor() {
        super("Game Scene");
    }

    preload() {
        // Loading running audio
        this.load.audio('footstep', '/Sounds/running.mp3');
        // Preloading the map
        this.load.tilemapTiledJSON("world", "/Maps/placeholder.json");
        this.load.image("punyworld-overworld-tileset", "/Tilesets/punyworld-overworld-tileset.png");
        this.load.image("Grass", "/Tilesets/Grass.png");
        this.load.image("Water", "/Tilesets/Water.png");
        this.load.image("Interior_objects", "/Tilesets/Interior_objects.png");
        this.load.image("Fences", "/Tilesets/Fences.png");
        this.load.image("Exterior", "/Tilesets/Exterior.png");
        this.load.image("Tilled Dirt", "/Tilesets/Tilled Dirt.png")
        this.load.image("Wooden House", "/Tilesets/Wooden House.png")

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


    private createPlayerMenu(player: Phaser.GameObjects.Sprite, id:Number) {
        if(this.otherPlayersPopup.has(id)) {
            this.otherPlayersPopup.get(id)?.destroy();
            this.otherPlayersPopup.delete(id);
        }
        const bg = this.add.rectangle(0, 0, 180, 190, 0x363199).setOrigin(0).setStrokeStyle(1, 0x454b57);
        const name = this.add.text(12, 12, player.getData("username"), {
            fontSize: "16px",
            color: "#ffffff",
            fontStyle: "bold",
            fontFamily: "Arial"
        });
        const items = ["View profile", "Start Chat", "Add friend"];

        const children: Phaser.GameObjects.GameObject[] = [bg, name];

        items.forEach((label, i) => {
            const rowY = 48 + i * 42;

            const rowBg = this.add.rectangle(
                90, rowY + 12, 164, 36, 0x2b3039
            );

            const text = this.add.text(
                16, rowY, label,
                {
                    fontSize: "14px",
                    color: "#e8edf5",
                    fontFamily: "Arial"
                }
            );

            rowBg.setInteractive({ useHandCursor: true });

            rowBg.on("pointerover", () => {
                rowBg.setFillStyle(0x414957);
            });

            rowBg.on("pointerout", () => {
                rowBg.setFillStyle(0x2b3039);
            });

            rowBg.on("pointerdown", () => {
                socket.emit("chat_handshake_initiated", id);
                console.log(`Clicked: ${label} on ${player.getData("username")}`);
            });

            children.push(rowBg, text);
        });
        const container = this.add.container(player.x, player.y+10, children);
        container.setDepth(1000);
        this.otherPlayersPopup.set(id, container);
        // 2. Strongly typed "click outside" detection
        this.input.on('pointerdown', (pointer:any, currentlyOver: Phaser.GameObjects.GameObject[]) => {
            // Safely verify it's an array to avoid the runtime error
            const clickedObjects = Array.isArray(currentlyOver) ? currentlyOver : [];
            console.log(pointer);

            // Check if the clicked target matches your typed GameObjects
            const clickedOnMenuOrPlayer = clickedObjects.some(obj => obj === this.player || obj === bg);

            if (!clickedOnMenuOrPlayer) {
                container.setVisible(false);
                container.destroy();
                this.otherPlayersPopup.delete(id);
                return;
            }
        });
        
    }

    // helper function
    private addOrUpdateOtherPlayer(player: any, user: any) {
        if (user && player.user_id === user.id) return;
        console.log(!player.id, player.id === this.socket.id, player.id, this.socket.id, this.player.getData("username"), player.username);
        const existing = this.otherPlayers.get(player.user_id);
        console.log("Added other player ", player.display_name);
        // The player already exists. Update it instead of creating a duplicate.
        if (existing) {
            existing.setData("targetX", player.x);
            existing.setData("targetY", player.y);

            const nameTag = this.otherPlayerNameTags.get(player.user_id);
            nameTag?.setText(player.display_name ?? "");
            return;
        }

        const sprite = this.physics.add.sprite(
            player.x,
            player.y,
            "idle_down"
        );
        sprite.setInteractive();
        sprite.setData("lastFootStep", 0);
        sprite.setData("targetX", player.x);
        sprite.setData("targetY", player.y);
        sprite.setData("username", player.username);
        sprite.setScale(0.7);

        sprite.on("pointerup", () => {
            this.createPlayerMenu(sprite, player.user_id);
        })
        

        const nameTag = this.add.text(
            player.x,
            player.y - 30,
            player.display_name ?? "",
            {
                fontFamily: "Arial",
                fontSize: "14px",
                color: "#FFFFFF",
                stroke: "#000000",
                strokeThickness: 2
            }
        ).setOrigin(0.5);
        nameTag.setScale(0.7);

        if (this.player) {
            this.physics.add.collider(this.player, sprite);
        }

        this.otherPlayers.set(player.user_id, sprite);
        this.otherPlayerNameTags.set(player.user_id, nameTag);
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
        // // 2. Build the pop-up menu inside a Container
        // const menuBg = this.add.rectangle(0, 0, 120, 80, 0x000000, 0.8);
        // const menuText = this.add.text(-45, -25, 'Action 1\nAction 2', {
        //     font: '16px Arial',
        //     color: '#ffffff'
        // });

        // // Make menu items interactive if needed
        // menuBg.setInteractive();
        // menuBg.on('pointerdown', () => {
        //     console.log('Menu option clicked');
        // });

        // // Combine into a container and hide it initially
        // const popupMenu = this.add.container(0, 0, [menuBg, menuText]);
        // popupMenu.setVisible(false);
        // popupMenu.setDepth(1000);
        // // this.footstepSound = this.sound.add('footstep');
        const map = this.make.tilemap({ key: "world" });

        // Replace "YOUR_TILESET_NAME" with the tileset name shown in Tiled.
        const tileset1 = map.addTilesetImage(
            "punyworld-overworld-tileset",
            "tileset"
        );
        const tileset2 = map.addTilesetImage("Grass", "Grass");
        const tileset3 = map.addTilesetImage("Water", "Water");
        const tileset4 = map.addTilesetImage("Interior_objects", "Interior_objects");
        const tileset5 = map.addTilesetImage("Fences", "Fences");
        const tileset6 = map.addTilesetImage("Exterior", "Exterior");
        const tileset7 = map.addTilesetImage("Tilled Dirt", "Tilled Dirt");
        const tileset8 = map.addTilesetImage("Wooden House", "Wooden House");

        const tilesets = [
            tileset1,
            tileset2,
            tileset3,
            tileset4,
            tileset5,
            tileset6,
            tileset7,
            tileset8
        ].filter((tileset): tileset is Phaser.Tilemaps.Tileset => tileset !== null);

        const ground = map.createLayer("Tile Layer 2", tilesets, 0, 0);
        const objecs = map.createLayer("Tile Layer 1", tilesets, 0, 0);
        const water = map.createLayer("Tile Layer 3", tilesets, 0, 0);
        const dirt = map.createLayer("Tile Layer 4", tilesets, 0, 0);
        const fence = map.createLayer("Tile Layer 5", tilesets, 0, 0);

        [ground, objecs, water, dirt, fence].forEach(layer => {
            layer?.setScale(1);
        });
        

        [objecs, fence].forEach(layer => {
            layer?.setCollisionByExclusion([-1]);
        });
        
        // getting the main camera
        this.camera = this.cameras.main;
        this.camera.setZoom(2);
        
        // Add text object at the top left corner (x: 10, y: 10)
        const startX = this.camera.scrollX + 10;
        const startY = this.camera.scrollY + 10;
        this.fpsText = this.add.text(startX, startY, 'FPS: 0', {
            fontFamily: 'Arial',
            fontSize: '18px',
            color: '#1e00ff'
        });

        // Ensure the text stays fixed relative to the camera/screen
        this.fpsText.setScrollFactor(0);
        this.fpsText.setDepth(1000); // Keep it on top of other objects
        
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
        this.socket = socket;
        if (!this.socket.connected) {
            this.socket.connect();
        }

        EventBus.on("microphone_toggle", (enabled: boolean) => {
            if (!this.localStream) {
                console.warn("Microphone stream is not initialized");
                return;
            }

            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = enabled;
            });

            console.log("Microphone enabled:", enabled);
        });
        this.socket.on("connect", () => {
            console.log("Player Connected:", this.socket.id);
        });


        this.socket.on("spawn player", (position, user) => {
            console.log("in spawn");
            if(this.player) return;

            // Adding our player
            this.player = this.physics.add.sprite(
                position.x,
                position.y,
                "idle_up"
            );


            this.player.setData("username", user.username);
            this.player.setData("id", user.user_id);


            this.player.setInteractive();


            this.player.on('pointerup', () => {
                this.createPlayerMenu(this.player, user.id);
            })
            

            this.player.setScale(0.7);
            // this.player.setScale(0.5);
            this.physics.add.existing(this.player);
            this.physics.add.collider(this.player, objecs);
            this.physics.add.collider(this.player, fence);
            // Camera following the player and keeping them on center
            this.camera.startFollow(this.player);
            this.camera.setFollowOffset(5, 5);
            this.camera.centerOn(this.player.x, this.player.y);


            this.playerNameText = this.add.text(0, 0, user.display_name, {
                fontFamily: 'Arial',
                fontSize: '14px',
                color: '#FFD16A',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);

            this.player.anims.play("idle_up", true);

            this.socket.emit("player_spawned");
            console.log(user.username, " has joined global room");
        });

        // Adding all the players online on the client screen
        this.socket.on("players", ({players, user}) => {
            for (const player of players) {
                if(Number(user.id) === Number(player.user_id)) continue;
                console.log(player.user_name);
                this.addOrUpdateOtherPlayer(player, user);
            }
        });
        // When a new player joins he gets added in the scene too
        this.socket.on("player_joined", ({player}) => {
            console.log(player.user_name);
            this.addOrUpdateOtherPlayer(player, null);
        });

        this.socket.on("chat_handshake_requested", (id) => {
            console.log(id);
            socket.emit("chat_handshake_answer", id);
            console.log("handshake requested");
            // send chat_hand_shake_answer to backend, create a room there and send chat_handshake_accepted to the other client
        })

        
        // Move the sprite of the user(other than out player) that moved
        this.socket.on("player_moved", (player) => {
            
            // this.addOrUpdateOtherPlayer(player);
            var sprite = this.otherPlayers.get(player.user_id);

            if (!sprite) {
                this.addOrUpdateOtherPlayer(player, null);
                sprite = this.otherPlayers.get(player.user_id);
                if(!sprite) return;
            }

            if(this.otherPlayersPopup.has(player.user_id)) {
                this.otherPlayersPopup.get(player.user_id)?.setPosition(sprite.x, sprite.y);
            }

            const now = this.time.now;
            if(now - sprite.getData("lastFootStep") > 300) {
                this.sound.play('footstep', { volume: 0.4 });
                sprite.setData("lastFootStep", now);
            }
            sprite.setData("targetX", player.x);
            sprite.setData("targetY", player.y);

            sprite.anims.play(
                `${player.action}_${player.direction}`,
                true
            );

        });
        // Remove the users that went offline
        this.socket.on("player_left", ({user_id, socket_id}) => {
            const sprite = this.otherPlayers.get(user_id);
            this.otherPlayers.delete(user_id);
            this.cleanupPeer(socket_id);
            this.otherPlayerNameTags.get(user_id)?.destroy();
            this.otherPlayerNameTags.delete(user_id);
            
            
            console.log("Checking if sprite exists");
            if (!sprite) return;

            sprite.destroy();


        });


        this.socket.on("disconnected", () => {
            if(!this.player) return;
            this.player.destroy();

            if(!this.playerNameText) return;
            this.playerNameText.destroy();
        })



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
                console.log("Creating offer for ", peer_id);
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
        if(!this.player) return;
        this.joystick?.update();

        // Get the actual FPS from the game loop and round it
        const fps = Math.floor(this.game.loop.actualFps);
        this.fpsText.setText(`FPS: ${fps}`);


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
        if(!this.player || !this.player.body) return
        this.player.setVelocity(moveX * speed, moveY * speed);
        if(this.playerNameText) {
            this.playerNameText.setPosition(this.player.x, this.player.y - 30);
        }
        if(this.otherPlayersPopup.has(this.player.getData("id"))) {
            this.otherPlayersPopup.get(this.player.getData("id"))?.setPosition(this.player.x, this.player.y)
        }

        if (
            this.prevState !== this.action ||
            this.stateChanged ||
            moveX !== 0 ||
            moveY !== 0
        ) {
            const now = this.time.now;
            if(now - this.lastFootstep > 300) {
                this.sound.play('footstep', { volume: 0.4 });
                this.lastFootstep = now;
            }
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

        this.otherPlayers.forEach((sprite, id) => {
            const targetX = sprite.getData("targetX");
            const targetY = sprite.getData("targetY");
            const name_tag = this.otherPlayerNameTags.get(id);
            
            if (targetX === undefined || targetY === undefined) return;
            
            sprite.x = Phaser.Math.Linear(sprite.x, targetX, 0.25);
            sprite.y = Phaser.Math.Linear(sprite.y, targetY, 0.25);
            if(name_tag) {
                name_tag.setPosition(sprite.x, sprite.y - 30);
            }
            else
                console.log("name tag not found ", name_tag);
        });
    }
}
