var Any, Promise, QueueItem, Type, assert, assertType, bindMethod, emptyFunction, getResolver, immediate, isType, ref, sync, tryCatch, type;

ref = require("type-utils"), Any = ref.Any, isType = ref.isType, assert = ref.assert, assertType = ref.assertType;

emptyFunction = require("emptyFunction");

bindMethod = require("bindMethod");

immediate = require("immediate");

sync = require("sync");

Type = require("Type");

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
  if (isPending) {
    return;
  }
  return this._tryFulfilling(value);
});

type.defineMethods({
  then: function(onFulfilled, onRejected) {
    var promise, resolver;
    if (!this._canResolve(onFulfilled, onRejected)) {
      return this;
    }
    this._unhandled = false;
    promise = Promise._defer();
    if (this.isPending) {
      this._queue.push(QueueItem(promise, onFulfilled, onRejected));
    } else {
      resolver = this.isFulfilled ? onFulfilled : onRejected;
      promise._unwrap(resolver, this);
    }
    return promise;
  },
  fail: function(onRejected) {
    return this.then(null, onRejected);
  },
  always: function(onResolved) {
    var onFulfilled, onRejected, splice;
    assertType(onResolved, Function);
    splice = Array.prototype.splice;
    onFulfilled = function() {
      splice.call(arguments, 0, 0, null);
      return onResolved.apply(null, arguments);
    };
    onRejected = function() {
      splice.call(arguments, 1, 0, null);
      return onResolved.apply(null, arguments);
    };
    return this.then(onFulfilled, onRejected);
  },
  inspect: function() {
    return {
      value: this._results[0],
      state: this._state > 0 ? "fulfilled" : this._state < 0 ? "rejected" : "pending"
    };
  },
  curry: function() {
    var i, len, value;
    for (i = 0, len = arguments.length; i < len; i++) {
      value = arguments[i];
      this._results.push(value);
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
    var i, item, len, ref1;
    if (!this.isPending) {
      return;
    }
    assert(!isType(value, Promise), "Cannot fulfill with a Promise as the result!");
    this._state = 1;
    this._results[0] = value;
    if (this._queue.length) {
      ref1 = this._queue;
      for (i = 0, len = ref1.length; i < len; i++) {
        item = ref1[i];
        item.fulfill(this);
      }
    }
    this._queue = null;
  },
  _reject: function(error) {
    var i, item, len, ref1;
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
      ref1 = this._queue;
      for (i = 0, len = ref1.length; i < len; i++) {
        item = ref1[i];
        item.reject(this);
      }
    }
    this._queue = null;
  },
  _tryFulfilling: function(value) {
    var resolver, result;
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
  _unwrap: function(resolver, promise) {
    var args, index, length;
    assertType(resolver, Function.Maybe);
    assertType(promise, Promise);
    assert(!promise.isPending, "Promise must be resolved before unwrapping!");
    args = promise._results;
    length = args.length;
    if (length > 1) {
      index = 1;
      while (index < length) {
        this._results.push(args[index]);
        index += 1;
      }
    }
    if (!resolver) {
      if (promise.isFulfilled) {
        this._fulfill(args[0]);
      } else {
        this._reject(args[0]);
      }
      return;
    }
    return immediate((function(_this) {
      return function() {
        var error, result;
        try {
          result = resolver.apply(null, args);
          assert(result !== _this, "Cannot resolve a Promise with itself!");
        } catch (error1) {
          error = error1;
          _this._reject(error);
          return;
        }
        return _this._tryFulfilling(result);
      };
    })(this));
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
  "try": function(resolver) {
    var promise;
    assertType(resolver, Function);
    promise = Promise._defer();
    promise._fulfill();
    return promise.then(resolver);
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
      push.call(args, function(error, result) {
        if (error) {
          return deferred._reject(error);
        } else {
          return deferred._fulfill(result);
        }
      });
      func.apply(this, args);
      return deferred;
    };
  },
  all: function(array) {
    var deferred, fulfill, i, index, len, length, reject, resolved, results, value;
    assertType(array, Array);
    length = array.length;
    if (!length) {
      return Promise([]);
    }
    resolved = 0;
    results = new Array(length);
    deferred = Promise._defer();
    reject = bindMethod(deferred, "_reject");
    fulfill = function(result, index) {
      resolved += 1;
      results[index] = result;
      if (resolved !== length) {
        return;
      }
      return deferred._fulfill(results);
    };
    for (index = i = 0, len = array.length; i < len; index = ++i) {
      value = array[index];
      Promise(value).fail(reject).curry(index).then(fulfill);
    }
    return deferred;
  },
  map: function(iterable, iterator) {
    assertType(iterable, [Array, Object, null]);
    assertType(iterator, Function);
    return Promise.all(sync.map(iterable, function(value, key) {
      return Promise["try"](function() {
        return iterator.call(null, value, key);
      });
    }));
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
