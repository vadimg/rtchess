var config = require('./config');
var EventEmitter = require('events').EventEmitter;
var common = require('./common');
var pieces = require('./pieces');

function Board(color) {
    this.color = color;
    this.pieces = {};
    this.locs = {};
    this.targets = {};

    // fill up targets
    for(var i=1; i <= 8; ++i) {
        for(var j=1; j <= 8; ++j) {
            this.targets[[i,j]] = {};
        }
    }
}
Board.prototype = new EventEmitter;

// adds piece to the board and model
Board.prototype.addPiece = function(id, loc) {
    var m = {
        p: pieces.Pawn,
        r: pieces.Rook,
        h: pieces.Horse,
        b: pieces.Bishop,
        q: pieces.Queen,
        k: pieces.King
    };

    var klass = m[id[1]];
    var piece = new klass(id, loc);
    piece.board = this; // TODO: pass in constructor

    this.pieces[id] = piece;
    this.locs[loc] = piece;

    this.emit('addPiece', id, loc);

    return piece;
};

// calls f(piece, Piece)
Board.prototype.eachPiece = function(f) {
    for(var p in this.pieces) {
        if(f(p, this.pieces[p]) === false)
            continue;
    }
};

Board.prototype.getPiece = function(id) {
    return this.pieces[id];
};

Board.prototype.atLoc = function(loc) {
    return this.locs[loc];
};

// converts a pos to a loc
Board.prototype.pos2loc = function(pos) {
    if(this.color === 'w') {
        return [Math.round(pos.left/config.SIZE + 1), Math.round(8 - pos.top/config.SIZE)];
    } else {
        return [Math.round(8 - pos.left/config.SIZE), Math.round(pos.top/config.SIZE + 1)];
    }
};

// convert a loc to pos
Board.prototype.loc2pos = function(loc) {
    if(this.color === 'w') {
        return {
            left: (loc[0] - 1)*config.SIZE,
            top: (8 - loc[1])*config.SIZE
        };
    } else {
        return {
            left: (8 - loc[0])*config.SIZE,
            top: (loc[1] - 1)*config.SIZE
        };
    }
};

Board.prototype.moveRequest = function(id, loc) {
    var piece = this.getPiece(id);
    if(!piece.isValidMove(loc)) {
        return false;
    }

    // move the piece
    this.move(id, loc);
};

Board.prototype.move = function(pid, to) {
    var piece = this.pieces[pid];
    this.emit('movePiece', pid, to);

    piece.moving(to);

    var from = piece.loc;

    this.targets[to][piece.color] = true;

    piece.loc = undefined;
    delete this.locs[from];

    var toPos = this.loc2pos(to);
    var fromPos = this.loc2pos(from);

    // get the distance to the destination
    var len = Math.sqrt(Math.pow(toPos.top - fromPos.top, 2) + Math.pow(toPos.left - fromPos.left, 2));

    // the change in ratio per time period
    var rdelta = config.PIECE_SPEED/len;

    var ratio = 0;

    var self = this;
    function moveStep() {
        ratio += rdelta;

        // make sure we don't move too far
        if(ratio > 1) {
            ratio = 1;
        }

        self.emit('movingPiece', pid, from, to, ratio);

        if(ratio === 1) {
            self.moved(pid, to);
            piece.immobilize();
            return;
        }

        setTimeout(moveStep, 50);
    }
    moveStep();
};

Board.prototype.remove = function(id) {
    var loc = this.pieces[id].loc;
    delete this.pieces[id];
    delete this.locs[loc];

    this.emit('removePiece', id);
};

Board.prototype.moved = function(pid, to) {
    var piece = this.pieces[pid];
    piece.loc = to;
    var enemy = this.locs[to];
    if(enemy) {
        if(enemy.color === piece.color) {
            // huh?
            throw new Exception('enemy color matches my color: ' + enemy.id + ', ' + piece.id);
        }
        // capture it!
        this.remove(enemy.id);

        // if you captured the king, game over
        if(enemy instanceof pieces.King) {
            this.emit('gameOver', piece.color);
        }
    }
    this.locs[to] = piece;

    delete this.targets[to][piece.color];

    piece.moved();
    this.emit('movedPiece', pid, to);
};

Board.prototype.addPieces = function() {
    var m = {};

    // white pieces
    m.wk = 'e1';
    m.wq = 'd1';
    m.wb1 = 'c1';
    m.wb2 = 'f1';
    m.wh1 = 'b1';
    m.wh2 = 'g1';
    m.wr1 = 'a1';
    m.wr2 = 'h1';

    // black pieces
    for(var p in m) {
        var bp = 'b' + p.slice(1);
        var lpos = m[p][0];
        this.addPiece(p, common.nLoc(m[p]));
        this.addPiece(bp, common.nLoc(lpos + 8));
    }

    // pawns
    for(var i=1; i <= 8; ++i) {
        this.addPiece('wp' + i, [i, 2]);
        this.addPiece('bp' + i, [i, 7]);
    }
};

Board.prototype.startGame = function() {
    var color = this.color;
    // TODO: this is hacky, but oh well
    this.emit('activateBoard'); // Piece objects don't get activated :(
}

module.exports = Board;

