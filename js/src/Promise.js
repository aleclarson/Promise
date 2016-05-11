var Any, Promise, QueueItem, Type, assert, assertType, bindMethod, getResolver, immediate, isType, ref, tryCatch, type;

require("isNodeJS");

ref = require("type-utils"), Any = ref.Any, isType = ref.isType, assert = ref.assert, assertType = ref.assertType;

bindMethod = require("bindMethod");

immediate = require("immediate");

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
  _result: null,
  _unhandled: isNodeJS ? true : void 0,
  _queue: function() {
    return [];
  }
});

type.defineProperties({
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
    promise = Promise._defer();
    if (isNodeJS) {
      this._unhandled = false;
    }
    if (this.isPending) {
      this._queue.push(QueueItem(this, onFulfilled, onRejected));
    } else {
      resolver = this.isFulfilled ? onFulfilled : onRejected;
      promise._unwrap(resolver, this._result);
    }
    return promise;
  },
  fail: function(onRejected) {
    return this.then(null, onRejected);
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
    this._state = 1;
    this._result = value;
    if (this._queue.length) {
      ref1 = this._queue;
      for (i = 0, len = ref1.length; i < len; i++) {
        item = ref1[i];
        item.fulfill(value);
      }
    }
    this._queue = null;
  },
  _reject: function(error) {
    var i, item, len, ref1;
    if (!this.isPending) {
      return;
    }
    this._state = -1;
    this._result = error;
    if (isNodeJS && this._unhandled) {
      immediate((function(_this) {
        return function() {
          if (!_this._unhandled) {
            return;
          }
          return process.emit("unhandledRejection", error, _this);
        };
      })(this));
    }
    if (this._queue.length) {
      ref1 = this._queue;
      for (i = 0, len = ref1.length; i < len; i++) {
        item = ref1[i];
        item.reject(error);
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
    reject = bindMethod(this, "_reject");
    resolve = bindMethod(this, "_tryFulfilling");
    error = tryCatch(function() {
      return resolver(resolve, reject);
    }).error;
    if (error) {
      reject(error);
    }
  },
  _unwrap: function(resolver, value) {
    return immediate((function(_this) {
      return function() {
        var error, result;
        try {
          result = resolver(value);
          assert(result !== promise, "Cannot resolve a Promise with itself!");
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
    var deferred, i, index, len, length, promise, reject, resolved, results, value;
    assertType(array, Array);
    length = array.length;
    if (!length) {
      return Promise.resolve([]);
    }
    deferred = Promise._defer();
    reject = bindMethod(deferred, "_reject");
    results = new Array(length);
    resolved = 0;
    for (index = i = 0, len = array.length; i < len; index = ++i) {
      value = array[index];
      promise = Promise.resolve(value);
      promise.fail(reject);
      promise.then(function(result) {
        resolved += 1;
        results[index] = result;
        if (resolved !== length) {
          return;
        }
        return deferred._fulfill(results);
      });
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
  }
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
