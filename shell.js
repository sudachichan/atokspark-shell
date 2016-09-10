'use strict'
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

class ShellOutput extends EventEmitter {
    constructor(stream) {
        super();
        this.stream = stream;
        this.buffer = '';    

        stream.on('data', (data) => {
            this.buffer = this.takeLines(this.buffer + data);
        });
    }
    takeLines(buf) {
        const newLines = buf.split('\n');
        const notCompletedLine = newLines.pop();
        this.emit('lines', newLines);
        return notCompletedLine;
    }
    reset() {
        this.buffer = '';
    }
}

class Shell {
    constructor(platform) {
        this.platform = platform;
        this.child = child_process.spawn(platform.shellCommand, [], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });
        this.lines = [];
        this.lastLines = -1;

        this.stdout = new ShellOutput(this.child.stdout);
        this.stdout.on('lines', (newLines) => {
            this.lines = this.lines.concat(newLines);
        });
        this.stderr = new ShellOutput(this.child.stderr);
        this.stderr.on('lines', (newLines) => {
            this.lines = this.lines.concat(newLines);
        });
    }    
    exec(cmdline, callback) {
        this.lines.push([this.platform.prompt, cmdline].join(' '));
        this.child.stdin.write(cmdline + '\n');
        this.waitOutputDone(callback);
    }
    waitOutputDone(callback) {
        if (this.lastLines === this.lines.length) {
            this.lines.push(''); // 改行を調整しています。
            callback(this.lines.join('\n'));
            this.reset();
        } else {
            this.lastLines = this.lines.length;

            setTimeout(() => {
                this.waitOutputDone(callback);
            }, LINE_TIMEOUT)
        }
    }
    reset() {
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
        'shell:(.*):': (callback, matches) => {
            let cmdline = matches[1];
            cmdline = cmdline.replace(/\+{1}/g, ' ');
            cmdline = cmdline.replace(/\+{2}/g, '+');
            shell.exec(cmdline, callback);
        }
    },
    views: {
        'shell:': (callback) => {
            fs.readFile(`${__dirname}/README.md`, 'utf8', (err, data) => {
                if (err) {
                    throw err;
                }
                
                const renderer = new marked.Renderer();
                renderer.code = function (code, language) {
                    return `<pre style="background-color: lightgray;">${code}</pre>`;
                };
                renderer.codespan = function (code) {
                    code = code.replace(' ', '&nbsp;');
                    return `<code style="background-color: lightgray;">${code}</code>`;
                };
                callback(marked(data, { renderer: renderer }));
            });
        }
    }
});