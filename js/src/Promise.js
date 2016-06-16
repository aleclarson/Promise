var FULFILLED, PENDING, Promise, PureObject, QueueItem, REJECTED, Tracer, Type, assert, assertType, bindMethod, emptyFunction, getResolver, hasKeys, immediate, isType, spliceArray, sync, tryCatch, type, wrapValue;

require("isDev");

emptyFunction = require("emptyFunction");

spliceArray = require("spliceArray");

PureObject = require("PureObject");

assertType = require("assertType");

bindMethod = require("bindMethod");

wrapValue = require("wrapValue");

immediate = require("immediate");

hasKeys = require("hasKeys");

Tracer = require("tracer");

isType = require("isType");

assert = require("assert");

sync = require("sync");

Type = require("Type");

QueueItem = require("./QueueItem");

PENDING = Symbol("Promise.PENDING");

FULFILLED = Symbol("Promise.FULFILLED");

REJECTED = Symbol("Promise.REJECTED");

type = Type("Promise");

type.returnExisting(function(value) {
  if (isType(value, Promise)) {
    value._inheritResults(arguments);
    return value;
  }
});

type.defineValues({
  _state: PENDING,
  _unhandled: true,
  _results: function() {
    return [void 0];
  },
  _queue: function() {
    return [];
  },
  _tracers: function() {
    if (isDev) {
      return {};
    }
  }
});

type.initInstance(function(value) {
  this._inheritResults(arguments);
  if (value !== PENDING) {
    return this._tryFulfilling(value);
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
  value: {
    get: function() {
      return this._results[0];
    }
  },
  error: {
    get: function() {
      return this._results[0];
    }
  },
  meta: {
    get: function() {
      return this._results.slice(1);
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
  inspect: function() {
    return {
      state: this.state,
      value: this.value,
      meta: this.meta
    };
  },
  then: function(onFulfilled, onRejected) {
    var promise;
    assertType(onFulfilled, Function.Maybe);
    assertType(onRejected, Function.Maybe);
    if (!this._canResolve(onFulfilled, onRejected)) {
      return this;
    }
    promise = Promise._defer();
    isDev && (promise._tracers.init = Tracer("promise.then()"));
    this._then(promise, onFulfilled, onRejected);
    return promise;
  },
  fail: function(onRejected) {
    var promise;
    assertType(onRejected, Function.Maybe);
    promise = Promise._defer();
    isDev && (promise._tracers.init = Tracer("promise.fail()"));
    this._then(promise, void 0, onRejected);
    return promise;
  },
  always: function(onResolved) {
    var promise;
    assertType(onResolved, Function);
    promise = Promise._defer();
    isDev && (promise._tracers.init = Tracer("promise.always()"));
    this._always(promise, onResolved);
    return promise;
  },
  curry: function() {
    var arg, i, len, promise, results;
    this._unhandled = false;
    if (this.isPending) {
      results = arguments;
      promise = this.always((function(_this) {
        return function() {
          var i, len, result;
          promise._inheritResults(_this._results);
          for (i = 0, len = results.length; i < len; i++) {
            result = results[i];
            promise._results.push(result);
          }
        };
      })(this));
    } else {
      promise = Promise._defer();
      promise._inheritResults(this._results);
      for (i = 0, len = arguments.length; i < len; i++) {
        arg = arguments[i];
        promise._results.push(arg);
      }
      if (this.isFulfilled) {
        promise._fulfill(this.value);
      } else {
        promise._reject(this.error);
      }
    }
    isDev && (promise._tracers.init = Tracer("promise.curry()"));
    return promise;
  },
  _then: function(promise, onFulfilled, onRejected) {
    assertType(promise, Promise);
    assertType(onFulfilled, Function.Maybe);
    assertType(onRejected, Function.Maybe);
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
  _always: function(promise) {
    var onFulfilled, onRejected, onResolved;
    assertType(promise, Promise);
    assertType(arguments[1], Function.Maybe);
    if (arguments[1]) {
      onResolved = wrapValue(arguments[1], (function(_this) {
        return function(onResolved) {
          return function(args) {
            var deferred, result;
            result = onResolved.apply(null, args);
            if (!isType(result, Promise)) {
              return FULFILLED;
            }
            if (result.isFulfilled) {
              return FULFILLED;
            }
            if (result.isRejected) {
              throw result.error;
            }
            deferred = Promise._defer();
            result._queue.push(QueueItem(deferred, function() {
              deferred._inheritResults(_this._results);
              if (_this.isFulfilled) {
                return _this.value;
              }
              throw _this.error;
            }));
            return deferred;
          };
        };
      })(this));
    }
    onFulfilled = (function(_this) {
      return function() {
        var result;
        if (onResolved) {
          spliceArray(arguments, 0, 0, null);
          result = onResolved(arguments);
          if (result !== FULFILLED) {
            return result;
          }
        }
        promise._inheritResults(_this._results);
        return _this.value;
      };
    })(this);
    onRejected = (function(_this) {
      return function() {
        var result;
        if (onResolved) {
          spliceArray(arguments, 1, 0, null);
          result = onResolved(arguments);
          if (result !== FULFILLED) {
            return result;
          }
        }
        promise._inheritResults(_this._results);
        throw _this.error;
      };
    })(this);
    this._then(promise, onFulfilled, onRejected);
  },
  _fulfill: function(value) {
    var i, item, len, ref;
    if (!this.isPending) {
      return;
    }
    assert(!isType(value, Promise), "Cannot fulfill with a Promise as the result!");
    this._state = FULFILLED;
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
    this._state = REJECTED;
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
      value._always(this);
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
  _inheritResults: function(results) {
    var index, length;
    assertType(results, [Array, Object]);
    length = results.length;
    if (length <= 1) {
      return;
    }
    index = 0;
    while (++index < length) {
      this._results.push(results[index]);
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
  _thenResolve: function(promise, resolver) {
    assertType(promise, Promise);
    assertType(resolver, Function.Maybe);
    assert(!this.isPending, "Cannot use a pending Promise to resolve another Promise!");
    assert(promise.isPending, "Cannot resolve a Promise that is not pending!");
    if (resolver) {
      isDev && (promise._tracers.resolve = Tracer("Promise::_thenResolve()"));
      immediate((function(_this) {
        return function() {
          return promise._resolve(_this._results, resolver);
        };
      })(this));
      return;
    }
    if (this.isFulfilled) {
      promise._fulfill(this.value);
      return;
    }
    promise._reject(this.error);
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
    promise = Promise._defer();
    isDev && (promise._tracers.init = Tracer("Promise.defer()"));
    return {
      promise: promise,
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
    isDev && (promise._tracers.init = Tracer("Promise.resolve()"));
    promise._tryResolving(resolver);
    return promise;
  },
  reject: function(error) {
    var promise;
    assertType(error, Error.Kind);
    promise = Promise._defer();
    isDev && (promise._tracers.init = Tracer("Promise.reject()"));
    promise._reject(error);
    return promise;
  },
  "try": function(func) {
    var promise;
    assertType(func, Function);
    promise = Promise._defer();
    isDev && (promise._tracers.init = Tracer("Promise.try()"));
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
      var args, promise, self;
      self = this;
      args = arguments;
      promise = Promise["try"](function() {
        return func.apply(self, args);
      });
      isDev && (promise._tracers.init = Tracer("Promise.wrap()"));
      return promise;
    };
  },
  ify: function(func) {
    var push;
    assertType(func, Function);
    push = Array.prototype.push;
    return function() {
      var promise;
      promise = Promise._defer();
      isDev && (promise._tracers.init = Tracer("Promise.ify()"));
      push.call(arguments, function(error, result) {
        if (error) {
          return promise._reject(error);
        } else {
          return promise._fulfill(result);
        }
      });
      func.apply(this, arguments);
      return promise;
    };
  },
  all: function(array) {
    var fulfill, length, promise, reject, remaining, results;
    assertType(array, Array);
    length = array.length;
    if (length === 0) {
      return Promise([]);
    }
    promise = Promise._defer();
    isDev && (promise._tracers.init = Tracer("Promise.all()"));
    results = new Array(length);
    remaining = length;
    reject = bindMethod(promise, "_reject");
    fulfill = function(result, index) {
      if (!promise.isPending) {
        return;
      }
      assertType(index, Number);
      results[index] = result;
      remaining -= 1;
      if (remaining === 0) {
        promise._fulfill(results);
      }
    };
    sync.repeat(length, function(index) {
      var deferred;
      deferred = Promise(array[index], index);
      deferred.then(fulfill, reject);
    });
    return promise;
  },
  map: function(iterable, iterator) {
    var fulfill, promise, reject, remaining, results;
    assertType(iterator, Function);
    promise = Promise._defer();
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
    reject = bindMethod(promise, "_reject");
    fulfill = function(result, key) {
      if (!promise.isPending) {
        return;
      }
      assertType(key, [String, Number]);
      results[key] = result;
      remaining -= 1;
      if (remaining === 0) {
        promise._fulfill(results);
      }
    };
    remaining = 0;
    sync.each(iterable, function(value, key) {
      var deferred;
      remaining += 1;
      deferred = Promise["try"](function() {
        return iterator.call(null, value, key);
      });
      deferred._results.push(key);
      deferred.then(fulfill, reject);
    });
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
  _defer: function() {
    return Promise(PENDING);
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
