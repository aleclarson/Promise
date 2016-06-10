var Any, Promise, QueueItem, Tracer, Type, assert, assertType, bindMethod, emptyFunction, getResolver, has, immediate, isType, spliceArray, sync, tryCatch, type;

emptyFunction = require("emptyFunction");

spliceArray = require("spliceArray");

assertType = require("assertType");

bindMethod = require("bindMethod");

immediate = require("immediate");

Tracer = require("Tracer");

isType = require("isType");

assert = require("assert");

sync = require("sync");

Type = require("Type");

Any = require("Any");

has = require("has");

QueueItem = require("./QueueItem");

type = Type("Promise");

type.argumentTypes = {
  value: Any,
  isPending: Boolean.Maybe
};

type.returnExisting(function(value) {
  if (isType(value, Promise)) {
    return value;
  }
});

type.defineValues({
  _state: 0,
  _unhandled: true,
  _results: function() {
    return [void 0];
  },
  _queue: function() {
    return [];
  },
  _trace: function() {
    if (isDev) {
      return null;
    }
  }
});

type.definePrototype({
  isFulfilled: {
    get: function() {
      return this._state > 0;
    }
  },
  isRejected: {
    get: function() {
      return this._state < 0;
    }
  },
  isPending: {
    get: function() {
      return this._state === 0;
    }
  }
});

type.initInstance(function(value, isPending) {
  if (!isPending) {
    return this._tryFulfilling(value);
  }
});

type.defineMethods({
  then: function(onFulfilled, onRejected) {
    var promise;
    assertType(onFulfilled, Function.Maybe);
    assertType(onRejected, Function.Maybe);
    if (!this._canResolve(onFulfilled, onRejected)) {
      return this;
    }
    promise = Promise._defer();
    this._then(promise, onFulfilled, onRejected);
    return promise;
  },
  fail: function(onRejected) {
    var promise;
    assertType(onRejected, Function.Maybe);
    promise = Promise._defer();
    this._then(promise, void 0, onRejected);
    return promise;
  },
  always: function(onResolved) {
    var onFulfilled, onRejected, promise;
    assertType(onResolved, Function);
    promise = Promise._defer();
    onFulfilled = function() {
      spliceArray(arguments, 0, 0, null);
      try {
        onResolved.apply(null, arguments);
      } catch (error1) {}
      return arguments[1];
    };
    onRejected = function() {
      spliceArray(arguments, 1, 0, null);
      try {
        onResolved.apply(null, arguments);
      } catch (error1) {}
      throw arguments[0];
    };
    this._then(promise, onFulfilled, onRejected);
    return promise;
  },
  curry: function() {
    var args, promise;
    args = arguments;
    return promise = this.always(function() {
      var i, len, value;
      for (i = 0, len = args.length; i < len; i++) {
        value = args[i];
        promise._results.push(value);
      }
    });
  },
  inspect: function() {
    return {
      state: this._state > 0 ? "fulfilled" : this._state < 0 ? "rejected" : "pending",
      value: this._results[0],
      meta: this._results.slice(1)
    };
  },
  _fulfill: function(value) {
    var i, item, len, ref;
    if (!this.isPending) {
      return;
    }
    assert(!isType(value, Promise), "Cannot fulfill with a Promise as the result!");
    this._state = 1;
    this._results[0] = value;
    if (this._queue.length) {
      ref = this._queue;
      for (i = 0, len = ref.length; i < len; i++) {
        item = ref[i];
        item.fulfill(this);
      }
    }
    this._queue = null;
  },
  _reject: function(error) {
    var i, item, len, ref;
    if (!this.isPending) {
      return;
    }
    assertType(error, Error.Kind);
    this._state = -1;
    this._results[0] = error;
    if (this._unhandled) {
      immediate((function(_this) {
        return function() {
          if (!_this._unhandled) {
            return;
          }
          return Promise._onUnhandledRejection(error, _this);
        };
      })(this));
    }
    if (this._queue.length) {
      ref = this._queue;
      for (i = 0, len = ref.length; i < len; i++) {
        item = ref[i];
        item.reject(this);
      }
    }
    this._queue = null;
  },
  _resolve: function(results, resolver) {
    var error, result;
    assertType(results, Array);
    assertType(resolver, Function);
    try {
      result = resolver.apply(null, results);
      assert(result !== this, "Cannot resolve a Promise with itself!");
    } catch (error1) {
      error = error1;
      this._reject(error);
      return;
    }
    this._tryFulfilling(result);
  },
  _tryFulfilling: function(value) {
    var resolver, result;
    if (isType(value, Promise)) {
      value._then(this);
      return;
    }
    result = tryCatch(getResolver, value);
    if (result.error) {
      this._reject(result.error);
      return;
    }
    resolver = result.value;
    if (resolver) {
      this._tryResolving(resolver);
      return;
    }
    this._fulfill(value);
  },
  _tryResolving: function(resolver) {
    var error, reject, resolve;
    assertType(resolver, Function);
    reject = bindMethod(this, "_reject");
    resolve = bindMethod(this, "_tryFulfilling");
    error = tryCatch(function() {
      return resolver(resolve, reject);
    }).error;
    if (error) {
      reject(error);
    }
  },
  _canResolve: function(onFulfilled, onRejected) {
    if (this.isFulfilled && !isType(onFulfilled, Function)) {
      return false;
    }
    if (this.isRejected && !isType(onRejected, Function)) {
      return false;
    }
    return true;
  },
  _then: function(promise, onFulfilled, onRejected) {
    this._unhandled = false;
    if (this.isPending) {
      this._queue.push(QueueItem(promise, onFulfilled, onRejected));
      return;
    }
    if (this.isFulfilled) {
      this._thenResolve(promise, onFulfilled);
      return;
    }
    this._thenResolve(promise, onRejected);
  },
  _thenResolve: function(promise, resolver) {
    assertType(promise, Promise);
    assertType(resolver, Function.Maybe);
    assert(!this.isPending, "This promise must be resolved before notifying the next promise!");
    if (isDev) {
      promise._trace = Tracer("Promise::_thenResolve()");
    }
    return immediate((function(_this) {
      return function() {
        var results;
        results = _this._results;
        promise._inheritResults(results);
        if (resolver) {
          promise._resolve(results, resolver);
          return;
        }
        if (_this.isFulfilled) {
          promise._fulfill(results[0]);
          return;
        }
        promise._reject(results[0]);
      };
    })(this));
  },
  _inheritResults: function(results) {
    var index, length;
    length = results.length;
    if (length <= 1) {
      return;
    }
    index = 1;
    while (index < length) {
      this._results.push(results[index]);
      index += 1;
    }
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
  defer: function() {
    var promise;
    return {
      promise: promise = Promise._defer(),
      resolve: function(result) {
        return promise._tryFulfilling(result);
      },
      reject: function(error) {
        return promise._reject(error);
      }
    };
  },
  resolve: function(resolver) {
    var promise;
    assertType(resolver, Function);
    promise = Promise._defer();
    promise._tryResolving(resolver);
    return promise;
  },
  reject: function(error) {
    var promise;
    assertType(error, Error.Kind);
    promise = Promise._defer();
    promise._reject(error);
    return promise;
  },
  "try": function(func) {
    var promise;
    assertType(func, Function);
    promise = Promise._defer();
    if (isDev) {
      promise._trace = Tracer("Promise.try()");
    }
    immediate((function(_this) {
      return function() {
        return promise._resolve([], func);
      };
    })(this));
    return promise;
  },
  wrap: function(func) {
    assertType(func, Function);
    return function() {
      var args, self;
      self = this;
      args = arguments;
      return Promise["try"](function() {
        return func.apply(self, args);
      });
    };
  },
  ify: function(func) {
    var push;
    assertType(func, Function);
    push = Array.prototype.push;
    return function() {
      var deferred;
      deferred = Promise._defer();
      push.call(arguments, function(error, result) {
        if (error) {
          return deferred._reject(error);
        } else {
          return deferred._fulfill(result);
        }
      });
      func.apply(this, arguments);
      return deferred;
    };
  },
  all: function(array) {
    var deferred, fulfill, index, length, reject, remaining, results;
    assertType(array, Array);
    length = array.length;
    if (!length) {
      return Promise([]);
    }
    results = new Array(length);
    remaining = length;
    deferred = Promise._defer();
    reject = bindMethod(deferred, "_reject");
    fulfill = function(result, index) {
      assert(!has(results, index), "Cannot fulfill more than once!");
      results[index] = result;
      if (!--remaining) {
        return deferred._fulfill(results);
      }
    };
    index = -1;
    while (++index < length) {
      Promise(array[index]).curry(index).then(fulfill, reject);
    }
    return deferred;
  },
  map: function(iterable, iterator) {
    assertType(iterator, Function);
    return Promise.all(sync.reduce(iterable, [], function(promises, value, key) {
      promises.push(Promise["try"](function() {
        return iterator.call(null, value, key);
      }));
      return promises;
    }));
  },
  chain: function(iterable, iterator) {
    assertType(iterator, Function);
    return sync.reduce(iterable, Promise(), function(chain, value, key) {
      return chain.then(function() {
        return iterator.call(null, value, key);
      });
    });
  },
  _defer: function() {
    return Promise(void 0, true);
  },
  _onUnhandledRejection: emptyFunction
});

module.exports = Promise = type.build();

getResolver = function(value) {
  var resolver;
  resolver = value && value.then;
  if (!(resolver instanceof Function)) {
    return;
  }
  return function() {
    return resolver.apply(value, arguments);
  };
};

tryCatch = function(func, value) {
  var error;
  try {
    return {
      value: func(value)
    };
  } catch (error1) {
    error = error1;
    return {
      error: error
    };
  }
};

//# sourceMappingURL=../../map/src/Promise.map
