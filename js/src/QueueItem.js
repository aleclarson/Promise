var Shape, Type, type;

Shape = require("type-utils").Shape;

Type = require("Type");

type = Type("QueueItem");

type.argumentTypes = {
  promise: Object.Kind,
  onFulfilled: Function.Maybe,
  onRejected: Function.Maybe
};

type.createInstance(function(promise, onFulfilled, onRejected) {
  return {
    promise: promise,
    onFulfilled: onFulfilled,
    onRejected: onRejected
  };
});

type.defineMethods({
  fulfill: function(promise) {
    return this.promise._unwrap(this.onFulfilled, promise);
  },
  reject: function(promise) {
    return this.promise._unwrap(this.onRejected, promise);
  }
});

module.exports = type.build();

//# sourceMappingURL=../../map/src/QueueItem.map
