(function(){

var view = require('./view');
var common = require('./common');
var Board = require('./board');

window.startRoom = function(room_id) {
    var SIDES = ['black', 'white'];
    var socket = io.connect();
    console.log('connecting');
    socket.on('connect', function() {
        socket.emit('init', room_id);
        console.log('connected');
        $('#disconnect-message').remove();
    });
    socket.on('disconnect', function() {
        $('#chess-board').append('<div class="message" id="disconnect-message">You are disconnected. If you do not reconnect automatically, try refreshing the page.</div>');
    });
    socket.on('sideTaken', function(side) {
        $('#sit-' + side).attr('disabled', 'disabled');
    });
    socket.on('sideFree', function(side) {
        console.log('sidefree', side);
        $('#sit-' + side).removeAttr('disabled');
    });
    socket.on('gotSide', function(side) {
        $('#sit-' + side).attr('disabled', 'disabled');
        mySide = side;
        $('#start-game').removeAttr('disabled');
        $('.message').remove();
    });
    socket.on('starting', function(secs) {
        start();
        $('.message').remove();
        $('#chess-board').append('<div class="message" id="starting-message">Game starting in <span id="starting-secs"></span> seconds</div>');
        secs -= 0; // convert to number
        function countDown() {
            if(secs === 0) {
                $('#starting-message').remove();
                return;
            }
            $('#starting-secs').text(secs);
            secs -= 1;
            setTimeout(countDown, 1000);
        }
        countDown();
    });

    socket.on('playerDisconnected', function(color) {
        var prettyColor = common.letter2color(color);
        $('.message').remove();
        $('#chess-board').append('<div class="message" id="disconnect-message">' + prettyColor + ' was disconnected!</div>');
        $('#start-game').removeAttr('disabled');
    });
    socket.on('gameOver', function(winner) {
        var color = common.letter2color(winner);
        var $cb = $('#chess-board');
        $cb.append('<div class="message">Game over! ' + color + ' wins!</div>');
        $('#start-game').removeAttr('disabled');
    });


    $('#sit-white').click(function() {
        socket.emit('chooseSide', 'white');
    });
    $('#sit-black').click(function() {
        socket.emit('chooseSide', 'black');
    });
    $('#start-game').click(function() {
        $('#start-game').attr('disabled', 'disabled');
        socket.emit('startGame');
        $('.message').remove();
        $('#chess-board').append('<div class="message" id="wait-message">Waiting for opponent to press start...</div>');
    });

    var board;
    var mySide;
    function start() {
        board = new Board(mySide[0]);
        view.unbindEvents(socket);
        view.bindEvents(socket, board);
        view.view.on('moveRequest', function(id, loc) {
            socket.emit('moveRequest', id, loc);
        });
        view.drawBoard(board);
    }

};

})();
