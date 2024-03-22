const a = new WeakMap();

const b = () => 'hello';

a.set(b, 'world');

console.log(a.get(b));
