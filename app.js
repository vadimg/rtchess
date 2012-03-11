var application_root = __dirname,
    express = require('express'),
    path = require('path'),
    Seq = require('seq'),
    EventEmitter = require('events').EventEmitter,
    _ = require('underscore');

var Board = require('./lib/board');
var config = require('./lib/config');
var common = require('./lib/common');

var logger = console;

var app = express.createServer();

var io = require('socket.io').listen(app);

// true when we are running in production
var production = process.env.NODE_ENV === 'production';
var pubdir = path.join(application_root, 'static');

app.configure(function(){
    var bundle = require('browserify')(__dirname + '/lib/client.js');
    app.use(bundle);
    app.use(require('connect-less')({ src: pubdir }));
});

app.configure('development', function() {
    app.use(express.static(pubdir));
    app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function() {
    // setup javascript minification
    app.use(require('minj').middleware({ src: pubdir}));

    var oneYear = 31557600000;
    app.use(express.staticCache());
    app.use(express.static(pubdir, { maxAge: oneYear }));
    app.use(express.errorHandler());
});


app.configure(function(){
    app.use(express.bodyParser());
    app.use(express.methodOverride());
    app.use(app.router);
    app.set('views', path.join(application_root, 'views'));
    app.set('view engine', 'html');
    app.register('.html', require('hbs'));
    app.set('view options', {
        layout: false
    });
});

app.error(function(err, req, res) {
    if (err instanceof NotFound) {
        return res.send(404);
    } else {
        logger.error(err.message, err);

        if (!production) {
            return res.send(err.message + '\n' + err.stack);
        }

        // in production, just log log the error and display 500 page
        return res.send(500);
    }
});

process.on('uncaughtException', function(err) {
  logger.error('UNCAUGHT EXCEPTION: ', err);
  logger.error(err.stack);
});

function Room(id) {
    this.id = id;
    this.white = null;
    this.black = null;
    this.starting= {};
    this.watchers = [];
    var self = this;

    function removeWatcher() {
        // if it has no one in it, remove the room
        if(self.watchers.length === 0) {
            console.log('DELETING ROOM ' + self.id);
            delete rooms[self.id];
            return;
        }
        setTimeout(removeWatcher, 30000);
    }
    setTimeout(removeWatcher, 30000);
};

// create board, bind events
Room.prototype.init = function() {
    var self = this;
    this.board = new Board();

    var events = ['addPiece', 'removePiece', 'movePiece', 'movingPiece', 'immobilePiece', 'immobilePieceTimer', 'mobilePiece', 'gameOver'];

    var broadcast = {
        emit: function() {
                  self.broadcast.apply(self, arguments);
              }
    };
    common.bindPassThrough(events, broadcast, this.board);

    this.board.on('gameOver', function() {
        // no one is starting
        self.starting = {};
    });

    this.board.on('activatePiece', function(id) {
        for(var i=0, l = SIDES.length; i < l; ++i) {
            var side = SIDES[i];
            if(self[side])
                self[side].emit('activatePiece', id);
        }
    });
    this.board.on('activateBoard', function() {
        console.log('board activate');
        for(var i=0, l = SIDES.length; i < l; ++i) {
            var side = SIDES[i];
            if(self[side])
                self[side].emit('activateBoard');
        }
    });
    this.board.on('disabled', function() {
        console.log('board disable');
        for(var i=0, l = SIDES.length; i < l; ++i) {
            var side = SIDES[i];
            if(self[side])
                self[side].emit('disabled');
        }
    });

    // add pieces TODO: send only 1 signal to client to add all pieces
    self.board.addPieces();
};

Room.prototype.broadcast = function() {
    console.log('broadcast to #:', this.watchers.length);
    for(var i=0, l = this.watchers.length; i < l; ++i) {
        var socket = this.watchers[i];
        socket.emit.apply(socket, arguments);
    }
};

Room.prototype.setSide = function(side, socket) {
    for(var i=0, l = SIDES.length; i < l; ++i) {
        var s = SIDES[i];
        if(this[s] === socket) {
            this[s] = null;
            delete this.starting[s];
            this.broadcast('sideFree', s);
        }
    }
    this[side] = socket;
    this.broadcast('sideTaken', side);
};

Room.prototype.add = function(socket) {
    console.log('adding user');
    this.watchers.push(socket);
};

Room.prototype.remove = function(socket) {
    console.log('removing user');
    var index = this.watchers.indexOf(socket);
    if(index >= 0)
        this.watchers.splice(index, 1);

    for(var i=0, l = SIDES.length; i < l; ++i) {
        var side = SIDES[i];
        if(this[side] === socket) {
            this[side] = null;
            delete this.starting[side];
            this.broadcast('sideFree', side);
            console.log(side, ' disconnected');

            // if disconnect happened during a game
            if(this.board && !this.board.disabled) {
                this.starting = {}; // no one is starting now
                this.board.disable();
                console.log(side, ' disconnected during game');
                this.broadcast('playerDisconnected', side);
            }
        }
    }
};

var rooms = {};
var SIDES = ['black', 'white'];

// only use long polling
io.set('transports', ['xhr-polling', 'jsonp-polling']);

io.sockets.on('connection', function(socket) {
    var room;
    var mySide;
    socket.on('ping', function() {
        socket.emit('pong');
    });
    socket.on('init', function(room_id) {
        console.log('got init', room_id);
        // don't allow multiple room_ids to be sent
        if(room)
            return;

        room = rooms[room_id];
        if(!room) {
            room = new Room(room_id);
            rooms[room_id] = room;
        }

        room.add(socket);

        for(var i=0, l = SIDES.length; i < l; ++i) {
            var side = SIDES[i];
            if(room[side])
                socket.emit('sideTaken', side);
        }
    });
    socket.on('disconnect', function() {
        if(!room)
            return;
        room.remove(socket);
        room = undefined;
    });
    socket.on('chooseSide', function(side) {
        if(!room)
            return;
        if(!room[side]) {
            mySide = side;
            room.setSide(side, socket);
            socket.emit('gotSide', side);
        }
    });
    socket.on('startGame', function() {
        for(var i=0, l = SIDES.length; i < l; ++i) {
            var side = SIDES[i];
            if(room[side] === socket) {
                room.starting[side] = true;
                break;
            }
        }

        // start game if everyone has clicked start
        if(_.size(room.starting) === SIDES.length) {
            for(var i=0, l = SIDES.length; i < l; ++i) {
                var side = SIDES[i];
                setTimeout(function() {
                    room.board.startGame();
                }, config.START_WAIT_SECS*1000);
                room[side].emit('starting', config.START_WAIT_SECS);
            }
            room.init();
        }
    });
    socket.on('moveRequest', function(id, loc) {
        room.board.moveRequest(id, loc, mySide);
    });
});

app.get('/', function(req, res) {
    var room_id = randomString(20);
    rooms[room_id] = new Room(room_id);
    return res.redirect('/r/' + room_id);
});

app.get('/r/:room_id', function(req, res) {
    var room_id = req.param('room_id');
    if(!rooms[room_id]) {
        rooms[room_id] = new Room(room_id);
    }
    return res.render('index', {room_id: room_id});
});

// helpers ========================

// testing route to create 500 error
app.get('/500', function(req, res){
    throw new Error('This is a 500 Error');
});

// testing route to create 404 error
app.get('/404', function(req, res){
    throw new NotFound();
});

// ALWAYS keep as the last route
app.get('*', function(req, res) {
    throw new NotFound();
});

// used to identify 404 pages
function NotFound(msg){
    this.name = 'NotFound';
    Error.call(this, msg);
    Error.captureStackTrace(this, arguments.callee);
}

function randomString(len) {
    var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz';
    var ret = '';
    for (var i=0; i<len; i++) {
        var rnum = Math.floor(Math.random() * chars.length);
        ret += chars.substring(rnum,rnum+1);
    }
    return ret;
}

var port = 3003;
app.listen(port);
logger.info('server running on port ' + port);
