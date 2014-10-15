!function () {
  var CIRCLE = Math.PI * 2;
  var MOBILE = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);

  function Controls() {
    this.codes  = { 37: 'left', 39: 'right', 38: 'forward', 40: 'backward' };
    this.states = { 'left': false, 'right': false, 'forward': false, 'backward': false };
    document.addEventListener('keydown', this.onKey.bind(this, true), false);
    document.addEventListener('keyup', this.onKey.bind(this, false), false);
    document.addEventListener('touchstart', this.onTouch.bind(this), false);
    document.addEventListener('touchmove', this.onTouch.bind(this), false);
    document.addEventListener('touchend', this.onTouchEnd.bind(this), false);
  }

  Controls.prototype.onTouch = function(e) {
    var t = e.touches[0];
    this.onTouchEnd(e);
    if (t.pageY < window.innerHeight * 0.5) this.onKey(true, { keyCode: 38 });
    else if (t.pageX < window.innerWidth * 0.5) this.onKey(true, { keyCode: 37 });
    else if (t.pageY > window.innerWidth * 0.5) this.onKey(true, { keyCode: 39 });
  };

  Controls.prototype.onTouchEnd = function(e) {
    this.states = { 'left': false, 'right': false, 'forward': false, 'backward': false };
    e.preventDefault();
    e.stopPropagation();
  };

  Controls.prototype.onKey = function(val, e) {
    var state = this.codes[e.keyCode];
    if (typeof state === 'undefined') return;
    this.states[state] = val;
    e.preventDefault && e.preventDefault();
    e.stopPropagation && e.stopPropagation();
  };

  function Player(x, y, direction) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.paces = 0;
    this.hasWon = false;
  }

  Player.prototype.rotate = function(angle) {
    this.direction = (this.direction + angle + CIRCLE) % (CIRCLE);
  };

  Player.prototype.walk = function(distance, map) {
    var dx = Math.cos(this.direction) * distance;
    var dy = Math.sin(this.direction) * distance;
    if (map.get(this.x + dx, this.y) <= 0) this.x += dx;
    if (map.get(this.x, this.y + dy) <= 0) this.y += dy;
    if (!this.hasWon && this.x >= map.size - 2 && this.y >= map.size - 2) {
      alert('Joy! You win with a time of ' + gameTime + ' seconds!');
      this.hasWon = true;
      location.reload();
    }
    this.paces += distance;
  };

  Player.prototype.update = function(controls, map, seconds) {
    if (controls.left) this.rotate(-Math.PI * seconds);
    if (controls.right) this.rotate(Math.PI * seconds);
    if (controls.forward) this.walk(3 * seconds, map);
    if (controls.backward) this.walk(-3 * seconds, map);
  };

  function Map(size) {
    this.size = size;
    this.wallGrid = new Uint8Array(size * size);
    this.light = 0;

    for (var i = 0, _len = this.size * this.size; i < _len; i++) {
      if (i === this.size * (this.size - 1) - 1) this.wallGrid[i] = 4;
      else this.wallGrid[i] =
        i < this.size ||
        i % this.size === 0 ||
        (i + 1) % this.size === 0 ||
        i + this.size > this.size * this.size ||
        i % 2 === 0 && (i % 4 ? i < this.size * (this.size - 2) : i > this.size * 2) ?
          Math.ceil(Math.random() * 3) : 0;
    }
  }

  Map.prototype.get = function(x, y) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || x > this.size - 1 || y < 0 || y > this.size - 1) return -1;
    return this.wallGrid[y * this.size + x];
  };

  Map.prototype.cast = function(point, angle, range) {
    var self = this;
    var sin = Math.sin(angle);
    var cos = Math.cos(angle);
    var noWall = { length2: Infinity };

    return ray({ x: point.x, y: point.y, height: 0, distance: 0 });

    function ray(origin) {
      var stepX = step(sin, cos, origin.x, origin.y);
      var stepY = step(cos, sin, origin.y, origin.x, true);
      var nextStep = stepX.length2 < stepY.length2
        ? inspect(stepX, 1, 0, origin.distance, stepX.y)
        : inspect(stepY, 0, 1, origin.distance, stepY.x);

      if (nextStep.distance > range) return [origin];
      return [origin].concat(ray(nextStep));
    }

    function step(rise, run, x, y, inverted) {
      if (run === 0) return noWall;
      var dx = run > 0 ? Math.floor(x + 1) - x : Math.ceil(x - 1) - x;
      var dy = dx * (rise / run);
      return {
        x: inverted ? y + dy : x + dx,
        y: inverted ? x + dx : y + dy,
        length2: dx * dx + dy * dy
      };
    }

    function inspect(step, shiftX, shiftY, distance, offset) {
      var dx = cos < 0 ? shiftX : 0;
      var dy = sin < 0 ? shiftY : 0;
      step.height = self.get(step.x - dx, step.y - dy);
      step.distance = distance + Math.sqrt(step.length2);
      if (shiftX) step.shading = cos < 0 ? 2 : 0;
      else step.shading = sin < 0 ? 2 : 1;
      step.offset = offset - Math.floor(offset);
      return step;
    }
  };

  function Camera(canvas, resolution, focalLength) {
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width = window.innerWidth * 0.5;
    this.height = canvas.height = window.innerHeight * 0.5;
    this.resolution = resolution;
    this.spacing = this.width / resolution;
    this.focalLength = focalLength || 0.8;
    this.range = MOBILE ? 8 : 14;
    this.lightRange = 5;
    this.scale = (this.width + this.height) / 1200;
  }

  Camera.prototype.render = function(player, map) {
    this.ctx.save();
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.restore();
    this.drawColumns(player, map);
    camera.ctx.fillStyle = '#c00';
    camera.ctx.fillText(gameTime, 10, 10);
  };

  Camera.prototype.drawColumns = function(player, map) {
    this.ctx.save();
    for (var column = 0; column < this.resolution; column++) {
      var x = column / this.resolution - 0.5;
      var angle = Math.atan2(x, this.focalLength);
      var ray = map.cast(player, player.direction + angle, this.range);
      this.drawColumn(column, ray, angle, map);
    }
    this.ctx.restore();
  };

  Camera.prototype.drawColumn = function(column, ray, angle, map) {
    var ctx = this.ctx;
    var left = Math.floor(column * this.spacing);
    var width = Math.ceil(this.spacing);
    var hit = -1;

    while (++hit < ray.length && ray[hit].height <= 0);

    for (var s = ray.length - 1; s >= 0; s--) {
      var step = ray[s];

      if (s === hit) {

        var wall = this.project(step.height, angle, step.distance);
        if (step.height === 4) ctx.fillStyle = 'gold';
        else ctx.fillStyle = '#fff';
        ctx.globalAlpha = 1;
        ctx.fillRect(left, wall.top, width, wall.height);

        ctx.fillStyle = '#000';
        ctx.globalAlpha = Math.max((step.distance + step.shading) / this.lightRange - map.light, 0);
        ctx.fillRect(left, wall.top, width, wall.height);
      }
    }
  };

  Camera.prototype.project = function(height, angle, distance) {
    var z = distance * Math.cos(angle);
    var wallHeight = this.height * height / z;
    var bottom = this.height / 2 * (1 + 1 / z);
    return {
      top: bottom - wallHeight,
      height: wallHeight
    };
  };

  function GameLoop() {
    this.frame = this.frame.bind(this);
    this.lastTime = 0;
    this.callback = function() {};
  }

  GameLoop.prototype.start = function(callback) {
    this.callback = callback;
    requestAnimationFrame(this.frame);
  };

  GameLoop.prototype.frame = function(time) {
    var seconds = (time - this.lastTime) / 1000;
    this.lastTime = time;
    if (seconds < 0.2) this.callback(seconds);
    requestAnimationFrame(this.frame);
    gameTime =  (time / 1000).toFixed(2) + ' s';
  };

  var display = document.querySelector('canvas');
  var player = new Player(1.5, 1.5, Math.PI * 0.4);
  var map = new Map(16);
  var controls = new Controls();
  var camera = new Camera(display, MOBILE ? 160 : 320, 0.8);
  var loop = new GameLoop();
  var gameTime = '0.00 s';

  loop.start(function frame(seconds) {
    player.update(controls.states, map, seconds);
    camera.render(player, map);
  });
}();
