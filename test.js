const path = require('path');
const Store = require(path.join(__dirname, 'index.js'));


// let key = Store._prepareKey("123");
// console.log('key', key);

// let msg = "hello world";

// let cipher = Store._encrypt(msg, key);
// console.log('cipher', cipher);
// let answer = Store._decrypt(cipher, key);
// console.log('answer', answer);

let check = Store.checkKey('store.json', '1232');
console.log(check);
return;

let store = new Store({
    path: 'store.json',
    key: '123'
});

store.set('key', 'val');
store.set('col2', 'key1', 'val2');


let data = store.get('col2', 'key1');
let col = store.get('col2');

console.log(data);
console.log(col);