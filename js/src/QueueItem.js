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
    var next;
    assert(promise.isFulfilled, "'promise' must be fulfilled!");
    next = this.promise;
    if (!next.isPending) {
      return;
    }
    promise._thenResolve(next, this.onFulfilled);
  },
  reject: function(promise) {
    var next;
    assert(promise.isRejected, "'promise' must be rejected!");
    next = this.promise;
    if (!next.isPending) {
      return;
    }
    promise._thenResolve(next, this.onRejected);
  }
});

module.exports = type.build();

//# sourceMappingURL=../../map/src/QueueItem.map
