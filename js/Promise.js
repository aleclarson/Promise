var FULFILLED, PENDING, Promise, PureObject, QueueItem, REJECTED, Tracer, Type, assert, assertType, bind, emptyFunction, hasKeys, immediate, isType, spliceArray, sync, type;

require("isDev");

emptyFunction = require("emptyFunction");

spliceArray = require("spliceArray");

PureObject = require("PureObject");

assertType = require("assertType");

immediate = require("immediate");

hasKeys = require("hasKeys");

Tracer = require("tracer");

isType = require("isType");

assert = require("assert");

bind = require("bind");

sync = require("sync");

Type = require("Type");

QueueItem = require("./QueueItem");

PENDING = Symbol("Promise.PENDING");

FULFILLED = Symbol("Promise.FULFILLED");

REJECTED = Symbol("Promise.REJECTED");

type = Type("Promise");

type.defineValues({
  _state: PENDING,
  _unhandled: true,
  _values: function() {
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

type.initInstance(function(result) {
  this._inheritValues(arguments, 1);
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
    var data;
    data = {
      state: this.state
    };
    if (this.isFulfilled) {
      data.value = this._values[0];
    } else if (this.isRejected) {
      data.error = this._values[0];
    }
    if (this._values.length > 1) {
      data.meta = this._values.slice(1);
    }
    return data;
  },
  then: function(onFulfilled, onRejected) {
    var promise;
    assertType(onFulfilled, Function.Maybe);
    assertType(onRejected, Function.Maybe);
    if (!this._canResolve(onFulfilled, onRejected)) {
      return this;
    }
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
    this._always(promise, onResolved);
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
      predicate(result) || (function() {
        throw Error(reason);
      })();
      return result;
    });
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
  _thenResolve: function(promise, resolver) {
    assertType(promise, Promise);
    assertType(resolver, Function.Maybe);
    assert(!this.isPending, "Cannot use a pending Promise to resolve another Promise!");
    assert(promise.isPending, "Cannot resolve a Promise that is not pending!");
    if (resolver) {
      isDev && (promise._tracers.resolve = Tracer("Promise::_thenResolve()"));
      immediate((function(_this) {
        return function() {
          return promise._resolve(_this._values, resolver);
        };
      })(this));
      return;
    }
    if (this.isFulfilled) {
      promise._fulfill(this._values[0]);
      return;
    }
    promise._reject(this._values[0]);
  },
  _always: function(promise, onResolved) {
    var onFulfilled, onRejected, resolve;
    assertType(promise, Promise);
    assertType(arguments[1], Function.Maybe);
    onResolved && (resolve = (function(_this) {
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
        deferred = Promise(PENDING);
        result._queue.push(QueueItem(deferred, function() {
          deferred._inheritValues(_this._values, 1);
          if (_this.isFulfilled) {
            return _this._values[0];
          }
          throw _this._values[0];
        }));
        return deferred;
      };
    })(this));
    onFulfilled = (function(_this) {
      return function() {
        var result;
        if (onResolved) {
          spliceArray(arguments, 0, 0, null);
          result = resolve(arguments);
          if (result !== FULFILLED) {
            return result;
          }
        }
        promise._inheritValues(_this._values, 1);
        return _this._values[0];
      };
    })(this);
    onRejected = (function(_this) {
      return function() {
        var result;
        if (onResolved) {
          spliceArray(arguments, 1, 0, null);
          result = resolve(arguments);
          if (result !== FULFILLED) {
            return result;
          }
        }
        promise._inheritValues(_this._values, 1);
        throw _this._values[0];
      };
    })(this);
    this._then(promise, onFulfilled, onRejected);
  },
  _inheritValues: function(values, startIndex) {
    var index, length;
    assertType(values, [Array, Object]);
    length = values.length;
    if (startIndex >= length) {
      return;
    }
    index = startIndex - 1;
    while (++index < length) {
      this._values.push(values[index]);
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
  _fulfill: function(value) {
    var i, item, len, ref;
    if (!this.isPending) {
      return;
    }
    assert(!isType(value, Promise), "Cannot fulfill with a Promise as the result!");
    this._state = FULFILLED;
    this._values[0] = value;
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
    this._values[0] = error;
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
  _resolve: function(args, resolver) {
    var error, result;
    if (args != null) {
      assertType(args, Array);
    }
    assertType(resolver, Function);
    try {
      result = resolver.apply(null, args);
      assert(result !== this, "Cannot resolve a Promise with itself!");
    } catch (error1) {
      error = error1;
      this._reject(error);
      return;
    }
    this._tryFulfilling(result);
  },
  _tryFulfilling: function(result) {
    var resolver;
    if (isType(result, Promise)) {
      result._always(this);
      return;
    }
    resolver = result && result.then;
    if (isType(resolver, Function)) {
      this._tryResolving(bind.func(resolver, result));
      return;
    }
    this._fulfill(result);
  },
  _tryResolving: function(resolver) {
    var error, reject, resolve;
    assertType(resolver, Function);
    reject = bind.method(this, "_reject");
    resolve = bind.method(this, "_tryFulfilling");
    try {
      resolver(resolve, reject);
    } catch (error1) {
      error = error1;
      reject(error);
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
  defer: function(resolver) {
    var promise;
    assertType(resolver, Function.Maybe);
    promise = Promise(PENDING);
    isDev && (promise._tracers.init = Tracer("Promise.defer()"));
    if (resolver) {
      promise._tryResolving(resolver);
      return promise;
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
    immediate(function() {
      return promise._resolve(null, func);
    });
    return promise;
  },
  wrap: function(func) {
    assertType(func, Function);
    return function() {
      var promise;
      promise = Promise["try"](bind.func(func, this, arguments));
      isDev && (promise._tracers.init = Tracer("Promise.wrap()"));
      return promise;
    };
  },
  ify: function(func) {
    assertType(func, Function);
    return function() {
      var arg, args, i, len, promise, self;
      self = this;
      args = [];
      for (i = 0, len = arguments.length; i < len; i++) {
        arg = arguments[i];
        args.push(arg);
      }
      promise = Promise(PENDING);
      isDev && (promise._tracers.init = Tracer("Promise.ify()"));
      promise._tryResolving(function(resolve, reject) {
        args.push(function(error, result) {
          if (error) {
            return reject(error);
          } else {
            return resolve(result);
          }
        });
        return func.apply(self, args);
      });
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
    promise = Promise(PENDING);
    isDev && (promise._tracers.init = Tracer("Promise.all()"));
    results = new Array(length);
    remaining = length;
    reject = bind.method(promise, "_reject");
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
      return Promise(array[index], index).then(fulfill, reject);
    });
    return promise;
  },
  map: function(iterable, iterator) {
    var fulfill, promise, reject, remaining, results;
    assertType(iterator, Function);
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
    sync.each(iterable, function(result, key) {
      var deferred;
      remaining += 1;
      deferred = Promise["try"](function() {
        return iterator.call(null, result, key);
      });
      deferred._values.push(key);
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
  _onUnhandledRejection: emptyFunction
});

module.exports = Promise = type.build();

//# sourceMappingURL=map/Promise.map
