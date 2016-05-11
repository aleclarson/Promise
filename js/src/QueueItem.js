var Shape, Type, type;

Shape = require("type-utils").Shape;

Type = require("Type");

type = Type("QueueItem");

type.argumentTypes = {
  promise: Object.Kind,
  onFulfilled: Function.Maybe,
  onRejected: Function.Maybe
};

type.initInstance(function(promise, onFulfilled, onRejected) {
  this.promise = promise;
  if (isType(onFulfilled, Function)) {
    this.onFulfilled = onFulfilled;
    this.fulfill = this._resolveFulfilled;
  }
  if (isType(onRejected, Function)) {
    this.onRejected = onRejected;
    return this.reject = this._resolveRejected;
  }
});

type.defineMethods({
  fulfill: function(value) {
    return this.promise._tryFulfilling(value);
  },
  reject: function(error) {
    return this.promise._reject(error);
  },
  _resolveFulfilled: function(value) {
    return this.promise._unwrap(this.onFulfilled, value);
  },
  _resolveRejected: function(error) {
    return this.promise._unwrap(this.onRejected, error);
  }
});

module.exports = type.build();

//# sourceMappingURL=../../map/src/QueueItem.map
