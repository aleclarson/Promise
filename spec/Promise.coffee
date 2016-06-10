
# TODO: Write tests!

immediate = require "immediate"
getType = require "getType"

Promise = require "../src/Promise"

describe "Promise(value)", ->

  it "returns a new Promise that is fulfilled with `value`", ->
    foo = Promise 1
    expect foo._results[0]
      .toBe 1

  describe "but if `value` is a Promise", ->

    it "simply returns the `value`", ->
      foo = Promise()
      bar = Promise foo
      expect foo
        .toBe bar

describe "Promise.reject(error)", ->

  it "returns a new Promise that is rejected with `error`", ->

    error = Error "foo threw!"
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
      .toBe true

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
          .toBe true

        expect foo.promise._queue.length
          .toBe 1

        bar2 = foo.promise._queue[0]

        foo.resolve 1

        immediate ->

          expect bar.promise.isFulfilled
            .toBe true

          expect bar.promise._results[0]
            .toBe 1

          done()

      it "or until the promise is rejected", (done) ->
        foo = Promise.defer()
        bar = Promise.defer()

        bar.resolve foo.promise
        expect bar.promise.isPending
          .toBe true

        error = Error "foo threw!"
        foo.reject error

        # Prevent reporting.
        bar.promise._unhandled = no

        immediate ->

          expect bar.promise.isRejected
            .toBe true

          expect bar.promise._results[0]
            .toBe error

          done()

describe "Promise.resolve(resolver)", ->

  it "expects `resolver` to be a Function", ->
    expect -> Promise.resolve null
      .toThrowError "Expected a Function!"

  it "passes the `resolve` and `reject` functions to `resolver`", (done) ->

    Promise.resolve (resolve, reject) ->

      expect getType resolve
        .toBe Function

      expect getType reject
        .toBe Function

      done()

  it "creates a Promise that is resolved by the `resolver`", (done) ->

    promise = Promise.resolve (resolve) -> resolve 1

    expect getType promise
      .toBe Promise

    immediate ->

      expect promise._results[0]
        .toBe 1

      done()

describe "Promise.try(func)", ->

  it "catches any error thrown by `func`", (done) ->

    error = Error "test"
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

  it "waits on any promise returned by `func`", (done) ->

    foo = Promise 1
    bar = Promise.try -> foo

    # The promise will yield twice.
    immediate -> immediate ->

      expect bar.isFulfilled
        .toBe yes

      expect bar._results[0]
        .toBe 1

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

describe "Promise.wrap(func)", ->

  it "wraps `func` in a call to Promise.try", (done) ->

    func = Promise.wrap -> 1
    promise = func()

    immediate ->

      expect promise._results[0]
        .toBe 1

      done()

  it "catches any error thrown by `func`", (done) ->

    error = Error "test"
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

  it "converts an (error, result) callback into a promise generator", (done) ->

    func = Promise.ify (arg1, callback) ->
      callback null, arg1 + 1

    promise = func 0

    immediate ->

      expect promise._results[0]
        .toBe 1

      done()

  it "rejects the generated promise if an error is passed to the callback", (done) ->

    error = Error "test"
    func = Promise.ify (callback) ->
      callback error

    promise = func()

    # Prevent reporting.
    promise._unhandled = no

    immediate ->

      expect promise._results[0]
        .toBe error

      done()

describe "Promise.all(array)", ->

  it "creates a new Promise that resolves once every item in `array` is resolved", (done) ->

    foo = Promise 1
    bar = Promise.defer()

    Promise.all [ foo, bar.promise ]

    .then (results) ->

      expect results
        .toEqual [ 1, 2 ]

      done()

    bar.resolve 2

  it "rejects the new Promise if one of the items in `array` is rejected", (done) ->

    foo = Promise 1
    bar = Promise.defer()

    Promise.all [ foo, bar.promise ]

    .fail ->

      expect arguments[0]
        .toBe error

      done()

    error = Error "test"
    bar.reject error

    # Prevent reporting.
    bar._unhandled = no

  it "allows non-Promise values in `array`", (done) ->

    input = [ 1, 2 ]

    Promise.all input

    .then (output) ->

      expect output
        .toEqual input

      done()

describe "Promise.map(array)", ->

  it "iterates an Array, wrapping each value with a Promise", (done) ->

    input = [ 1, 2 ]

    Promise.map input, (value, index) ->
      return value + index

    .then (output) ->

      expect output
        .toEqual [ 1, 3 ]

      done()

  it "can iterate an Object too", (done) ->

    input = { a: 1, b: 2 }

    Promise.map input, (value, key) ->

      expect getType key
        .toBe String

      return value + 2

    .then (output) ->

      expect output
        .toEqual [ 3, 4 ]

      done()

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

describe "promise.then(onFulfilled, onRejected)", ->

describe "promise.always(onResolved)", ->

  it "inherits the error of `this` when it's rejected", (done) ->

    foo = Promise.reject Error "foo threw!"

    bar = foo.always (error, result) ->

      expect error
        .toBe foo._results[0]

      expect result
        .toBe null

      throw Error "bar threw!"

    bar.fail (error) ->

      expect error
        .toBe foo._results[0]

      done()

  it "inherits the result of `this` when it's fulfilled", (done) ->

    foo = Promise 1
    bar = foo.always (error, result) ->

      expect error
        .toBe null

      expect result
        .toBe foo._results[0]

      return 2

    bar.then ->

      expect arguments[0]
        .toBe foo._results[0]

      done()

describe "promise.curry(args...)", ->

  it "attaches results onto a new Promise", (done) ->

    foo = Promise 1
    bar = foo.curry 2, 3

    expect bar
      .not.toBe foo

    expect bar._results
      .toEqual [ undefined ]

    bar.then ->

      expect bar._results
        .toEqual [ 1, 2, 3 ]

      done()
