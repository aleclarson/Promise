var FakeError, Promise, getType, immediate;

FakeError = require("FakeError");

immediate = require("immediate");

getType = require("getType");

Promise = require("../src/Promise");

describe("Promise(value)", function() {
  it("returns a new Promise that is fulfilled with `value`", function() {
    var foo;
    foo = Promise(1);
    return expect(foo._results[0]).toBe(1);
  });
  return describe("but if `value` is a Promise", function() {
    return it("simply returns the `value`", function() {
      var bar, foo;
      foo = Promise();
      bar = Promise(foo);
      return expect(foo).toBe(bar);
    });
  });
});

describe("Promise.reject(error)", function() {
  it("returns a new Promise that is rejected with `error`", function() {
    var error, foo;
    error = FakeError();
    foo = Promise.reject(error);
    foo._unhandled = false;
    return expect(foo._results[0]).toBe(error);
  });
  return it("throws if `error` is not an instanceof Error", function() {
    return expect(function() {
      return Promise.reject(null);
    }).toThrowError("Expected a kind of Error!");
  });
});

describe("Promise.defer()", function() {
  it("returns an object with `promise`, `resolve`, and `reject` keys", function() {
    var deferred;
    deferred = Promise.defer();
    return expect(Object.keys(deferred)).toEqual(["promise", "resolve", "reject"]);
  });
  describe("deferred.promise", function() {});
  it("is a new Promise that is still pending", function() {
    var deferred;
    deferred = Promise.defer();
    return expect(deferred.promise.isPending).toBe(true);
  });
  return describe("deferred.resolve(value)", function() {
    it("fulfills `deferred.promise` with `value`", function() {
      var deferred;
      deferred = Promise.defer();
      deferred.resolve(1);
      return expect(deferred.promise._results[0]).toBe(1);
    });
    return describe("but if `value` is a Promise", function() {
      it("waits until the promise is fulfilled", function(done) {
        var bar, bar2, foo;
        foo = Promise.defer();
        bar = Promise.defer();
        bar.resolve(foo.promise);
        expect(bar.promise.isPending).toBe(true);
        expect(foo.promise._queue.length).toBe(1);
        bar2 = foo.promise._queue[0];
        foo.resolve(1);
        return immediate(function() {
          expect(bar.promise.isFulfilled).toBe(true);
          expect(bar.promise._results[0]).toBe(1);
          return done();
        });
      });
      return it("or until the promise is rejected", function(done) {
        var bar, error, foo;
        foo = Promise.defer();
        bar = Promise.defer();
        bar.resolve(foo.promise);
        bar.promise._unhandled = false;
        error = FakeError();
        foo.reject(error);
        expect(foo.promise._unhandled).toBe(false);
        expect(bar.promise.isPending).toBe(true);
        return immediate(function() {
          expect(bar.promise.isRejected).toBe(true);
          expect(bar.promise._results[0]).toBe(error);
          return done();
        });
      });
    });
  });
});

describe("Promise.resolve(resolver)", function() {
  it("expects `resolver` to be a Function", function() {
    return expect(function() {
      return Promise.resolve(null);
    }).toThrowError("Expected a Function!");
  });
  it("passes the `resolve` and `reject` functions to `resolver`", function(done) {
    return Promise.resolve(function(resolve, reject) {
      expect(getType(resolve)).toBe(Function);
      expect(getType(reject)).toBe(Function);
      return done();
    });
  });
  return it("creates a Promise that is resolved by the `resolver`", function(done) {
    var promise;
    promise = Promise.resolve(function(resolve) {
      return resolve(1);
    });
    expect(getType(promise)).toBe(Promise);
    return immediate(function() {
      expect(promise._results[0]).toBe(1);
      return done();
    });
  });
});

describe("Promise.try(func)", function() {
  it("catches any error thrown by `func`", function(done) {
    var error, promise;
    error = FakeError();
    promise = Promise["try"](function() {
      throw error;
    });
    promise._unhandled = false;
    return immediate(function() {
      expect(promise._results[0]).toBe(error);
      return done();
    });
  });
  it("fulfills if `func` returns a non-Promise value", function(done) {
    var promise;
    promise = Promise["try"](function() {
      return 1;
    });
    return immediate(function() {
      expect(promise._results[0]).toBe(1);
      return done();
    });
  });
  it("calls `promise.always` if `func` returns a Promise", function(done) {
    var bar, barTry, foo, fooTry;
    foo = Promise.defer();
    fooTry = Promise["try"](function() {
      return foo.promise;
    });
    bar = Promise.defer();
    barTry = Promise["try"](function() {
      return bar.promise;
    });
    barTry._unhandled = false;
    return immediate(function() {
      var barResult, fooResult;
      foo.resolve(fooResult = 1);
      bar.reject(barResult = FakeError());
      expect(fooTry.isPending).toBe(true);
      expect(barTry.isPending).toBe(true);
      return immediate(function() {
        expect(fooTry.isFulfilled).toBe(true);
        expect(barTry.isRejected).toBe(true);
        expect(fooTry._results[0]).toBe(fooResult);
        expect(barTry._results[0]).toBe(barResult);
        return done();
      });
    });
  });
  return it("guarantees that `func` will not be called until the next event loop tick", function(done) {
    var promise, spy;
    spy = jasmine.createSpy();
    promise = Promise["try"](function() {
      return spy();
    });
    expect(spy.calls.count()).toBe(0);
    return immediate(function() {
      expect(spy.calls.count()).toBe(1);
      return done();
    });
  });
});

describe("Promise.wrap(func)", function() {
  it("wraps `func` in a call to Promise.try", function(done) {
    var func, promise;
    func = Promise.wrap(function() {
      return 1;
    });
    promise = func();
    return immediate(function() {
      expect(promise._results[0]).toBe(1);
      return done();
    });
  });
  it("catches any error thrown by `func`", function(done) {
    var error, func, promise;
    error = FakeError();
    func = Promise.wrap(function() {
      throw error;
    });
    promise = func();
    promise._unhandled = false;
    return immediate(function() {
      expect(promise._results[0]).toBe(error);
      return done();
    });
  });
  return it("waits on any promise returned by `func`", function(done) {
    var bar, foo, func;
    foo = Promise(1);
    func = Promise.wrap(function() {
      return foo;
    });
    bar = func();
    return immediate(function() {
      return immediate(function() {
        expect(bar._results[0]).toBe(1);
        return done();
      });
    });
  });
});

describe("Promise.ify(func)", function() {
  it("returns a rejected Promise if `callback` passes an error immediately", function() {
    var error, func, promise;
    error = FakeError();
    func = Promise.ify(function(callback) {
      return callback(error);
    });
    promise = func();
    promise._unhandled = false;
    expect(promise.isRejected).toBe(true);
    return expect(promise._results[0]).toBe(error);
  });
  it("returns a fulfilled Promise if `callback` passes a result immediately", function() {
    var func, promise;
    func = Promise.ify(function(callback) {
      return callback(null, 1);
    });
    promise = func();
    return expect(promise._results[0]).toBe(1);
  });
  it("returns a pending Promise if `callback` is not called immediately", function(done) {
    var func, promise;
    func = Promise.ify(function(callback) {
      return setTimeout(callback, 100);
    });
    promise = func();
    expect(promise.isPending).toBe(true);
    return promise.then(done);
  });
  return it("pushes `callback` onto the end of `arguments`", function() {
    var func, promise;
    func = Promise.ify(function(arg1, callback) {
      return callback(null, arg1);
    });
    promise = func(1);
    return expect(promise._results[0]).toBe(1);
  });
});

describe("Promise.all(array)", function() {
  it("creates a new Promise that resolves once every item in `array` is resolved", function(done) {
    var bar, foo;
    foo = Promise(1);
    bar = Promise.defer();
    Promise.all([foo, bar.promise]).then(function(results) {
      expect(results).toEqual([1, 2]);
      return done();
    });
    return bar.resolve(2);
  });
  it("rejects the new Promise if one of the items in `array` is rejected", function(done) {
    var bar, error, foo;
    foo = Promise(1);
    bar = Promise.defer();
    error = FakeError();
    immediate(function() {
      return bar.reject(error);
    });
    return Promise.all([foo, bar.promise]).fail(function() {
      expect(arguments[0]).toBe(error);
      return done();
    });
  });
  return it("allows non-Promise values in `array`", function(done) {
    var input;
    input = [1, 2];
    return Promise.all(input).then(function(output) {
      expect(output).toEqual(input);
      return done();
    });
  });
});

describe("Promise.map(array)", function() {
  it("iterates an Array, wrapping each value with a Promise", function(done) {
    var input;
    input = [1, 2];
    return Promise.map(input, function(value, index) {
      return value + index;
    }).then(function(output) {
      expect(output).toEqual([1, 3]);
      return done();
    });
  });
  return it("can iterate an Object too", function(done) {
    var input;
    input = {
      a: 1,
      b: 2
    };
    return Promise.map(input, function(value, key) {
      expect(getType(key)).toBe(String);
      return value + 2;
    }).then(function(output) {
      expect(getType(output)).toBe(Object);
      expect(output.a).toBe(3);
      expect(output.b).toBe(4);
      return done();
    });
  });
});

describe("Promise.chain(array)", function() {
  return it("only resolves one item in `array` at a time", function(done) {
    var bar, foo, index, input, spy;
    foo = Promise.defer();
    bar = Promise.defer();
    spy = jasmine.createSpy();
    index = 0;
    input = [foo, bar];
    return Promise.chain(input, function(deferred) {
      var count;
      count = ++index;
      expect(spy.calls.count()).toBe(count - 1);
      immediate(function() {
        spy();
        expect(spy.calls.count()).toBe(count);
        return deferred.resolve();
      });
      return deferred.promise;
    }).then(function() {
      return done();
    });
  });
});

describe("promise.then(onFulfilled, onRejected)", function() {
  it("fulfills the new Promise if `onFulfilled` does not throw", function(done) {
    var bar, foo;
    foo = Promise(1);
    bar = foo.then(function() {
      return 2;
    });
    expect(bar.isPending).toBe(true);
    return immediate(function() {
      expect(bar.isFulfilled).toBe(true);
      return done();
    });
  });
  it("fulfills the new Promise if `onRejected` does not throw", function(done) {
    var bar, foo;
    foo = Promise.reject(FakeError());
    bar = foo.fail(function() {
      return 1;
    });
    expect(bar.isPending).toBe(true);
    return immediate(function() {
      expect(bar.isFulfilled).toBe(true);
      return done();
    });
  });
  it("rejects the new Promise if `onFulfilled` throws an error", function(done) {
    var bar, foo;
    foo = Promise(1);
    bar = foo.then(function() {
      throw FakeError();
    });
    bar._unhandled = false;
    expect(bar.isPending).toBe(true);
    return immediate(function() {
      expect(bar.isRejected).toBe(true);
      return done();
    });
  });
  it("rejects the new Promise if `onRejected` throws an error", function(done) {
    var bar, barError, foo, fooError;
    fooError = FakeError();
    foo = Promise.reject(fooError);
    barError = FakeError();
    bar = foo.fail(function(error) {
      throw barError;
    });
    bar._unhandled = false;
    expect(bar.isPending).toBe(true);
    return immediate(function() {
      expect(bar.isRejected).toBe(true);
      return done();
    });
  });
  it("supports returning a Promise inside `onFulfilled`", function(done) {
    var bar, deferred, foo;
    deferred = Promise.defer();
    foo = Promise(1);
    bar = foo.then(function() {
      return deferred.promise;
    });
    expect(bar.isPending).toBe(true);
    return immediate(function() {
      expect(bar.isPending).toBe(true);
      deferred.resolve(2);
      return immediate(function() {
        expect(bar.isFulfilled).toBe(true);
        expect(bar._results[0]).toBe(2);
        return done();
      });
    });
  });
  return it("supports returning a Promise inside `onRejected`", function(done) {
    var bar, deferred, foo;
    deferred = Promise.defer();
    foo = Promise.reject(FakeError());
    bar = foo.fail(function() {
      return deferred.promise;
    });
    expect(bar.isPending).toBe(true);
    return immediate(function() {
      expect(bar.isPending).toBe(true);
      deferred.resolve(2);
      return immediate(function() {
        expect(bar.isFulfilled).toBe(true);
        expect(bar._results[0]).toBe(2);
        return done();
      });
    });
  });
});

describe("promise.always(onResolved)", function() {
  it("inherits the result of `this` when it's fulfilled", function(done) {
    var bar, foo;
    foo = Promise(1);
    bar = foo.always(function(error, result) {
      expect(error).toBe(null);
      expect(result).toBe(foo._results[0]);
      return 2;
    });
    return bar.then(function() {
      expect(arguments[0]).toBe(foo._results[0]);
      return done();
    });
  });
  it("inherits the error of `this` when it's rejected", function(done) {
    var bar, foo;
    foo = Promise.reject(FakeError());
    bar = foo.always(function(error, result) {
      expect(error).toBe(foo._results[0]);
      return expect(result).toBe(null);
    });
    return bar.fail(function(error) {
      expect(error).toBe(foo._results[0]);
      return done();
    });
  });
  it("supports `onResolved` returning a Promise", function(done) {
    var bar, deferred, foo;
    foo = Promise(1);
    deferred = Promise.defer();
    bar = foo.always(function() {
      return deferred.promise;
    });
    return immediate(function() {
      expect(bar.isPending).toBe(true);
      deferred.resolve(2);
      return bar.then(function() {
        expect(bar.isFulfilled).toBe(true);
        expect(bar._results[0]).toBe(1);
        return done();
      });
    });
  });
  return it("catches any errors thrown inside `onResolved`", function(done) {
    var bar, error;
    error = FakeError();
    bar = Promise().always(function() {
      throw error;
    });
    bar._unhandled = false;
    expect(bar.isPending).toBe(true);
    return immediate(function() {
      expect(bar.isRejected).toBe(true);
      expect(bar._results[0]).toBe(error);
      return done();
    });
  });
});

describe("promise.curry(args...)", function() {
  it("returns a fulfilled Promise if `promise` is fulfilled", function() {
    var bar, foo;
    foo = Promise(1);
    bar = foo.curry(2, 3);
    expect(bar.isFulfilled).toBe(true);
    return expect(bar._results).toEqual([1, 2, 3]);
  });
  it("returns a rejected Promise if `promise` is rejected", function() {
    var bar, error, foo;
    error = FakeError();
    foo = Promise.reject(error);
    bar = foo.curry(2, 3);
    bar._unhandled = false;
    expect(foo._unhandled).toBe(false);
    expect(bar.isRejected).toBe(true);
    return expect(bar._results).toEqual([error, 2, 3]);
  });
  return it("returns a pending Promise if `promise` is pending", function(done) {
    var bar, foo;
    foo = Promise["try"](function() {
      return 1;
    });
    bar = foo.curry(2, 3);
    expect(bar.isPending).toBe(true);
    expect(bar._results).toEqual([void 0]);
    return bar.then(function() {
      expect(bar.isFulfilled).toBe(true);
      expect(bar._results).toEqual([1, 2, 3]);
      return done();
    });
  });
});

//# sourceMappingURL=../../map/spec/Promise.map
