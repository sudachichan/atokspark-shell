var Plugin = require('atokspark-jsplugin');
var EventEmitter = require('events').EventEmitter;
var child_process = require('child_process');

var LINE_TIMEOUT = 500; // 500ms 出力がなければコマンド終了とみなします。

function getPlatform() {
    var MacPlatform = {
        shellCommand: 'sh',
        prompt:       '$',
    };
    var WindowsPlatform = {
        shellCommand: 'cmd',
        prompt:       '>',
    };
    switch (process.platform) {
    case 'darwin':  return MacPlatform;
    case 'win32':   return WindowsPlatform;
    default:        throw "サポートされていないプラットフォームです。";
    }
}

function ShellOutput(stream) {
    this.stream = stream;
    this.buffer = '';    
    this.emitter = new EventEmitter();

    var that = this;
    stream.on('data', function () {
        that.onData.apply(that, arguments);
    });
}
ShellOutput.prototype = {
    onData: function (data) {
        this.buffer = this.takeLines(this.buffer + data);
    },
    takeLines: function (buf) {
        var newLines = buf.split('\n');
        var notCompletedLine = newLines.pop();
        this.emitter.emit('lines', newLines);
        return notCompletedLine;
    },
    reset: function () {
        this.buffer = '';
    },
};

function Shell(platform) {
    this.platform = platform;
    this.child = child_process.spawn(platform.shellCommand, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.lines = [];
    this.lastLines = -1;

    var that = this;
    this.stdout = new ShellOutput(this.child.stdout);
    this.stdout.emitter.on('lines', function (newLines) {
        that.lines = that.lines.concat(newLines);
    });
    this.stderr = new ShellOutput(this.child.stderr);
    this.stderr.emitter.on('lines', function (newLines) {
        that.lines = that.lines.concat(newLines);
    });
}
Shell.prototype = {
    exec: function (cmdline, callback) {
        this.lines.push(this.platform.prompt + ' ' + cmdline);
        this.child.stdin.write(cmdline + '\n');
        this.waitOutputDone(callback);
    },
    waitOutputDone: function (callback) {
        if (this.lastLines === this.lines.length) {
            this.lines.push(''); // 改行を調整しています。
            callback(this.lines.join('\n'));
            this.reset();
        } else {
            this.lastLines = this.lines.length;

            var that = this;
            setTimeout(function () {
                that.waitOutputDone(callback);
            }, LINE_TIMEOUT)
        }
    },
    reset: function () {
        this.lines = [];
        this.lastLines = -1;
        this.stdout.reset();
        this.stderr.reset();
    }
};

var MAX_COMMANDS = 5;
var commands = [];
var index = 0;

var shell = new Shell(getPlatform());
var plugin = new Plugin().run();
plugin.on('check', function (text, callback) {
    var matches = /shell:(.*):/.exec(text);
    if (!matches) {
        callback(null);
        return;
    }
    commands[index] = matches[1];
    callback(index);
    index = (index + 1) % MAX_COMMANDS;
});
plugin.on('gettext', function (token, callback) {
    var cmdline = commands[token];
    cmdline = cmdline.replace(/\+{1}/, ' ');
    cmdline = cmdline.replace(/\+{2}/, '+');
    shell.exec(cmdline, callback);
});
