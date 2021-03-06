const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const assert = require('assert');
const sha256 = require('js-sha256');
var sodium = require('sodium-native');

class Store {

    constructor(opts) {
        if (!opts.key) {
            throw new Error('Encryption key must not be empty.');
        }
        const defaults = {
            path: 'store.json'
        };

        Object.assign(defaults, opts);
        this.events = new EventEmitter();
        this.key = Store._prepareKey(opts.key);
        this.path = path.resolve(opts.path);

        if (fs.existsSync(this.path)) {
            if (!Store.checkKey(this.path, opts.key)) {
                throw new Error("Invalid encryption key for this file");
            }
        } else {
            this._initStoreFile();
        }
    }

    import (dump) {
        let cipher = Store._encrypt(JSON.stringify(dump), this.key);
        return fs.writeFileSync(this.path, cipher.toString('utf8'));
    }

    static _hash(pwd, iter) {
        var i = 0;
        var hash = new Uint8Array(0);
        while (i < iter) {
            hash = sha256(pwd);
            hash = Buffer.from(hash, 'hex');
            pwd = hash;
            i++;
        }
        return new Buffer(hash); //.toString('hex');;
    }

    static _prepareKey(key) {
        return Store._hash(key, 100000);
    }

    _initStoreFile() {
        // Encrypt
        let obj = {
            version: '1',
            storage: {},
        };
        let cipher = Store._encrypt(JSON.stringify(obj), this.key);
        return fs.writeFileSync(this.path, cipher.toString('utf8'));
    }

    delete() {
        fs.unlinkSync(this.path);
    }

    static checkKey(path, pwd) {
        if (fs.existsSync(path)) {
            let key = Store._prepareKey(pwd);
            let ciphertext = fs.readFileSync(path).toString();
            let bytes = Store._decrypt(ciphertext, key);
            if (!bytes) {
                return false;
            }
        }
        return true;
    }

    static _encrypt(msg, key) {
        var nonce = new Buffer(sodium.crypto_secretbox_NONCEBYTES);

        var message = new Buffer(msg);
        var cipher = new Buffer(message.length + sodium.crypto_secretbox_MACBYTES);

        sodium.randombytes_buf(nonce); // insert random data into nonce

        sodium.crypto_secretbox_easy(cipher, message, nonce, key);
        return nonce.toString('hex') + cipher.toString('hex');
    }

    static _decrypt(msg, key) {
        let nonceHex = msg.substring(0, sodium.crypto_secretbox_NONCEBYTES * 2);
        let cipherHex = msg.substring(sodium.crypto_secretbox_NONCEBYTES * 2);

        let nonce = Buffer.from(nonceHex, 'hex');
        let cipher = Buffer.from(cipherHex, 'hex');

        var plainText = new Buffer(cipher.length - sodium.crypto_secretbox_MACBYTES);
        if (!sodium.crypto_secretbox_open_easy(plainText, cipher, nonce, key)) {
            return false;
        } else {
            return plainText.toString('utf8');
        }
    }

    _read() {
        let ciphertext = fs.readFileSync(this.path).toString();
        let bytes = Store._decrypt(ciphertext, this.key);
        return JSON.parse(bytes.toString('utf8'));
    }

    dump() {
        return this._read();
    }

    get(p0, p1) {
        var col, key;
        if (p1) {
            col = p0;
            key = p1;
        } else {
            key = p0;
        }
        let data = this._read();

        if (col) {
            if (data.storage[col]) {
                return data.storage[col][key];
            }
        } else {
            return data.storage[key];
        }

        return null;
    }

    set(p0, p1, p2) {
        var col, key, val;
        if (p2) {
            col = p0;
            key = p1;
            val = p2;
        } else {
            key = p0;
            val = p1;
        }

        if (typeof key !== 'string' && typeof key !== 'object') {
            throw new TypeError(`Expected \`key\` to be of type \`string\` or \`object\`, got ${typeof key}`);
        }

        var data = this._read();
        if (col) {
            if (!data.storage[col]) {
                data.storage[col] = {};
            }
            data.storage[col][key] = val;
        } else {
            data.storage[key] = val;
        }

        let cipher = Store._encrypt(JSON.stringify(data), this.key);

        fs.writeFileSync(this.path, cipher.toString('utf8'));
        this.events.emit('change');
    }

    onDidChange(p0, p1, p2) {
        var col, key, callback;
        if (p2) {
            col = p0;
            key = p1;
            callback = p2;
        } else {
            key = p0;
            callback = p1;
        }

        if (col) {
            if (typeof col !== 'string') {
                throw new TypeError(`Expected \`col\` to be of type \`string\`, got ${typeof col}`);
            }
        }

        if (typeof key !== 'string') {
            throw new TypeError(`Expected \`key\` to be of type \`string\`, got ${typeof key}`);
        }

        if (typeof callback !== 'function') {
            throw new TypeError(`Expected \`callback\` to be of type \`function\`, got ${typeof callback}`);
        }

        let currentValue = col ? this.get(col, key) : this.get(key);

        const onChange = () => {
            const oldValue = currentValue;
            const newValue = col ? this.get(col, key) : this.get(key);

            try {
                assert.deepEqual(newValue, oldValue);
            } catch (err) {
                currentValue = newValue;
                callback.call(this, newValue, oldValue);
            }
        };

        this.events.on('change', onChange);
        return () => this.events.removeListener('change', onChange);
    }

    changeKey(oldPwd, newPwd, cb) {
        const oldKey = Store._prepareKey(oldPwd);
        if (oldKey.toString('hex') != this.key.toString('hex')) {
            console.log(oldKey);
            console.log(this.key);
            throw new Error("Invalid key");
        }
        const newKey = Store._prepareKey(newPwd);

        let copy = this.path + ".copy";

        let that = this;
        copyFile(this.path, copy, function() {
            let copyStore = new Store({
                path: copy,
                key: oldPwd,
            });
            let dump = copyStore.dump();
            that.delete();

            that.key = newKey;
            that.import(dump);

            copyStore.delete();
            copyStore = null;

            if (cb && typeof cb === "function") {
                cb();
            }
        });
    }
}

module.exports = Store;

function copyFile(source, target, cb) {
    var cbCalled = false;

    var rd = fs.createReadStream(source);
    rd.on("error", function(err) {
        done(err);
    });
    var wr = fs.createWriteStream(target);
    wr.on("error", function(err) {
        done(err);
    });
    wr.on("close", function(ex) {
        done();
    });
    rd.pipe(wr);

    function done(err) {
        if (!cbCalled) {
            cb(err);
            cbCalled = true;
        }
    }
}