
getArgProp = require "getArgProp"
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
    @promise._unwrap promise, @onFulfilled

  reject: (promise) ->
    @promise._unwrap promise, @onRejected

module.exports = type.build()
