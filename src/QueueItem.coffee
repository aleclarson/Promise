
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
    next = @promise
    return if not next.isPending
    promise._thenResolve next, @onFulfilled
    return

  reject: (promise) ->
    assert promise.isRejected, "'promise' must be rejected!"
    next = @promise
    return if not next.isPending
    promise._thenResolve next, @onRejected
    return

module.exports = type.build()
