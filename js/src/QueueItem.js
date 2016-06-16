var Type, assert, getArgProp, type;

getArgProp = require("getArgProp");

assert = require("assert");

Type = require("Type");

type = Type("QueueItem");

type.argumentTypes = {
  promise: Object.Kind,
  onFulfilled: Function.Maybe,
  onRejected: Function.Maybe
};

type.defineValues({
  promise: getArgProp(0),
  onFulfilled: getArgProp(1),
  onRejected: getArgProp(2)
});

type.defineMethods({
  fulfill: function(promise) {
    assert(promise.isFulfilled, "'promise' must be fulfilled!");
    if (!this.promise.isPending) {
      return;
    }
    promise._thenResolve(this.promise, this.onFulfilled);
  },
  reject: function(promise) {
    assert(promise.isRejected, "'promise' must be rejected!");
    if (!this.promise.isPending) {
      return;
    }
    promise._thenResolve(this.promise, this.onRejected);
  }
});

module.exports = type.build();

//# sourceMappingURL=../../map/src/QueueItem.map
