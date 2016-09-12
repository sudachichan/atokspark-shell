# atokspark-shell

コマンドの実行結果を入力する ATOK Spark プラグインです。

## 使い方の例

`shell:ls:` と入力すると、プラグインのあるディレクトリのファイル一覧を入力します。
`shell:pwd:` でカレントディレクトリ、 `shell:cd+foo/bar:` で foo/bar/ にカレントディレクトリを移動できます。

最後の例のようにコマンドライン中に記述したい空白文字は、代わりに `+` を使ってください。
(ATOK Spark は空白文字を入力するとそこで処理を中断してしまうようです。)

## How to run

以下のコマンドでエラーが出なければ動作するはずです。
```
$ git clone https://github.com/sudachichan/atokspark-shell.git
$ cd atokspark-shell
$ npm update
$ npm run test
```

(※Windowsではまだテストが正常に動作していません。)

なお、 ATOK Spark の plugin.lst には以下のように指定してください。(Mac, nodebrew で node.js をインストールしている場合の例)
```
/Users/YOUR_ACCOUNT/.nodebrew/current/bin/node PATH/TO/shell.js
```
- `YOUR_ACCOUNT`: あなたのユーザ名
- `PATH/TO/shell.js`: shell.js がチェックアウトされたパス
