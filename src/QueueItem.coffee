
getArgProp = require "getArgProp"
assert = require "assert"
Type = require "Type"

type = Type "QueueItem"

type.argumentTypes =
  promise: Object.Kind
  onFulfilled: Function.Maybe
  onRejected: Function.Maybe

type.defineValues

  promise: getArgProp 0

  onFulfilled: getArgProp 1

  onRejected: getArgProp 2

type.defineMethods

  fulfill: (promise) ->
    assert promise.isFulfilled, "'promise' must be fulfilled!"
    return if not @promise.isPending
    promise._thenResolve @promise, @onFulfilled
    return

  reject: (promise) ->
    assert promise.isRejected, "'promise' must be rejected!"
    return if not @promise.isPending
    promise._thenResolve @promise, @onRejected
    return

module.exports = type.build()
