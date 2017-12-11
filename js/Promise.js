// Generated by CoffeeScript 2.0.3
var FULFILLED, PENDING, Promise, PromiseTracer, PureObject, REJECTED, StubTracer, Type, assertValid, bind, emptyFunction, has, hasKeys, immediate, isDev, isValid, sync, type;

emptyFunction = require("emptyFunction");

assertValid = require("assertValid");

PureObject = require("PureObject");

immediate = require("immediate");

hasKeys = require("hasKeys");

isValid = require("isValid");

isDev = require("isDev");

Type = require("Type");

sync = require("sync");

bind = require("bind");

has = require("has");

StubTracer = {
  trace: emptyFunction
};

if (isDev) {
  PromiseTracer = require("./PromiseTracer");
}

PENDING = Symbol("Promise.PENDING");

FULFILLED = Symbol("Promise.FULFILLED");

REJECTED = Symbol("Promise.REJECTED");

type = Type("Promise");

type.defineGetters({
  state: function() {
    if (this.isFulfilled) {
      return "fulfilled";
    } else if (this.isRejected) {
      return "rejected";
    } else {
      return "pending";
    }
  },
  isPending: function() {
    return this._state === PENDING;
  },
  isFulfilled: function() {
    return this._state === FULFILLED;
  },
  isRejected: function() {
    return this._state === REJECTED;
  }
});

type.defineMethods({
  inspect: function() {
    var promise;
    promise = {state: this.state};
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
  trace: function() {
    isDev && PromiseTracer().trace(this);
    return this;
  },
  then: function(onFulfilled, onRejected) {
    var promise;
    assertValid(onFulfilled, "function?");
    assertValid(onRejected, "function?");
    promise = Promise(PENDING);
    this._then(promise, onFulfilled, onRejected);
    return promise;
  },
  fail: function(onRejected) {
    var promise;
    assertValid(onRejected, "function?");
    promise = Promise(PENDING);
    this._then(promise, void 0, onRejected);
    return promise;
  },
  always: function(onResolved) {
    var promise;
    assertValid(onResolved, "function");
    promise = Promise(PENDING);
    this._tracer.trace(promise, this);
    this._always(function(parent) {
      var error, resolver, value;
      try {
        value = onResolved();
      } catch (error1) {
        error = error1;
        promise._reject(error);
        return;
      }
      if (isValid(value, Promise)) {
        return value._always(function() {
          if (value.isRejected) {
            return promise._reject(value._results[0]);
          } else {
            promise._inherit(parent._results, 1);
            return promise._resolve(parent);
          }
        });
      }
      // TODO: Support "thenables" returned by `always` callbacks.
      resolver = value && value.then;
      if (isValid(resolver, "function")) {
        throw Error("Thenables returned by an `always` function are not yet supported");
      }
      //   promise._defer bind.func resolver, value
      //   return
      promise._inherit(parent._results, 1);
      return promise._resolve(parent);
    });
    return promise;
  },
  done: function(onFulfilled, onRejected) {
    if (arguments.length) {
      this.then(onFulfilled, onRejected);
    }
  },
  notify: function(callback) {
    var promise;
    if (!callback) {
      return this;
    }
    assertValid(callback, "function");
    promise = Promise(PENDING);
    this._tracer.trace(promise, this);
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
    assertValid(reason, "string");
    assertValid(predicate, "function?");
    promise = Promise(PENDING);
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
  delay: function(delay) {
    var promise;
    assertValid(delay, "number");
    promise = Promise(PENDING);
    this._tracer.trace(promise, this);
    this._always(function(parent) {
      var resolve;
      resolve = function() {
        promise._inherit(parent._results, 1);
        return promise._resolve(parent);
      };
      return setTimeout(resolve, delay);
    });
    return promise;
  },
  timeout: function(delay, callback) {
    var onTimeout, promise, timeout;
    assertValid(delay, "number");
    assertValid(callback, "function");
    promise = Promise(PENDING);
    this._tracer.trace(promise, this);
    if (!this.isPending) {
      immediate(this, function() {
        promise._inherit(this._results, 1);
        return promise._resolve(this);
      });
      return promise;
    }
    onTimeout = function() {
      var error, result, timeout;
      timeout = null;
      try {
        result = callback();
      } catch (error1) {
        error = error1;
        promise._reject(error);
        return;
      }
      promise._fulfill(result);
    };
    timeout = setTimeout(onTimeout, delay);
    this._queue.push(function(parent) {
      if (timeout !== null) {
        clearTimeout(timeout);
        promise._inherit(parent._results, 1);
        promise._resolve(parent);
      }
    });
    return promise;
  }
});

type.defineStatics({
  isFulfilled: function(value) {
    if (!isValid(value, Promise)) {
      return false;
    }
    return value.isFulfilled;
  },
  isRejected: function(value) {
    if (!isValid(value, Promise)) {
      return true;
    }
    return value.isRejected;
  },
  isPending: function(value) {
    if (!isValid(value, Promise)) {
      return false;
    }
    return value.isPending;
  },
  defer: function(resolver) {
    var promise;
    assertValid(resolver, "function?");
    promise = Promise(PENDING);
    if (resolver) {
      return promise._defer(resolver);
    }
    return {
      promise,
      resolve: bind.method(promise, "_tryFulfilling"),
      reject: bind.method(promise, "_reject")
    };
  },
  resolve: function(value) {
    var promise;
    promise = Promise(PENDING);
    promise._inherit(arguments, 1);
    promise._tryFulfilling(value);
    return promise;
  },
  reject: function(error) {
    var promise;
    promise = Promise(PENDING);
    promise._inherit(arguments, 1);
    promise._reject(error);
    return promise;
  },
  try: function(func) {
    var promise;
    assertValid(func, "function");
    promise = Promise(PENDING);
    promise._tryResolving(func);
    return promise;
  },
  delay: function(delay) {
    var fulfill, promise;
    assertValid(delay, "number");
    promise = Promise(PENDING);
    fulfill = bind.method(promise, "_fulfill");
    setTimeout(fulfill, delay);
    return promise;
  },
  wrap: function(func) {
    assertValid(func, "function");
    return function() {
      var promise;
      promise = Promise(PENDING);
      promise._tryResolving(bind.func(func, this, arguments));
      return promise;
    };
  },
  ify: function(func) {
    assertValid(func, "function");
    return function() {
      var args, promise, self;
      self = this;
      args = arguments;
      promise = Promise(PENDING);
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
  all: function(iterable, iterator) {
    var fulfill, promise, reject, remaining, results;
    assertValid(iterator, "function?");
    promise = Promise(PENDING);
    results = Array.isArray(iterable) ? new Array(iterable.length) : PureObject.test(iterable) ? Object.create(null) : {};
    if (!hasKeys(iterable)) {
      immediate(function() {
        return promise._fulfill(results);
      });
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
    immediate(function() { // Allow time for 'trace' to be called.
      var tracer;
      tracer = promise._tracer;
      return sync.each(iterable, function(value, key) {
        var pending;
        remaining += 1;
        pending = iterator ? Promise(PENDING, key) : Promise.resolve(value, key);
        tracer.trace(pending, promise);
        pending.then(fulfill, reject);
        if (iterator) {
          pending._tryResolving(iterator, [value, key]);
        }
      });
    });
    return promise;
  },
  map: function(iterable, iterator) {
    console.warn("Promise.map() is deprecated! Use Promise.all() instead!");
    return this.all(iterable, iterator);
  },
  chain: function(iterable, iterator) {
    assertValid(iterator, "function");
    return sync.reduce(iterable, Promise.resolve(), function(chain, value, key) {
      return chain.then(function() {
        return iterator.call(null, value, key);
      });
    });
  },
  race: function(array) {
    var deferred, i, len, promise;
    assertValid(array, "array");
    deferred = Promise.defer();
    for (i = 0, len = array.length; i < len; i++) {
      promise = array[i];
      if (promise && promise.then) {
        promise.then(deferred.resolve, deferred.reject);
      }
    }
    return deferred.promise;
  },
  onUnhandledRejection: function(fallback) {
    this._rejectFallbacks.push(fallback);
  }
});


// Internals

type.defineValues(function() {
  return {
    _state: PENDING,
    _unhandled: true,
    _results: [void 0],
    _queue: [],
    _tracer: StubTracer
  };
});

type.initInstance(function(result) {
  if (result === PENDING) {
    this._inherit(arguments, 1);
    return;
  }
  this._defer(result);
});

type.defineMethods({
  _inherit: function(results, offset) {
    var index, length;
    ({length} = results);
    if (offset >= length) {
      return;
    }
    index = offset - 1;
    while (++index < length) {
      this._results.push(results[index]);
    }
  },
  _resolve: function(parent, onFulfilled, onRejected) {
    assertValid(parent, Promise);
    assertValid(onFulfilled, "function?");
    assertValid(onRejected, "function?");
    if (parent.isPending) {
      throw Error("The parent Promise must be resolved!");
    }
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
    if (isValid(value, Promise)) {
      throw Error("Cannot fulfill with a Promise as the result!");
    }
    if (!this.isPending) {
      return;
    }
    this._state = FULFILLED;
    this._results[0] = value;
    this._tracer.trace(this);
    ({length} = queue = this._queue);
    this._queue = null;
    if (!length) {
      return;
    }
    return immediate(this, function() {
      var index;
      index = -1;
      while (++index < length) {
        queue[index](this);
      }
    });
  },
  _reject: function(error) {
    var queue;
    assertValid(error, "error");
    if (!this.isPending) {
      return;
    }
    this._state = REJECTED;
    this._results[0] = error;
    this._tracer.trace(this);
    queue = this._queue;
    this._queue = null;
    return immediate(this, function() {
      var index, length;
      index = -1;
      if (this._unhandled) {
        ({length} = queue = Promise._rejectFallbacks);
        while (++index < length) {
          queue[index](error, this);
        }
        return;
      }
      // If 'this._unhandled' is false, we know
      // for sure that the queue is not empty.
      ({length} = queue);
      while (++index < length) {
        queue[index](this);
      }
    });
  },
  _tryFulfilling: function(value) {
    if (isValid(value, Promise)) {
      return value._always(() => {
        this._inherit(value._results, 1);
        return this._resolve(value);
      });
    }
    // Support foreign promises.
    if (value && isValid(value.then, "function")) {
      value.then(this._tryFulfilling.bind(this), this._reject.bind(this));
      return;
    }
    this._fulfill(value);
  },
  _tryResolving: function(resolver, args) {
    assertValid(resolver, "function");
    return immediate(this, function() {
      var error, value;
      try {
        value = resolver.apply(null, args);
      } catch (error1) {
        error = error1;
        return this._reject(error);
      }
      if (value === this) {
        throw Error("Cannot resolve a Promise with itself!");
      }
      return this._tryFulfilling(value);
    });
  },
  _then: function(promise, onFulfilled, onRejected) {
    assertValid(promise, Promise);
    assertValid(onFulfilled, "function?");
    assertValid(onRejected, "function?");
    this._tracer.trace(promise, this);
    this._always(function(parent) {
      return promise._resolve(parent, onFulfilled, onRejected);
    });
  },
  _always: function(onResolved) {
    assertValid(onResolved, "function");
    this._unhandled = false;
    if (!this.isPending) {
      return immediate(this, function() {
        return onResolved(this);
      });
    }
    this._queue.push(onResolved);
  },
  _defer: function(resolver) {
    var reject, resolve;
    assertValid(resolver, "function");
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
  _rejectFallbacks: []
});

module.exports = Promise = type.build();

// Aliased methods
Promise.prototype.catch = Promise.prototype.fail;

Promise.prototype.finally = Promise.prototype.always;

Promise.prototype.denodeify = Promise.prototype.ify;
