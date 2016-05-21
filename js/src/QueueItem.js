var Type, getArgProp, type;

getArgProp = require("getArgProp");

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
    return this.promise._unwrap(this.onFulfilled, promise);
  },
  reject: function(promise) {
    return this.promise._unwrap(this.onRejected, promise);
  }
});

module.exports = type.build();

//# sourceMappingURL=../../map/src/QueueItem.map
