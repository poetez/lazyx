import * as isPlainObject from 'is-plain-object';
import {Observable} from 'rxjs/Observable';
import {of} from 'rxjs/observable/of';
import {map} from 'rxjs/operator/map';
import {merge} from 'rxjs/operator/merge';
import {mergeMap} from 'rxjs/operator/mergeMap';
import {Subject} from 'rxjs/Subject';
import {Reducer, TransformerCreator} from '../typings';

export type ArrayState<T> = Observable<T>[];
export type ArrayAddPayload<T> = T;
export type ArrayRemovePayload = number;

export type ObjectState = {[key: string]: Observable<any>};
export type ObjectAddPayload = [string, any];
export type ObjectRemovePayload = string;

/* tslint:disable:max-line-length */
export default function mergeSequence<T>(this: Observable<ArrayState<T>>, addTrigger: Subject<ArrayAddPayload<T>>, removeTrigger: Subject<ArrayRemovePayload>, create: TransformerCreator): Observable<Reducer<ArrayState<T>>>;
export default function mergeSequence(this: Observable<ObjectState>, addTrigger: Subject<ObjectAddPayload>, removeTrigger: Subject<ObjectRemovePayload>, create: TransformerCreator): Observable<Reducer<ObjectState>>;
/* tslint:enable:max-line-length */

export default function mergeSequence(
  this: any,
  addTrigger: any,
  removeTrigger: any,
  create: TransformerCreator,
): any {
  return mergeMap.call(
    this,
    (state: any) => {
      if (!Array.isArray(state) && !isPlainObject(state)) {
        throw new TypeError('Observable value for "mergeSequence" should be an array or a plain object');
      }

      const initial = of.call(this, state);
      const args = [addTrigger, removeTrigger, create];

      if (Array.isArray(state)) {
        return mergeArray.apply(initial, args);
      }

      return mergeObject.apply(initial, args);
    },
  );
}

function mergeArray<T>(
  this: Observable<ArrayState<T>>,
  addTrigger: Subject<ArrayAddPayload<T>>,
  removeTrigger: Subject<ArrayRemovePayload>,
  create: TransformerCreator,
): Observable<Reducer<ArrayState<T>>> {
  const addMapped = map.call(
    addTrigger,
    (payload: ArrayAddPayload<T>) => (state: ArrayState<T>) => {
      const element = create(payload);
      state.push(element);

      return state;
    },
  );

  const removeMapped = map.call(
    removeTrigger,
    (payload: ArrayRemovePayload) =>
      (state: ArrayState<T>) =>
        state.filter((_, index) => index !== payload),
  );

  return merge.call(
    this,
    addMapped,
    removeMapped,
  );
}

function mergeObject(
  this: Observable<ObjectState>,
  addTrigger: Subject<ObjectAddPayload>,
  removeTrigger: Subject<ObjectRemovePayload>,
  create: TransformerCreator,
): Observable<Reducer<ObjectState>> {
  const addMapped = map.call(
    addTrigger,
    ([key, value]: ObjectAddPayload) => (state: ObjectState) => {
      state[key] = create(value);

      return state;
    },
  );

  const removeMapped = map.call(
    removeTrigger,
    (key: ObjectRemovePayload) => (state: ObjectState) => {
      delete state[key];

      return state;
    },
  );

  return merge.call(
    this,
    addMapped,
    removeMapped,
  );
}
