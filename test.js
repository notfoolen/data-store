const path = require('path');
const Store = require(path.join(__dirname, 'index.js'));


// let key = Store._prepareKey("123");
// console.log('key', key);

// let msg = "hello world";

// let cipher = Store._encrypt(msg, key);
// console.log('cipher', cipher);
// let answer = Store._decrypt(cipher, key);
// console.log('answer', answer);

let store = new Store({
    path: 'store.json',
    key: '444'
});

store.set('key', 'val');
store.set('col2', 'key1', 'val1');

store.onDidChange('col2', function(newValue, oldValue) {
    console.log('onDidChange', 'col2', newValue, oldValue);
});

store.set('col2', 'key3', 'val3');
store.set('col2', 'key3', 'val3');
store.set('col2', 'key4', 'val4');
store.set('col2', 'key5', 'val5');


let data = store.get('col2', 'key1');
let col = store.get('col2');

console.log(data);
console.log(col);

// store.changeKey('123', '444', function() {
//     console.log('change key succeeded');
// });