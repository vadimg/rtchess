var config = require('./config');
var common = require('./common');

function Piece(id, loc, active, board) {
    // need this for prototype inheritance to work
    if(!id)
        return;

    this.loc = loc;
    this.id = id;
    this.color = id[0];
    this.immobileTimer = 0;
    this.active = !!active;
    this.board = board;
}

Piece.prototype.activate = function() {
    this.active = true;
};

Piece.prototype.immobilize = function() {
    var self = this;

    self.board.emit('immobilePiece', self.id);

    var ev = common.timer(self.board);

    ev.on('timeRemaining', function(rem) {
        self.immobileTimer = rem;
        self.board.emit('immobilePieceTimer', self.id, rem);
    });
    ev.on('finished', function() {
        self.immobileTimer = 0;
        self.board.emit('mobilePiece', self.id);
    });
};

Piece.prototype.isMobile = function() {
    return this.immobileTimer === 0;
};

Piece.prototype.getPos = function() {
    var white = this.board.color === 'w';

    var l = this.loc[0] - 1;
    var n = 8 - this.loc[1];

    if(!white) {
        n = 7 - n;
        l = 7 - l;
    }

    return {
        left: l*config.SIZE,
        top: n*config.SIZE
    };
};

Piece.prototype.isValidMove = function(loc) {
    // make sure the piece isn't already moving
    if(!this.loc)
        return false;

    // make sure the piece is not immobile
    if(!this.isMobile())
        return false;

    // prevent moving to an occupied square
    if(this.hasMyPiece(loc))
        return false;

    // prevent move requests to the same square for same-color pieces
    if(this.board.targets[loc][this.color])
        return false;

    return true;
};

Piece.prototype.hasMyPiece = function(loc) {
    var lpiece = this.board.atLoc(loc);
    return lpiece && lpiece.color === this.color;
};

Piece.prototype.hasEnemyPiece = function(loc) {
    var lpiece = this.board.atLoc(loc);
    return lpiece && lpiece.color !== this.color;
};

function sign(n) {
    if(n < 0)
        return -1;
    else if(n > 0)
        return 1;
    else
        return 0;
}

// returns true if all squares up to (but not including) loc
// in a straight-line starting from its current position do
// not have any pieces on them
Piece.prototype.isPathClear = function(loc) {
    var dl = sign(loc[0] - this.loc[0]);
    var dn = sign(loc[1] - this.loc[1]);

    var l = this.loc[0] + dl;
    var n = this.loc[1] + dn;

    // go through all the squares except the target, which is already handled
    while(l !== loc[0] || n !== loc[1] && !(l === loc[0] && n === loc[1])) {
        if(this.board.atLoc([l, n]))
            return false;

        l += dl;
        n += dn;
    }

    return true;
};

// called before each piece starts moving
Piece.prototype.moving = function(toLoc) {
};

// called after each piece has finished moving
Piece.prototype.moved = function() {
};

function Pawn(id, loc, active, board) {
    Piece.call(this, id, loc, active, board);
    this.wasMoved = false;
}
Pawn.prototype = new Piece();

Pawn.prototype.moved = function() {
    this.wasMoved = true;

    // queening
    if((this.color === 'w' && this.loc[1] === 8) ||
            (this.color === 'b' && this.loc[1] === 1)) {
        var num = this.id[2];
        var loc = this.loc;
        var color = this.color;
        this.board.remove(this.id);
        var queen = this.board.addPiece(color + 'q' + num, loc, true);
        queen.immobilize();
    }
};

Pawn.prototype.isValidMove = function(loc) {
    if(!Piece.prototype.isValidMove.call(this, loc))
        return false;

    var dir = this.color === 'w' ? 1 : -1;

    if(!this.hasEnemyPiece(loc)) {
        // move forward 2
        if(!this.wasMoved && loc[0] === this.loc[0] && loc[1] === this.loc[1] + 2*dir)
            return true;

        // move forward 1
        if(loc[0] === this.loc[0] && loc[1] === this.loc[1] + 1*dir)
            return true;
    }

    // capture
    if(this.hasEnemyPiece(loc) && Math.abs(loc[0] - this.loc[0]) === 1 && loc[1] === this.loc[1] + 1*dir)
        return true;

    return false;
};

function Rook(id, loc, active, board) {
    Piece.call(this, id, loc, active, board);
    this.wasMoved = false;
}
Rook.prototype = new Piece();

Rook.prototype.isValidMove = function(loc) {
    if(!Piece.prototype.isValidMove.call(this, loc))
        return false;

    if(this.loc[0] !== loc[0] && this.loc[1] !== loc[1])
        return false;

    return this.isPathClear(loc);
};

Rook.prototype.moved = function() {
    this.wasMoved = true;
};

function Horse(id, loc, active, board) {
    Piece.call(this, id, loc, active, board);
}
Horse.prototype = new Piece();

Horse.prototype.isValidMove = function(loc) {
    if(!Piece.prototype.isValidMove.call(this, loc))
        return false;

    var olc = this.loc;

    if(Math.abs(olc[0] - loc[0]) === 1 && Math.abs(olc[1] - loc[1]) === 2)
        return true;

    if(Math.abs(olc[0] - loc[0]) === 2 && Math.abs(olc[1] - loc[1]) === 1)
        return true;

    return false;
};

function Bishop(id, loc, active, board) {
    Piece.call(this, id, loc, active, board);
}
Bishop.prototype = new Piece();

Bishop.prototype.isValidMove = function(loc) {
    if(!Piece.prototype.isValidMove.call(this, loc))
        return false;

    if(Math.abs(this.loc[0] - loc[0]) !== Math.abs(this.loc[1] - loc[1]))
        return false;

    return this.isPathClear(loc);
};

function Queen(id, loc, active, board) {
    Piece.call(this, id, loc, active, board);
}
Queen.prototype = new Piece();

Queen.prototype.isValidMove = function(loc) {
    var rValid = Rook.prototype.isValidMove.call(this, loc);
    var bValid = Bishop.prototype.isValidMove.call(this, loc);

    return rValid || bValid;
};

function King(id, loc, active, board) {
    Piece.call(this, id, loc, active, board);
    this.wasMoved = false;
}
King.prototype = new Piece();

King.prototype.moving = function(loc) {
    // if you are castling, move the rook as well
    // don't need to do error checking because it has been done previously
    if(Math.abs(loc[0] - this.loc[0]) === 2) {
        // we are castling
        var dir = sign(loc[0] - this.loc[0]);
        var rookLoc = dir > 0 ? [8, this.loc[1]] : [1, this.loc[1]];
        var rookDir = -1*dir;
        this.board.move(this.board.atLoc(rookLoc).id, [loc[0] + rookDir, loc[1]]);
    }
};

King.prototype.moved = function() {
    this.wasMoved = true;
};

King.prototype.isValidMove = function(loc) {
    if(!Piece.prototype.isValidMove.call(this, loc))
        return false;

    if(Math.abs(this.loc[0] - loc[0]) <= 1 && Math.abs(this.loc[1] - loc[1]) <= 1)
        return true;

    // castling
    if(!this.wasMoved && loc[1] === this.loc[1] && Math.abs(loc[0] - this.loc[0]) === 2) {
        var dir = sign(loc[0] - this.loc[0]);
        var rookLoc = dir > 0 ? [8, this.loc[1]] : [1, this.loc[1]];
        var rook = this.board.atLoc(rookLoc);

        // make sure it's a rook
        if(!(rook instanceof Rook))
            return false;

        if(rook.wasMoved)
            return false;

        if(!this.isPathClear(rookLoc))
            return false;

        // TODO: make sure king's path is not under attack

        return true;
    }
    return false;
};

module.exports = {
    Pawn: Pawn,
    Rook: Rook,
    Horse: Horse, // i know it's called a knight but k is for king
    Bishop: Bishop,
    Queen: Queen,
    King: King
};

