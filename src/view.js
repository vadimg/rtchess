var common = require('./common');
var config = require('./config');
var EventEmitter = require('events').EventEmitter;

var PIECES = {};

(function() {
    var pieces = 'kqrbhp';
    var charcode = 9812;
    var colors = 'wb';
    for(var i=0; i < 2; ++i) {
        var color = colors[i];
        for(var j=0, l=pieces.length; j < l; ++j) {
            var piece = pieces[j];
            var s = '&#' + charcode + ';';
            PIECES[color + piece] = s;
            charcode++;
        }
    }
})();

function pieceChar(piece) {
    return PIECES[piece.substr(0, 2)];
}

function drawBoard(board) {
    var $cb = $('#chess-board');

    // clear everything in the board
    $cb.children().remove();

    var white = board.color === 'w';

    var blackCell = false;
    var left = 0;
    var top = 0;

    for(var i=0; i < 8; ++i) {
        var n = white ? 8 - i : i + 1;

        for(var l=0; l < 8; ++l) {
            var letter = white ? common.LETTERS[l] : common.LETTERS[8-l-1];

            var cell = letter + n;
            $cb.append('<div id="' + cell + '" class="chess-cell"></div>');
            $cell = $('#' + cell);
            if(blackCell) {
                $cell.addClass('black-cell');
            }
            $cell.css('top', top).css('left', left);
            left += config.SIZE;
            if(left >= config.SIZE*8) {
                left = 0;
                top += config.SIZE;
            } else {
                blackCell = !blackCell;
            }

            //$('#' + cell).append(cell);
        }
    }
    $cb.click(makeClickBoard(board));
}

function makeClickPiece(board) {
    return function(e) {
        return clickPiece(e, board);
    };
}

function clickPiece(e, board) {
    console.log('piece click');
    var $piece = $(e.target);

    // don't select immovable pieces
    if(!$piece.hasClass('clickable'))
        return false;

    // don't select enemy pieces
    if($piece.hasClass('piece-enemy')) {
        // you can treat enemy pieces as part of the board
        return clickBoard(e, board);
    }

    // don't do anything if piece is already selected
    if($piece.hasClass('piece-selected')) {
        return false;
    }

    // remove selections from all other pieces
    $('.piece-selected').removeClass('piece-selected');

    $piece.addClass('piece-selected');
    var $cb = $('#chess-board');
    $cb.addClass('clickable');
    $('.piece-enemy').addClass('clickable');
    return false;
}

function makeClickBoard(board) {
    return function(e) {
        return clickBoard(e, board);
    };
}

function clickBoard(e, board) {
    console.log('cb click');

    var $cb = $('#chess-board');
    if(!$cb.hasClass('clickable'))
        return false;

    var $piece = $('.piece-selected');
    var to = $(e.target).position();

    // make sure you can move here
    var loc = board.pos2loc(to);
    var pid = $piece.attr('id');

    view.emit('moveRequest', pid, loc);

    return false;
}

function bindEvents(emitter, board) {
    emitter.on('addPiece', function(id, loc) {
        console.log('adding', id);
        var pos = board.loc2pos(loc);
        var $cb = $('#chess-board');
        $cb.append('<div class="piece" id="' + id + '"><div class="piece-spacer"></div>' + pieceChar(id) + '</div>');
        var $piece = $('#' + id);
        $piece.css('top', pos.top).css('left', pos.left);
        $piece.click(makeClickPiece(board));
    });

    emitter.on('activatePiece', function(id) {
        var $piece = $('#' + id);
        if(id[0] !== board.color) {
            $piece.addClass('piece-enemy');
            return;
        }
        $piece.addClass('clickable');
    });

    emitter.on('removePiece', function(id) {
        $('#' + id).remove();
    });

    emitter.on('movePiece', function(id, loc) {
        var $cb = $('#chess-board');
        var $piece = $('#' + id);
        $cb.removeClass('clickable');
        $('.piece-enemy').removeClass('clickable');
        $piece.removeClass('piece-selected');
    });

    emitter.on('movingPiece', function(id, from, to, ratio) {
        var fromPos = board.loc2pos(from);
        var toPos = board.loc2pos(to);

        // calculate deltas
        var dtop = ratio*(toPos.top - fromPos.top);
        var dleft = ratio*(toPos.left - fromPos.left);

        var $piece = $('#' + id);
        $piece.removeClass('clickable');
        $piece.css('top', fromPos.top + dtop).css('left', fromPos.left + dleft);
    });

    emitter.on('immobilePiece', function(id) {
        var tid = id + '-timer';
        var $piece = $('#' + id);
        $piece.append('<div class="timer" id="' + tid + '"></div>');
    });

    emitter.on('immobilePieceTimer', function(id, ratio) {
        var tid = id + '-timer';
        var $timer = $('#' + tid);

        var top = config.SIZE * (1-ratio);
        var height = config.SIZE * ratio;
        $timer.css('top', top).css('height', height);
    });

    emitter.on('mobilePiece', function(id) {
        var tid = id + '-timer';
        var $timer = $('#' + tid);
        var $piece = $('#' + id);

        $timer.remove();
        // it's my piece
        if(id[0] === board.color)
            $piece.addClass('clickable');
    });

    emitter.on('gameOver', function(winner) {
        var $cb = $('#chess-board');
        $cb.append('<div class="message">Game over! ' + winner + ' wins!</div>');
    });
}

var view = new EventEmitter;

module.exports = {
    drawBoard: drawBoard,
    bindEvents: bindEvents,
    view: view
};
