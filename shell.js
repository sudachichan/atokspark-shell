var Plugin = require('atokspark-jsplugin');

var child_process = require('child_process');
var child = child_process.spawn('sh', [], {
    stdio: ['pipe', 'pipe', 'pipe'],
});
var stdout = '';
var stderr = '';
child.stdout.on('data', function (data) {
    stdout = takeLines(stdout + data);
});
child.stderr.on('data', function (data) {
    stderr = takeLines(stderr + data);
});
var lines = [];
function takeLines(buf) {
    var newLines = buf.split('\n');
    while (newLines.length > 0) {
        lines.push(newLines.shift());
    }
    return lines[0];
}

var MAX_COMMANDS = 5;
var LINE_TIMEOUT = 500; // 500ms 出力がなければコマンド終了とみなします。
var commands = [];
var index = 0;

var shell = new Plugin().run();
shell.on('check', function (text, callback) {
    var matches = /shell:(.*):/.exec(text);
    if (!matches) {
        callback(null);
        return;
    }
    commands[index] = matches[1];
    callback(index);
    index = (index + 1) % MAX_COMMANDS;
});
shell.on('gettext', function (token, callback) {
    var cmdline = commands[token];
    cmdline = cmdline.replace(/\+{1}/, ' ');
    cmdline = cmdline.replace(/\+{2}/, '+');
    lines.push('$ ' + cmdline);
    child.stdin.write(cmdline + '\n');
    var lastLines = 0;
    function checkOutput() {
        if (lastLines == lines.length) {
            // 500ms 出力がなければコマンドの実行が終わったと見なします。
            callback(lines.join('\n'));
            lines = [];
            stdout = '';
            stderr = '';
        } else {
            lastLines = lines.length;
            setTimeout(checkOutput, LINE_TIMEOUT);
        }
    };
    setTimeout(checkOutput, LINE_TIMEOUT);
});
