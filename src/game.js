class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }

    x = 0;
    y = 0;

    // Calculate the dot product of two vectors
    dotProduct(otherVector) {
        return this.x * otherVector.x + this.y * otherVector.y;
    }

    // Calculate the magnitude (length) of a vector
    magnitude() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    // Calculate the projection of this vector onto another vector
    projectOnto(otherVector) {
        const dotAB = this.dotProduct(otherVector);
        const magB = otherVector.magnitude();

        // Calculate the projection vector
        const projection = new Vector2(
            (dotAB / (magB * magB)) * otherVector.x,
            (dotAB / (magB * magB)) * otherVector.y
        );

        return projection;
    }
};

class Shape {
    static Type = {
        RECT: 0,
    };

    type = Shape.Type.RECT;

    outlineColor = null;
    outlineThickness = 1;

    fillColor = "000000";

    // rect
    width = 0;
    height = 0;
};

const game = {
    fpms: 1000.0 / 30.0,
    delta: 1.0 / 30.0,

    coyote_sec: 0.5,
    lastTimestampOnFloor: -1000.0,

    canvas: null,
    ctx: null,

    lastTimestamp: performance.now(),

    paused: true,

    entities: [],

    player: null,

    externalStaticRectsInLocalSpace: [],

    drawDebugCollision: false,

    started: false,

    init: function (document, ctx, canvas, spawnPosition) {
        this.ctx = ctx
        this.canvas = canvas

        const player = {};

        player.position = new Vector2(spawnPosition.x, spawnPosition.y);
        player.offset = new Vector2(-15, -31.5);
        player.velocity = new Vector2(0, 0);
        player.floored = false
        player.jumped = false

        player.gravity = {
            up: 1000.0,
            down: 1500.0,
        };

        const rect = new Shape();
        rect.type = Shape.Type.RECT;
        rect.width = 30;
        rect.height = 30;
        rect.fillColor = "#e16162";
        rect.outlineColor = "#001e1d";
        rect.outlineThickness = 6

        player.collision = { x: -3, y: -3, width: 36, height: 36 };

        player.draw = rect;

        this.addEntity(player);

        this.player = player;

        function setupInput() {
            document.addEventListener("keydown", game.handleKeyDown);
            document.addEventListener("keyup", game.handleKeyUp);
        }
        setupInput();
    },

    onFloorChanged: function(entity) {
        if (!entity.floored) {
            this.lastTimestampOnFloor = performance.now();
        } else {
            entity.jumped = false;
        }
    },

    pause: function(pause) {
        if (!this.started) {
            return;
        }

        this.paused = pause
        if (!pause) {
            this.lastTimestamp = performance.now();
            this.loop();
        }
    },

    keysDown: {},

    handleKeyDown: (event) => {
        if (game.keysDown[event.code]) {
            return;
        }

        game.keysDown[event.code] = true;
        game.input(event.code, true);
    },

    handleKeyUp: (event) => {
        game.keysDown[event.code] = false;
        game.input(event.code, false);
    },

    input: function (key, pressed) {
        let gotInput = false;
        if (key == "KeyW") {
            if (pressed) {
                this.jump(this.player)
            } else {
                this.truncateJump(this.player)
            }
            gotInput = true;
        } else if (key == "KeyA" || key == "KeyD") {
            const direction = (this.keysDown["KeyD"] ?? 0) - (this.keysDown["KeyA"] ?? 0)
            this.player.direction = direction
            gotInput = true;
        }

        if (!gotInput) {
            return;
        }

        if (this.started) {
            return;
        }

        this.started = true;
        this.pause(false);
    },

    jump: function (entity, custom_height = null) {
        if (entity.jumped) {
            return;
        }

        if (entity.velocity == null || entity.gravity == null) {
            return;
        }

        const delta = (performance.now() - this.lastTimestampOnFloor) / 1000.0;
        if (!entity.floored && delta > this.coyote_sec) {
            return;
        }

        const heightpx = 33 * 5;
        const h = custom_height != null ? custom_height : heightpx
        const g = entity.gravity.up;
        const v0 = entity.velocity.y;

        const initial_velocity = Math.sqrt(v0 * v0 + 2 * g * h);

        entity.velocity.y = -initial_velocity;
        entity.jumped = true;
    },

    truncateJump: function(entity) {
        if (entity.velocity == null) {
            return;
        }

        if (entity.velocity.y >= 0) {
            return;
        }

        entity.velocity.y /= 3.0
    },

    loop: function () {
        const currentTimestamp = performance.now();
        const deltaMsec = (currentTimestamp - this.lastTimestamp);

        this.lastTimestamp = currentTimestamp;
        this.simulate(deltaMsec / 1000.0);

        this.resolveCollisions(this.externalStaticRectsInLocalSpace);

        this.draw();

        requestAnimationFrame(() => { this.loop(); });
    },

    draw: function () {

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.entities.forEach((entity) => {
            this.drawEntity(this.ctx, entity);
        });

        if (this.drawDebugCollision) {
            this.ctx.strokeStype = "red"
            this.ctx.lineWidth = 2

            this.externalStaticRectsInLocalSpace.forEach((rect) => {
                this.ctx.strokeRect(
                    rect.x,
                    rect.y,
                    rect.width,
                    rect.height
                );
            });
        }
    },

    resolveCollision: function (movingRect, staticRect) {
        function doRectanglesIntersect(rectA, rectB) {
            return (
                rectA.x < rectB.x + rectB.width &&
                rectA.x + rectA.width > rectB.x &&
                rectA.y < rectB.y + rectB.height &&
                rectA.y + rectA.height > rectB.y
            );
        }

        if (!doRectanglesIntersect(movingRect, staticRect)) {
            return {
                moveOutVector: null,
                normal: null,
            };
        }

        function calculateOverlap(pos1, size1, pos2, size2) {
            const min1 = pos1;
            const max1 = pos1 + size1;
            const min2 = pos2;
            const max2 = pos2 + size2;

            if (max1 <= min2 || min1 >= max2) {
                // No overlap
                return 0;
            }

            return Math.min(max1, max2) - Math.max(min1, min2);
        }

        const overlapX = calculateOverlap(movingRect.x, movingRect.width, staticRect.x, staticRect.width);
        const overlapY = calculateOverlap(movingRect.y, movingRect.height, staticRect.y, staticRect.height);

        if (overlapX < overlapY) {
            // Resolve horizontally
            if (movingRect.x < staticRect.x) {
                return {
                    moveOutVector: new Vector2(-overlapX, 0),
                    normal: new Vector2(-1, 0),
                };
            } else {
                return {
                    moveOutVector: new Vector2(overlapX, 0),
                    normal: new Vector2(1, 0),
                };
            }
        } else {
            // Resolve vertically
            if (movingRect.y < staticRect.y) {
                return {
                    moveOutVector: new Vector2(0, -overlapY),
                    normal: new Vector2(0, -1),
                };
            } else {
                return {
                    moveOutVector: new Vector2(0, overlapY),
                    normal: new Vector2(0, 1),
                };
            }
        }
    },

    resolveCollisions(externalStaticRectsLocalSpace) {
        function isMover(entity) {
            return entity.position != null && entity.velocity != null && entity.collision != null
        }
        const movers = [...new Set(this.entities.filter(entity => isMover(entity)))]
        const game = this;

        movers.forEach((mover) => {
            const mover_rect = {
                x: mover.position.x + mover.collision.x + mover.offset.x,
                y: mover.position.y + mover.collision.y + mover.offset.y,
                width: mover.collision.width,
                height: mover.collision.height,
            };

            var floored = false;

            externalStaticRectsLocalSpace.forEach((rect) => {
                const result = this.resolveCollision(mover_rect, rect);

                if (result.moveOutVector != null) {
                    mover.position.x += result.moveOutVector.x;
                    mover.position.y += result.moveOutVector.y;

                    floored = result.moveOutVector.y < 0;
                }

                if (result.normal != null) {
                    const wall = new Vector2(result.normal.y, -result.normal.x);
                    const newVelocity = mover.velocity.projectOnto(wall);
                    mover.velocity = newVelocity;
                }
            });

            if (floored != mover.floored) {
                mover.floored = floored;
                game.onFloorChanged(mover)
            }
        });
    },

    simulate: function (delta) {
        this.delta = delta;

        if (this.player.direction != null) {
            this.player.velocity.x = this.player.direction * 350.0;
        }
        
        this.entities.forEach((entity) => {
            this.simulateEntity(entity);
        });
    },

    simulateEntity: function (entity) {
        if (entity.position == null || entity.velocity == null) {
            return
        }

        if (entity.gravity != null) {
            if (entity.velocity.y < 0) {
                entity.velocity.y += entity.gravity.up * this.delta;
            } else {
                entity.velocity.y += entity.gravity.down * this.delta;
            }
        }

        entity.position.x += entity.velocity.x * this.delta;
        entity.position.y += entity.velocity.y * this.delta;
    },

    drawEntity: function (ctx, entity) {

        function drawRoundedRect(ctx, rect, cornerRadius) {
            // Draw outline
            ctx.beginPath();
            ctx.moveTo(rect.x + cornerRadius, rect.y);
            ctx.lineTo(rect.x + rect.width - cornerRadius, rect.y);
            ctx.arcTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + cornerRadius, cornerRadius);
            ctx.lineTo(rect.x + rect.width, rect.y + rect.height - cornerRadius);
            ctx.arcTo(rect.x + rect.width, rect.y + rect.height, rect.x + rect.width - cornerRadius, rect.y + rect.height, cornerRadius);
            ctx.lineTo(rect.x + cornerRadius, rect.y + rect.height);
            ctx.arcTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - cornerRadius, cornerRadius);
            ctx.lineTo(rect.x, rect.y + cornerRadius);
            ctx.arcTo(rect.x, rect.y, rect.x + cornerRadius, rect.y, cornerRadius);
            ctx.closePath();
            ctx.stroke();
        
            // Draw fill
            ctx.beginPath();
            ctx.moveTo(rect.x + cornerRadius, rect.y);
            ctx.lineTo(rect.x + rect.width - cornerRadius, rect.y);
            ctx.arcTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + cornerRadius, cornerRadius);
            ctx.lineTo(rect.x + rect.width, rect.y + rect.height - cornerRadius);
            ctx.arcTo(rect.x + rect.width, rect.y + rect.height, rect.x + rect.width - cornerRadius, rect.y + rect.height, cornerRadius);
            ctx.lineTo(rect.x + cornerRadius, rect.y + rect.height);
            ctx.arcTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - cornerRadius, cornerRadius);
            ctx.lineTo(rect.x, rect.y + cornerRadius);
            ctx.arcTo(rect.x, rect.y, rect.x + cornerRadius, rect.y, cornerRadius);
            ctx.closePath();
            ctx.fill();
        }
        

        if (entity.position == null && entity.draw == null) {
            return
        }

        if (entity.draw.fillColor != null) {
            ctx.fillStyle = entity.draw.fillColor;
        }

        if (entity.draw.outlineColor != null) {
            ctx.strokeStyle = entity.draw.outlineColor;
            ctx.lineWidth = entity.draw.outlineThickness;
        }

        if (entity.draw.type == Shape.Type.RECT) {
            const rect = {
                x: entity.position.x + entity.offset.x,
                y: entity.position.y + entity.offset.y,
                width: entity.draw.width,
                height: entity.draw.height,
            }

            drawRoundedRect(ctx, rect, 3);

            // if (entity.draw.fillColor != null) {
            //     ctx.fillRect(
            //         entity.position.x + entity.offset.x,
            //         entity.position.y + entity.offset.y,
            //         entity.draw.width,
            //         entity.draw.height,
            //     );
            // }

            // if (entity.draw.outlineColor != null) {
            //     ctx.strokeRect(
            //         entity.position.x + entity.offset.x,
            //         entity.position.y + entity.offset.y,
            //         entity.draw.width,
            //         entity.draw.height,
            //     );
            // }
        }
    },

    addEntity: function (entity) {
        this.entities.push(entity)
    },
};