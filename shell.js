'use strict'
const child_process = require('child_process');
const EventEmitter = require('events').EventEmitter;
const fs = require('fs');
const iconv = require('iconv-lite');
const marked = require('marked');
const Plugin = require('atokspark-jsplugin');

const LINE_TIMEOUT = 500; // 500ms 出力がなければコマンド終了とみなします。

function getPlatform() {
    const MacPlatform = {
        shellCommand: 'sh',
        prompt: function (shell, cmdline) {
            shell.lines = [['$', cmdline].join(' ')];
            shell.stdout.reset();
        },
        convert: function (data) {
            return data;
        },
    };
    const WindowsPlatform = {
        shellCommand: 'cmd',
        prompt: function (shell, cmdline) {
            shell.lines = [];
            shell.stdout.reset('>');
        },
        convert: function (data) {
            return iconv.decode(data, 'Windows-31J');
        },
    };
    switch (process.platform) {
    case 'darwin':  return MacPlatform;
    case 'win32':   return WindowsPlatform;
    default:        throw "サポートされていないプラットフォームです。";
    }
}

class ShellOutput extends EventEmitter {
    constructor(platform, stream) {
        super();
        this.stream = stream;
        this.buffer = '';    

        stream.on('data', (data) => {
            this.buffer = this.takeLines(this.buffer + platform.convert(data));
        });
    }
    takeLines(buf) {
        const newLines = buf.split('\n');
        const notCompletedLine = newLines.pop();
        this.emit('lines', newLines);
        return notCompletedLine;
    }
    reset(text) {
        this.buffer = text ? text : '';
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

        this.stdout = new ShellOutput(platform, this.child.stdout);
        this.stdout.on('lines', (newLines) => {
            this.lines = this.lines.concat(newLines);
        });
        this.stderr = new ShellOutput(platform, this.child.stderr);
        this.stderr.on('lines', (newLines) => {
            this.lines = this.lines.concat(newLines);
        });
    }    
    exec(cmdline, callback) {
        this.reset(cmdline);
        this.child.stdin.write(cmdline + '\n');
        this.waitOutputDone(callback);
    }
    waitOutputDone(callback) {
        if (this.lastLines === this.lines.length) {
            this.lines.push(''); // 改行を調整しています。
            callback(this.lines.join('\n'));
        } else {
            this.lastLines = this.lines.length;

            setTimeout(() => {
                this.waitOutputDone(callback);
            }, LINE_TIMEOUT)
        }
    }
    reset(cmdline) {
        this.lastLines = -1;
        this.platform.prompt(this, cmdline);
        this.stderr.reset();
    }
};

const shell = new Shell(getPlatform());
const shellPlugin = Plugin.byRules({
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
                    return `<code style="background-color: lightgray;">${code}</code>`;
                };
                const html = marked(data, { renderer: renderer });
                callback(`<html xmlns="http://www.w3.org/1999/xhtml"><body>${html}</body></html>`);
            });
        }
    }
});

module.exports = shellPlugin;
if (require.main === module) {
    shellPlugin.run();
}
