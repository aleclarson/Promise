
FakeError = require "FakeError"
immediate = require "immediate"
getType = require "getType"

Promise = require "../js/Promise"

describe "Promise(value)", ->

  it "returns a new Promise that is fulfilled with `value`", ->

    foo = Promise 1

    expect foo._results[0]
      .toBe 1

  it "can be passed another Promise", ->

    foo = Promise.defer()

    bar = Promise foo.promise

    foo.resolve 1

    expect bar.isPending
      .toBe yes

    immediate ->

      expect bar.isFulfilled
        .toBe yes

      expect bar._results[0]
        .toBe 1

  it "inherits any other values passed", ->

    foo = Promise 1, 2, 3

    expect foo._results
      .toEqual [ 1, 2, 3 ]

describe "Promise.reject(error)", ->

  it "returns a new Promise that is rejected with `error`", ->

    error = FakeError()
    foo = Promise.reject error

    # Prevent reporting.
    foo._unhandled = no

    expect foo._results[0]
      .toBe error

  it "throws if `error` is not an instanceof Error", ->
    expect -> Promise.reject null
      .toThrowError "Expected a kind of Error!"

describe "Promise.defer()", ->

  it "returns an object with `promise`, `resolve`, and `reject` keys", ->
    deferred = Promise.defer()
    expect Object.keys(deferred)
      .toEqual [ "promise", "resolve", "reject" ]

  describe "deferred.promise", ->

  it "is a new Promise that is still pending", ->
    deferred = Promise.defer()
    expect deferred.promise.isPending
      .toBe yes

  describe "deferred.resolve(value)", ->

    it "fulfills `deferred.promise` with `value`", ->
      deferred = Promise.defer()
      deferred.resolve 1
      expect deferred.promise._results[0]
        .toBe 1

    describe "but if `value` is a Promise", ->

      it "waits until the promise is fulfilled", (done) ->
        foo = Promise.defer()
        bar = Promise.defer()

        bar.resolve foo.promise

        expect bar.promise.isPending
          .toBe yes

        expect foo.promise._queue.length
          .toBe 1

        bar2 = foo.promise._queue[0]

        foo.resolve 1

        immediate ->

          expect bar.promise.isFulfilled
            .toBe yes

          expect bar.promise._results[0]
            .toBe 1

          done()

      it "or until the promise is rejected", (done) ->

        foo = Promise.defer()
        bar = Promise.defer()

        bar.resolve foo.promise
        bar.promise._unhandled = no

        error = FakeError()
        foo.reject error

        expect foo.promise._unhandled
          .toBe no

        expect bar.promise.isPending
          .toBe yes

        immediate ->

          expect bar.promise.isRejected
            .toBe yes

          expect bar.promise._results[0]
            .toBe error

          done()

describe "Promise.defer(resolver)", ->

  it "passes the `resolve` and `reject` functions to `resolver`", (done) ->

    Promise.defer (resolve, reject) ->

      expect getType resolve
        .toBe Function

      expect getType reject
        .toBe Function

      done()

  it "creates a Promise that is resolved by the `resolver`", (done) ->

    promise = Promise.defer (resolve) -> resolve 1

    expect getType promise
      .toBe Promise

    immediate ->

      expect promise._results[0]
        .toBe 1

      done()

describe "Promise.try(func)", ->

  it "catches any error thrown by `func`", (done) ->

    error = FakeError()
    promise = Promise.try ->
      throw error

    # Prevent reporting.
    promise._unhandled = no

    immediate ->

      expect promise._results[0]
        .toBe error

      done()

  it "fulfills if `func` returns a non-Promise value", (done) ->

    promise = Promise.try -> 1

    immediate ->

      expect promise._results[0]
        .toBe 1

      done()

  it "calls `promise.always` if `func` returns a Promise", (done) ->

    foo = Promise.defer()
    fooTry = Promise.try -> foo.promise

    bar = Promise.defer()
    barTry = Promise.try -> bar.promise
    barTry._unhandled = no

    immediate ->

      foo.resolve fooResult = 1
      bar.reject barResult = FakeError()

      expect fooTry.isPending
        .toBe yes

      expect barTry.isPending
        .toBe yes

      immediate ->

        expect fooTry.isFulfilled
          .toBe yes

        expect barTry.isRejected
          .toBe yes

        expect fooTry._results[0]
          .toBe fooResult

        expect barTry._results[0]
          .toBe barResult

        done()

  it "guarantees that `func` will not be called until the next event loop tick", (done) ->

    spy = jasmine.createSpy()
    promise = Promise.try -> spy()

    expect spy.calls.count()
      .toBe 0

    immediate ->

      expect spy.calls.count()
        .toBe 1

      done()

describe "Promise.all(array, iterator)", ->

  it "creates a new Promise that resolves once every item in `array` is resolved", (done) ->

    foo = Promise 1
    bar = Promise.defer()

    Promise.all [ foo, bar.promise ]

    .then ->

      expect foo.isPending
        .toBe no

      expect bar.promise.isPending
        .toBe no

      done()

    bar.resolve()

  it "rejects the new Promise if one of the items in `array` is rejected", (done) ->

    foo = Promise 1
    bar = Promise.defer()

    error = FakeError()
    immediate -> bar.reject error

    Promise.all [ foo, bar.promise ]

    .fail ->

      expect arguments[0]
        .toBe error

      done()

  it "passes each (value, index) pair to the iterator, if one is defined", (done) ->

    spy = jasmine.createSpy()
    input = [ 1, 2 ]

    Promise.all input, (value, index) -> spy [ value, index ]

    .then ->

      expect spy.calls.count()
        .toBe 2

      expect spy.calls.argsFor 0
        .toEqual [[ 1, 0 ]]

      expect spy.calls.argsFor 1
        .toEqual [[ 2, 1 ]]

      done()

  it "allows non-Promise values in `array`", (done) ->

    foo = Promise.defer()

    Promise.all [ 1, 2, foo.promise ]

    .then ->

      expect foo.promise.isPending
        .toBe no

      done()

    foo.resolve()

  it "creates an array of resolved values", (done) ->

    input = [ 1, 2 ]

    Promise.all input

    .then (output) ->

      expect output
        .toEqual input

      done()

  it "works with object literals too", (done) ->

    input = { a: 1, b: 2 }

    Promise.all input, (value, key) -> key + ":" + value

    .then (output) ->

      expect getType output
        .toBe Object

      expect output.a
        .toBe "a:1"

      expect output.b
        .toBe "b:2"

      done()

  it "always returns a pending Promise", ->

    # Test with 0 promises.
    p1 = Promise.all []
    expect p1.isPending
      .toBe yes

    # Test with 1 promise.
    p2 = Promise.all [p1]
    expect p2.isPending
      .toBe yes

describe "Promise.chain(array)", ->

  it "only resolves one item in `array` at a time", (done) ->

    foo = Promise.defer()
    bar = Promise.defer()

    spy = jasmine.createSpy()
    index = 0
    input = [ foo, bar ]

    Promise.chain input, (deferred) ->

      count = ++index

      expect spy.calls.count()
        .toBe count - 1

      immediate ->

        spy()

        expect spy.calls.count()
          .toBe count

        deferred.resolve()

      return deferred.promise

    .then -> done()

describe "Promise.wrap(func)", ->

  it "wraps `func` in a call to Promise.try", (done) ->

    func = Promise.wrap -> 1
    promise = func()

    immediate ->

      expect promise._results[0]
        .toBe 1

      done()

  it "catches any error thrown by `func`", (done) ->

    error = FakeError()
    func = Promise.wrap -> throw error
    promise = func()

    # Prevent reporting.
    promise._unhandled = no

    immediate ->

      expect promise._results[0]
        .toBe error

      done()

  it "waits on any promise returned by `func`", (done) ->

    foo = Promise 1
    func = Promise.wrap -> foo
    bar = func()

    # The promise will yield twice.
    immediate -> immediate ->

      expect bar._results[0]
        .toBe 1

      done()

describe "Promise.ify(func)", ->

  it "returns a rejected Promise if `callback` passes an error", (done) ->

    error = FakeError()
    func = Promise.ify (callback) ->
      callback error

    promise = func()
    promise._unhandled = no

    expect promise.isPending
      .toBe yes

    immediate ->

      expect promise.isRejected
        .toBe yes

      expect promise._results[0]
        .toBe error

      done()

  it "returns a fulfilled Promise if `callback` doesn't pass an error", (done) ->

    func = Promise.ify (callback) ->
      callback null, 1

    promise = func()

    expect promise.isPending
      .toBe yes

    immediate ->

      expect promise.isFulfilled
        .toBe yes

      expect promise._results[0]
        .toBe 1

      done()

  it "pushes `callback` onto the end of `arguments`", (done) ->

    func = Promise.ify (arg1, arg2, callback) ->
      callback null, [ arg1, arg2 ]

    promise = func 1, 2

    immediate ->

      expect promise._results[0]
        .toEqual [ 1, 2 ]

      done()

describe "promise.then(onFulfilled, onRejected)", ->

  it "fulfills the new Promise if `onFulfilled` does not throw", (done) ->

    foo = Promise 1
    bar = foo.then -> 2

    expect bar.isPending
      .toBe yes

    # `foo` delays one tick before notifying `bar`
    immediate ->

      expect bar.isPending
        .toBe yes

      # `bar` delays one tick before calling its resolver
      immediate ->

        expect bar.isFulfilled
          .toBe yes

      done()

  it "fulfills the new Promise if `onRejected` does not throw", (done) ->

    foo = Promise.reject FakeError()
    bar = foo.fail -> 1

    expect bar.isPending
      .toBe yes

    # `foo` delays one tick before notifying `bar`
    immediate ->

      expect bar.isPending
        .toBe yes

      # `bar` delays one tick before calling its resolver
      immediate ->

        expect bar.isFulfilled
          .toBe yes

        done()

  it "rejects the new Promise if `onFulfilled` throws an error", (done) ->

    foo = Promise 1

    error = FakeError()
    bar = foo.then -> throw error
    bar._unhandled = no

    expect bar.isPending
      .toBe yes

    # `foo` delays one tick before notifying `bar`
    immediate ->

      expect bar.isPending
        .toBe yes

      # `bar` delays one tick before calling its resolver
      immediate ->

        expect bar.isRejected
          .toBe yes

        expect bar._results[0]
          .toBe error

        done()

  it "rejects the new Promise if `onRejected` throws an error", (done) ->

    fooError = FakeError()
    foo = Promise.reject fooError

    barError = FakeError()
    bar = foo.fail (error) -> throw barError
    bar._unhandled = no

    expect bar.isPending
      .toBe yes

    # `foo` delays one tick before notifying `bar`
    immediate ->

      expect bar.isPending
        .toBe yes

      # `bar` delays one tick before calling its resolver
      immediate ->

        expect bar.isRejected
          .toBe yes

        expect bar._results[0]
          .toBe barError

        done()

  it "supports returning a Promise inside `onFulfilled`", (done) ->

    deferred = Promise.defer()
    foo = Promise 1
    bar = foo.then -> deferred.promise

    expect bar.isPending
      .toBe yes

    # `foo` delays one tick before notifying `bar`
    immediate ->

      expect bar.isPending
        .toBe yes

      # `bar` delays one tick before calling its resolver
      immediate ->

        expect bar.isPending
          .toBe yes

        deferred.resolve 2

        # `deferred.promise` delays one tick before resolving `bar`
        immediate ->

          expect bar.isFulfilled
            .toBe yes

          expect bar._results[0]
            .toBe 2

          done()

  it "supports returning a Promise inside `onRejected`", (done) ->

    deferred = Promise.defer()
    foo = Promise.reject FakeError()
    bar = foo.fail -> deferred.promise

    expect bar.isPending
      .toBe yes

    # `foo` delays one tick before notifying `bar`
    immediate ->

      expect bar.isPending
        .toBe yes

      # `bar` delays one tick before calling its resolver
      immediate ->

        expect bar.isPending
          .toBe yes

        deferred.resolve 2

        # `deferred.promise` delays one tick before resolving `bar`
        immediate ->

          expect bar.isFulfilled
            .toBe yes

          expect bar._results[0]
            .toBe 2

          done()

describe "promise.always(onResolved)", ->

  it "calls `onResolved` when `promise` is fulfilled", (done) ->

    Promise expected = 1

    .always ->

      expect arguments.length
        .toBe 0

      return 2

    .then (actual) ->

      expect actual
        .toBe expected

      done()

  it "calls `onResolved` when `promise` is rejected", (done) ->

    Promise.reject expected = FakeError()

    .always ->

      expect arguments.length
        .toBe 0

      return 1

    .fail (actual) ->

      expect actual
        .toBe expected

      done()

  it "allows `onResolved` to return a Promise", (done) ->

    foo = Promise 1

    deferred = Promise.defer()

    bar = foo.always -> deferred.promise

    immediate ->

      expect bar.isPending
        .toBe yes

      deferred.resolve 2

      bar.then ->

        expect bar.isFulfilled
          .toBe yes

        expect bar._results[0]
          .toBe 1

        done()

  it "catches any errors thrown inside `onResolved`", (done) ->

    expected = FakeError()

    Promise.reject FakeError()

    .always -> throw expected

    .fail (actual) ->

      expect actual
        .toBe expected

      done()
