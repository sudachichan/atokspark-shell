const child_process = require('child_process');
const EventEmitter = require('events').EventEmitter;
const fs = require('fs');
const marked = require('marked');
const Plugin = require('atokspark-jsplugin');

const LINE_TIMEOUT = 500; // 500ms 出力がなければコマンド終了とみなします。

function getPlatform() {
    const MacPlatform = {
        shellCommand: 'sh',
        prompt:       '$',
    };
    const WindowsPlatform = {
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

    const that = this;
    stream.on('data', function () {
        that.onData.apply(that, arguments);
    });
}
ShellOutput.prototype = {
    onData: function (data) {
        this.buffer = this.takeLines(this.buffer + data);
    },
    takeLines: function (buf) {
        const newLines = buf.split('\n');
        const notCompletedLine = newLines.pop();
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

    const that = this;
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

            const that = this;
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

const shell = new Shell(getPlatform());
Plugin.byRules({
    async: true,
    replaces: {
        'shell:(.*):': function (callback, matches) {
            var cmdline = matches[1];
            cmdline = cmdline.replace(/\+{1}/g, ' ');
            cmdline = cmdline.replace(/\+{2}/g, '+');
            shell.exec(cmdline, callback);
        }
    },
    views: {
        'shell:': function (callback) {
            fs.readFile(__dirname + '/README.md', 'utf8', function (err, data) {
                if (err) {
                    throw err;
                }
                
                const renderer = new marked.Renderer();
                renderer.code = function (code, language) {
                    return '<pre style="background-color: lightgray;">' + code + '</pre>';
                };
                renderer.codespan = function (code) {
                    code = code.replace(' ', '&nbsp;');
                    return '<code style="background-color: lightgray;">' + code + '</code>';
                };
                callback(marked(data, { renderer: renderer }));
            });
        }
    }
});