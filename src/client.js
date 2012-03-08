(function(){

var view = require('./view');
var Board = require('./board');

window.startRoom = function(room_id) {
    var SIDES = ['black', 'white'];
    var socket = io.connect();
    console.log('connecting');
    socket.on('connect', function() {
        socket.emit('init', room_id);
    });
    socket.on('sideTaken', function(side) {
        $('#sit-' + side).attr('disabled', 'disabled');
    });
    socket.on('sideFree', function(side) {
        $('#sit-' + side).removeAttr('disabled');
    });
    socket.on('gotSide', function(side) {
        for(var i=0, l=SIDES.length; i < l; ++i)
            $('#sit-' + SIDES[i]).attr('disabled', 'disabled');
        sit(side);
        $('#start-game').removeAttr('disabled');
    });
    socket.on('starting', function(secs) {
        $('#chess-board').append('<div class="message" id="starting-message">Game starting in <span id="starting-secs"></span> seconds</div>');
        secs -= 0; // convert to number
        function countDown() {
            if(secs === 0) {
                board.startGame();
                $('#starting-message').remove();
            }
            $('#starting-secs').text(secs);
            secs -= 1;
            setTimeout(countDown, 1000);
        }
        countDown();
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
        $('#chess-board').append('<div class="message" id="wait-message">Waiting for opponent to press start...</div>');
    });

    var board;
    function sit(side) {
        board = new Board(side[0]);
        view.bindEvents(board);
        view.drawBoard(board);
        board.addPieces();
    }

};

})();
