var FULFILLED, PENDING, Promise, PureObject, REJECTED, Tracer, Type, assert, assertType, bind, emptyFunction, has, hasKeys, immediate, isType, sync, type;

require("isDev");

emptyFunction = require("emptyFunction");

PureObject = require("PureObject");

assertType = require("assertType");

immediate = require("immediate");

hasKeys = require("hasKeys");

Tracer = require("tracer");

isType = require("isType");

assert = require("assert");

Type = require("Type");

sync = require("sync");

bind = require("bind");

has = require("has");

PENDING = Symbol("Promise.PENDING");

FULFILLED = Symbol("Promise.FULFILLED");

REJECTED = Symbol("Promise.REJECTED");

type = Type("Promise");

type.defineValues({
  _state: PENDING,
  _unhandled: true,
  _results: function() {
    return [void 0];
  },
  _queue: function() {
    return [];
  },
  _tracers: isDev && function() {
    return {};
  }
});

type.initInstance(function(result) {
  this._inherit(arguments, 1);
  if (result !== PENDING) {
    return this._tryFulfilling(result);
  }
});

type.definePrototype({
  state: {
    get: function() {
      if (this.isFulfilled) {
        return "fulfilled";
      } else if (this.isRejected) {
        return "rejected";
      } else {
        return "pending";
      }
    }
  },
  isPending: {
    get: function() {
      return this._state === PENDING;
    }
  },
  isFulfilled: {
    get: function() {
      return this._state === FULFILLED;
    }
  },
  isRejected: {
    get: function() {
      return this._state === REJECTED;
    }
  }
});

type.defineMethods({
  trace: function() {
    return this._tracers.init && this._tracers.init()[1].stack;
  },
  inspect: function() {
    var promise;
    promise = {
      state: this.state
    };
    if (this.isFulfilled) {
      promise.value = this._results[0];
    } else if (this.isRejected) {
      promise.error = this._results[0];
    }
    if (this._results.length > 1) {
      promise.meta = this._results.slice(1);
    }
    return promise;
  },
  then: function(onFulfilled, onRejected) {
    var promise;
    assertType(onFulfilled, Function.Maybe);
    assertType(onRejected, Function.Maybe);
    promise = Promise(PENDING);
    isDev && (promise._tracers.init = Tracer("promise.then()"));
    this._then(promise, onFulfilled, onRejected);
    return promise;
  },
  fail: function(onRejected) {
    var promise;
    assertType(onRejected, Function.Maybe);
    promise = Promise(PENDING);
    isDev && (promise._tracers.init = Tracer("promise.fail()"));
    this._then(promise, void 0, onRejected);
    return promise;
  },
  always: function(onResolved) {
    var promise;
    assertType(onResolved, Function);
    promise = Promise(PENDING);
    isDev && (promise._tracers.init = Tracer("promise.always()"));
    this._always(function(parent) {
      var error, value;
      try {
        value = onResolved();
      } catch (error1) {
        error = error1;
        promise._reject(error);
        return;
      }
      if (isType(value, Promise)) {
        return value._always(function() {
          if (value.isRejected) {
            return promise._reject(value._results[0]);
          } else {
            promise._inherit(parent._results, 1);
            return promise._resolve(parent);
          }
        });
      }
      promise._inherit(parent._results, 1);
      return promise._resolve(parent);
    });
    return promise;
  },
  notify: function(callback) {
    var promise;
    if (!callback) {
      return this;
    }
    assertType(callback, Function);
    promise = Promise(PENDING);
    isDev && (promise._tracers.init = Tracer("promise.notify()"));
    this._always(function(parent) {
      var callbackError, error, result;
      promise._inherit(parent._results, 1);
      if (parent.isRejected) {
        error = parent._results[0];
      } else if (parent.isFulfilled) {
        result = parent._results[0];
      }
      try {
        callback(error, result);
        return promise._resolve(parent);
      } catch (error1) {
        callbackError = error1;
        return promise._reject(callbackError);
      }
    });
    return promise;
  },
  assert: function(reason, predicate) {
    var promise;
    assertType(reason, String);
    assertType(predicate, Function.Maybe);
    promise = Promise(PENDING);
    isDev && (promise._tracers.init = Tracer("promise.assert()"));
    if (predicate == null) {
      predicate = emptyFunction.thatReturnsArgument;
    }
    this._then(promise, function(result) {
      if (!predicate(result)) {
        throw Error(reason);
      }
      return result;
    });
    return promise;
  },
  _inherit: function(results, offset) {
    var index, length;
    assertType(results, [Array, Object]);
    length = results.length;
    if (offset >= length) {
      return;
    }
    index = offset - 1;
    while (++index < length) {
      this._results.push(results[index]);
    }
  },
  _resolve: function(parent, onFulfilled, onRejected) {
    assertType(parent, Promise);
    assertType(onFulfilled, Function.Maybe);
    assertType(onRejected, Function.Maybe);
    assert(!parent.isPending, "The parent Promise must be resolved!");
    if (!this.isPending) {
      return;
    }
    if (parent.isFulfilled) {
      if (onFulfilled) {
        return this._tryResolving(onFulfilled, parent._results);
      }
      return this._fulfill(parent._results[0]);
    }
    if (onRejected) {
      return this._tryResolving(onRejected, parent._results);
    }
    return this._reject(parent._results[0]);
  },
  _fulfill: function(value) {
    var length, queue;
    assert(!isType(value, Promise), "Cannot fulfill with a Promise as the result!");
    if (!this.isPending) {
      return;
    }
    this._state = FULFILLED;
    this._results[0] = value;
    length = (queue = this._queue).length;
    this._queue = null;
    if (!length) {
      return;
    }
    return immediate(this, function() {
      var index;
      index = -1;
      while (++index < length) {
        queue[index].fulfill(this);
      }
    });
  },
  _reject: function(error) {
    var queue;
    assertType(error, Error.Kind);
    if (!this.isPending) {
      return;
    }
    this._state = REJECTED;
    this._results[0] = error;
    queue = this._queue;
    this._queue = null;
    return immediate(this, function() {
      var index, length;
      index = -1;
      if (this._unhandled) {
        length = (queue = Promise._rejectFallbacks).length;
        while (++index < length) {
          queue[index](error, this);
        }
        return;
      }
      length = queue.length;
      while (++index < length) {
        queue[index].reject(this);
      }
    });
  },
  _tryFulfilling: function(value) {
    var resolver;
    if (isType(value, Promise)) {
      return value._always((function(_this) {
        return function() {
          _this._inherit(value._results, 1);
          return _this._resolve(value);
        };
      })(this));
    }
    resolver = value && value.then;
    if (isType(resolver, Function)) {
      this._defer(bind.func(resolver, value));
      return;
    }
    this._fulfill(value);
  },
  _tryResolving: function(resolver, args) {
    assertType(resolver, Function);
    assertType(args, Array.Maybe);
    return immediate(this, function() {
      var error, value;
      try {
        value = resolver.apply(null, args);
      } catch (error1) {
        error = error1;
        return this._reject(error);
      }
      assert(value !== this, "Cannot resolve a Promise with itself!");
      return this._tryFulfilling(value);
    });
  },
  _then: function(promise, onFulfilled, onRejected) {
    assertType(promise, Promise);
    assertType(onFulfilled, Function.Maybe);
    assertType(onRejected, Function.Maybe);
    return this._always(function(parent) {
      return promise._resolve(parent, onFulfilled, onRejected);
    });
  },
  _always: function(onResolved) {
    assertType(onResolved, Function);
    this._unhandled = false;
    if (!this.isPending) {
      return immediate(this, function() {
        return onResolved(this);
      });
    }
    return this._queue.push({
      fulfill: onResolved,
      reject: onResolved
    });
  },
  _defer: function(resolver) {
    var reject, resolve;
    assertType(resolver, Function);
    if (resolver.length) {
      resolve = bind.method(this, "_tryFulfilling");
      if (resolver.length > 1) {
        reject = bind.method(this, "_reject");
      }
    }
    immediate(this, function() {
      var error;
      try {
        return resolver(resolve, reject);
      } catch (error1) {
        error = error1;
        return this._reject(error);
      }
    });
    return this;
  }
});

type.defineStatics({
  isFulfilled: function(value) {
    if (!isType(value, Promise)) {
      return false;
    }
    return value.isFulfilled;
  },
  isRejected: function(value) {
    if (!isType(value, Promise)) {
      return true;
    }
    return value.isRejected;
  },
  isPending: function(value) {
    if (!isType(value, Promise)) {
      return false;
    }
    return value.isPending;
  },
  defer: function(resolver) {
    var promise;
    assertType(resolver, Function.Maybe);
    promise = Promise(PENDING);
    isDev && (promise._tracers.init = Tracer("Promise.defer()"));
    if (resolver) {
      return promise._defer(resolver);
    }
    return {
      promise: promise,
      resolve: bind.method(promise, "_tryFulfilling"),
      reject: bind.method(promise, "_reject")
    };
  },
  reject: function(error) {
    var promise;
    assertType(error, Error.Kind);
    promise = Promise(PENDING);
    isDev && (promise._tracers.init = Tracer("Promise.reject()"));
    promise._reject(error);
    return promise;
  },
  "try": function(func) {
    var promise;
    assertType(func, Function);
    promise = Promise(PENDING);
    isDev && (promise._tracers.init = Tracer("Promise.try()"));
    promise._tryResolving(func);
    return promise;
  },
  wrap: function(func) {
    assertType(func, Function);
    return function() {
      var promise;
      promise = Promise(PENDING);
      isDev && (promise._tracers.init = Tracer("Promise.wrap()"));
      promise._tryResolving(bind.func(func, this, arguments));
      return promise;
    };
  },
  ify: function(func) {
    assertType(func, Function);
    return function() {
      var args, promise, self;
      self = this;
      args = arguments;
      promise = Promise(PENDING);
      isDev && (promise._tracers.init = Tracer("Promise.ify()"));
      return promise._defer(function(resolve, reject) {
        Array.prototype.push.call(args, function(error, result) {
          if (error) {
            return reject(error);
          } else {
            return resolve(result);
          }
        });
        return func.apply(self, args);
      });
    };
  },
  all: function(array, iterator) {
    var fulfill, length, promise, reject, remaining;
    assertType(array, Array);
    assertType(iterator, Function.Maybe);
    length = array.length;
    if (length === 0) {
      return Promise();
    }
    promise = Promise(PENDING);
    isDev && (promise._tracers.init = Tracer("Promise.all()"));
    reject = bind.method(promise, "_reject");
    fulfill = function() {
      if (!promise.isPending) {
        return;
      }
      remaining -= 1;
      if (remaining === 0) {
        promise._fulfill();
      }
    };
    remaining = length;
    if (iterator) {
      sync.repeat(length, function(index) {
        var pending;
        pending = Promise["try"](function() {
          return iterator.call(null, array[index], index);
        });
        return pending.then(fulfill, reject);
      });
    } else {
      sync.repeat(length, function(index) {
        var pending;
        pending = Promise(array[index]);
        return pending.then(fulfill, reject);
      });
    }
    return promise;
  },
  map: function(iterable, iterator) {
    var fulfill, promise, reject, remaining, results;
    assertType(iterator, Function.Maybe);
    promise = Promise(PENDING);
    isDev && (promise._tracers.init = Tracer("Promise.map()"));
    if (Array.isArray(iterable)) {
      results = new Array(iterable.length);
    } else if (PureObject.test(iterable)) {
      results = Object.create(null);
    } else {
      results = {};
    }
    if (!hasKeys(iterable)) {
      promise._fulfill(results);
      return promise;
    }
    reject = bind.method(promise, "_reject");
    fulfill = function(result, key) {
      if (has(results, key)) {
        return;
      }
      results[key] = result;
      remaining -= 1;
      if (remaining === 0) {
        promise._fulfill(results);
      }
    };
    remaining = 0;
    if (iterator) {
      sync.each(iterable, function(value, key) {
        var pending;
        remaining += 1;
        pending = Promise["try"](function() {
          return iterator.call(null, value, key);
        });
        pending._results.push(key);
        pending.then(fulfill, reject);
      });
    } else {
      sync.each(iterable, function(value, key) {
        var pending;
        remaining += 1;
        pending = Promise(value, key);
        pending.then(fulfill, reject);
      });
    }
    return promise;
  },
  chain: function(iterable, iterator) {
    assertType(iterator, Function);
    return sync.reduce(iterable, Promise(), function(chain, value, key) {
      return chain.then(function() {
        return iterator.call(null, value, key);
      });
    });
  },
  onUnhandledRejection: function(fallback) {
    this._rejectFallbacks.push(fallback);
  },
  _onUnhandledRejection: {
    get: function() {
      return emptyFunction;
    },
    set: function() {
      var error;
      error = Error("'Promise._onUnhandledRejection' is deprecated!");
      return console.log("\n" + error.stack);
    }
  },
  _rejectFallbacks: []
});

module.exports = Promise = type.build();

//# sourceMappingURL=map/Promise.map
