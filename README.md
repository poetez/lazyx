# lazyx

[![Latest Stable Version](https://img.shields.io/npm/v/lazyx.svg)](https://www.npmjs.com/package/lazyx)
[![License](https://img.shields.io/npm/l/lazyx.svg)](./LICENSE)
[![Build Status](https://img.shields.io/travis/poetez/lazyx/master.svg)](https://travis-ci.org/poetez/lazyx)
[![Test Coverage](https://img.shields.io/codecov/c/github/poetez/lazyx/master.svg)](https://codecov.io/gh/poetez/lazyx)

Lazyx is the predictable state container for JavaScript applications built on top of 
[RxJS 5](https://github.com/ReactiveX/rxjs). It is highly inspired by 
[Redux](https://github.com/reactjs/redux) and provides the same functional-style approach. 

In fact, Lazyx is just a thin layer on top of RxJS. It provides a system to use RxJS more effective 
and simplifies some regular actions. 

**Note**: It is an alpha release. API might change any time. Don't use in the production. 

## Install
```bash
$ npm install --save lazyx
```

## Basics
Lazyx is based on the idea of predefined data transformation pipe (aka Data Pipe). This idea is 
very like the Redux concept, so if you know it, you could find following descriptions very 
familiar. Lazyx is consists of three parts:
* Trigger,
* Transformer,
* Store.

### Trigger
Let's define Trigger at first.

Trigger is the start point of Data Pipe. It sends the information payload through to the Transformer
to change it current state and notify all its subscribers.

Trigger is the simple RxJS Subject, that you can import to the component module and use its `next` 
method to start the data transformation process.

Here is an example Trigger for creating a new todo item: 
```typescript
import {Subject} from 'rxjs';

const addTodo$ = new Subject();

addTodo$.next({
  text: 'Build my first Lazyx app',
});
```
If you have an observable sequence of observables like an array or an object, you can use special 
`SubjectMap` of Lazyx to simplify creating Trigger for sequence elements.
```typescript
import {SubjectMap} from 'lazyx';

const todoToggle$ = new SubjectMap();

const id = 1;
todoToggle$.get(id).next();
```
`SubjectMap` signature is following:
```typescript
interface SubjectMap {
  get(id: any); // get existing Subject with specified `id` or creates new one
  remove(id: any); // removes Subject with specified `id`
}
```
`SubjectMap` allows you to run the trigger with specified `id` and use only the one Transformer this
Subject belongs to. 

### Transformer
Transformer is the main part of Lazyx. It receives signals from a number of Triggers, changes inner 
state and sends the update to all subscribers it has. 

Here is an example of Transformer: 
```typescript
import {Observable, Subject} from 'rxjs';
import 'lazyx/es/add/operator/apply';

export const increase$ = new Subject();
export const decrease$ = new Subject();

export const counter$ = Observable.of(0)
  .merge(
    increase$.map(payload => state => state + payload),
    decrease$.map(payload => state => state - payload),
  )
  .apply();
```
**Note:** operator `apply` is the shorthand for `scan((state, reducer) => reducer(state))`.

If you expect that your Transformer would have dynamic initial state, just put it into the function:
```typescript
import {Observable} from 'rxjs';
import {SubjectMap} from 'lazyx';
import 'lazyx/es/add/operator/apply';

export const toggleTodo = new SubjectMap();

let id = 0;

const initialState = () => ({
  id: id++,
  text: '',
  completed: false,
});

function todo(state = initialState()) {
  return Observable.of(state)
    .merge(
      toggleTodo
        .get(state.id)
        .map(() => state => ({ ...state, completed: !state.completed }))
    )
    .apply();
}

export default todo;
```
We will call these functions `TransformerCreator`. They have following signature: 
```typescript
export interface TransformerCreator {
  <T>(state: T): Observable<T>;
  <T, U>(state: T): Observable<U>;
}
```

If you have an observable sequence to create, use special function `mergeCollection` provided by 
Lazyx.

It can be done in the following way:
```typescript
import {Observable, Subject} from 'rxjs';
import 'lazyx/es/add/operator/mergeCollection';
import todo from './todo'; // the function we defined in the previous example

export const addTodo = new Subject();
export const removeTodo = new Subject();

function todos(state = []) {
  return Observable.of(state)
    .mergeCollection(addTodo, removeTodo, todo)
    .apply();
}

export default todos;
```
Function `mergeCollection` has the following signature:
```typescript
type Reducer<T> = (state: T) => T;
type TransformerCreator = (state: T) => Observable<T>;

type ArrayState<T> = Observable<T>[];
type ObjectState = {[key: string]: Observable<any>};

function mergeCollection<T>(this: Observable<ArrayState<T>>, addTrigger: Subject<T>, removeTrigger: Subject<number>, create: TransformerCreator): Observable<Reducer<ArrayState<T>>>;
function mergeCollection(this: Observable<ObjectState>, addTrigger: Subject<[string, any]>, removeTrigger: Subject<string>, create: TransformerCreator): Observable<Reducer<ObjectState>>;
```
**Note:** if you use observable object, you have to send property key in the addition Trigger. 

### Store
Store is a global Transformers holder. It main responsibilities are following:
* Hold all the Transformers together in the hierarchical structure that improves accessibility and 
allows to pass them down, e.g., through the React context. 
* Provide tools to work with the dynamic initial state, e.g. if it is loaded from the server. 
* Provide tools for adding middlewares. 

To create a store you should use `createStore` function of Lazyx. It has following signature:
```typescript
function createStore(transformers: TransformersMap): Store;
function createStore(transformers: TransformersMap, initialState: JSONObject): Store;
function createStore(transformers: TransformersMap, middlewares: Middleware[]): Store;
function createStore(transformers: TransformersMap, initialState: JSONObject, middlewares: Middleware[]): Store;
```
Where: 
```typescript
interface TransformersMap {
  [key: string]: TransformersMap | TransformerCreator | Observable<any>
}
```
`JSONObject` represents standard JSON object, you can see its signature in [typings.d.ts](./src/typings.d.ts).

Store has following signature:
```typescript
export interface Store {
  attach(transformers: TransformersMap): void;
  getTree(): any;
}
```

**Note:** `initialState` should reflect transformers map but use data instead of transformers.

So, to create a store, just put your transformers to objects and send the final object to the 
`createStore` function. 
```typescript
import {createStore} from 'lazyx';
import todos from './todos';

const store = createStore({
  todos,
});

export default store;
```
Unfortunately, there are no typings for object returning by `getTree` method due to current Typescript restrictions 
([issue](https://github.com/Microsoft/TypeScript/issues/12424)). When this issue is solved, these typings will be added. 

## Advanced
### Middleware
Middleware is a function that starts after transformer produces its result but before this result 
is emitted to the subscribers. Middlewares is implemented with RxJS 
[let](https://www.learnrxjs.io/operators/utility/let.html) function, so, it can change the 
Transformer or let is unchanged. 

In common, middleware is a function that receives a Transformer and returns it. Middleware 
signature is following:
```typescript
export interface Middleware {
  <T>(transformer: Observable<T>): Observable<T>;
  <T, U>(transformer: Observable<T>): Observable<U>;
}
```
So, the simple middleware can look like following:
```typescript
function loggerMiddleware<T>(transformer: Observable<T>): Observable<T> {
  return transformer
    .do(({name, value}) => console.log(name, value));
}
```
Parameter `name` is the whole path to current Transformer in the Transformers map divided by 
period with `store` in the beginning. E.g. `"store.nested1.nested2"` for 
```typescript
const transformers = {
  nested1: {
    nested2: Observable.of(1)
  }
}
```

### Ajax
How can you create an ajax-request using Lazyx? You can use the `ajax` method of RxJS and combine it
with Transformers in the following way. 

Let's imagine that we want to get user data from Github API, take repository url from it and send
it to subscribers. User nickname will be sended by Trigger.
```typescript
import {Observable, Subject} from 'rxjs';

const loginTrigger = new Subject();

const repoUrl = Observable.of(null)
  .merge(
    loginTrigger,
  )
  .mergeMap(
    login => 
      login 
        ? Observable.ajax.getJSON(`https://api.github.com/users/${login}`)
            .map(response => response.html_url)
        : Observable.empty()
  )
```
As you can see, there is no Lazyx-specific stuff, only RxJS.

### Trigger Extending
If you want to make Trigger run stricter, you can just extend RxJS Subject and add methods that 
calls Subject's `next` method with predefined objects. For example:
```typescript
import {Subject} from 'rxjs';

class AddTodo extends Subject {
  next(text: string): void {
    super.next({ text });
  }
}

const addTodo$ = new AddTodo();

addTodo$.next('Build my first Lazyx app');
```

## License
[MIT](./LICENSE)
